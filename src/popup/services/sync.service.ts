/* -----------------------------------------------------------------------------------

    @override by Cozy

    COZY DUPLICATE -
    This file extends the JSlib file : jslib/services/sync.service
    For more context, see commit f1956682454d00328dea38d37257ab32dc80129f
    The copied file version is here :
       https://github.com/bitwarden/jslib/blob/669f6ddf93bbfe8acd18a4834fff5e1c7f9c91ba/src/services/sync.service.ts

   ----------------------------------------------------------------------------------- */

import { ApiService } from "jslib-common/abstractions/api.service";
import { CipherService } from "jslib-common/abstractions/cipher.service";
import { CollectionService } from "jslib-common/abstractions/collection.service";
import { FolderService } from "jslib-common/abstractions/folder.service";
import { KeyConnectorService } from "jslib-common/abstractions/keyConnector.service";
import { LogService } from "jslib-common/abstractions/log.service";
import { MessagingService } from "jslib-common/abstractions/messaging.service";
import { PolicyService } from "jslib-common/abstractions/policy.service";
import { SendService } from "jslib-common/abstractions/send.service";
import { SettingsService } from "jslib-common/abstractions/settings.service";

/* start Cozy imports */
import { TokenService as TokenServiceAbstraction } from "jslib-common/abstractions/token.service";
import { SyncCipherNotification } from "jslib-common/models/response/notificationResponse";
import { ProfileOrganizationResponse } from "jslib-common/models/response/profileOrganizationResponse";
import { SyncService as BaseSyncService } from "jslib-common/services/sync.service";
import { CozyClientService } from "./cozyClient.service";
import { BrowserCryptoService as CryptoService } from "../../services/browserCrypto.service";
import { StateService } from "jslib-common/abstractions/state.service";
import { OrganizationService } from "./organization.service";
import { ProviderService } from "jslib-common/abstractions/provider.service";
/* end Cozy imports */

const Keys = {
  lastSyncPrefix: "lastSync_",
};
interface Member {
  user_id: string;
  key?: string;
}

type Members = { [id: string]: Member };

interface CozyOrganizationDocument {
  members?: Members;
}

let isfullSyncRunning: boolean = false;
let fullSyncPromise: Promise<boolean>;

export class SyncService extends BaseSyncService {
  constructor(
    private localApiService: ApiService,
    settingsService: SettingsService,
    folderService: FolderService,
    cipherService: CipherService,
    private localCryptoService: CryptoService,
    private localCollectionService: CollectionService,
    private localMessagingService: MessagingService,
    policyService: PolicyService,
    sendService: SendService,
    logService: LogService,
    keyConnectorService: KeyConnectorService,
    private localStateService: StateService,
    private localOrganizationService: OrganizationService,
    providerService: ProviderService,
    logoutCallback: (expired: boolean) => Promise<void>,
    private cozyClientService: CozyClientService,
    private tokenService: TokenServiceAbstraction
  ) {
    super(
      localApiService,
      settingsService,
      folderService,
      cipherService,
      localCryptoService,
      localCollectionService,
      localMessagingService,
      policyService,
      sendService,
      logService,
      keyConnectorService,
      localStateService,
      localOrganizationService,
      providerService,
      logoutCallback
    );
  }

  async setLastSync(date: Date): Promise<any> {
    await super.setLastSync(date);

    // Update remote sync date only for non-zero date, which is used for logout
    if (date.getTime() !== 0) {
      await this.cozyClientService.updateSynchronizedAt();
    }
  }

  /**
   * Cozy stack may change how userId is computed in the future
   * So this userId can be desynchronized between client and server
   * This impacts realtime notifications that would be broken if wrong userId is used
   * This method allows to synchronize user identity from the server
   */
  async refreshIdentityToken() {
    const isAuthenticated = await this.localStateService.getIsAuthenticated();
    if (!isAuthenticated) {
      return;
    }

    const client = await this.cozyClientService.getClientInstance();

    const currentToken = await this.tokenService.getToken();

    await this.localApiService.refreshIdentityToken();
    const refreshedToken = await this.tokenService.getToken();
    client.getStackClient().setToken(refreshedToken);
    client.options.token = refreshedToken;

    if (currentToken !== refreshedToken) {
      const newUserId = this.tokenService.getUserId();
      const email = this.tokenService.getEmail();
      const kdf = await this.localStateService.getKdfType();
      const kdfIterations = await this.localStateService.getKdfIterations();

      await this.localStateService.setKdfType(kdf);
      await this.localStateService.setKdfIterations(kdfIterations);
    }
  }

  /*
    Using this function instead of the super :
      * checks if a fullSync is already running
      * if yes, the promise of the currently running fullSync is returned
      * otherwise the promise of a new fullSync is created and returned
  */
  async fullSync(forceSync: boolean, allowThrowOnError = false): Promise<boolean> {
    if (isfullSyncRunning) {
      return fullSyncPromise;
    } else {
      this.syncInProgress = true;
      isfullSyncRunning = true;
      fullSyncPromise = super
        .fullSync(forceSync, allowThrowOnError)
        .catch((e) => {
          isfullSyncRunning = false;
          return false;
        })
        .then((resp) => {
          isfullSyncRunning = false;
          return resp;
        });
      return this.refreshIdentityToken().then(() => fullSyncPromise);
    }
  }

  async syncUpsertCipher(notification: SyncCipherNotification, isEdit: boolean): Promise<boolean> {
    const isAuthenticated = await this.localStateService.getIsAuthenticated();
    if (!isAuthenticated) return false;

    this.localSyncStarted();

    try {
      await this.syncUpsertOrganization(notification.organizationId, isEdit);

      return super.syncUpsertCipher(notification, isEdit);
    } catch (e) {
      return this.localSyncCompleted(false);
    }
  }

  protected async getOrganizationKey(organizationId: string): Promise<string> {
    const client = await this.cozyClientService.getClientInstance();
    const remoteOrganizationData: CozyOrganizationDocument = await client.stackClient.fetchJSON(
      "GET",
      `/data/com.bitwarden.organizations/${organizationId}`,
      []
    );

    const userId = await this.localStateService.getUserId();

    const remoteOrganizationUser = Object.values(remoteOrganizationData.members).find(
      (member) => member.user_id === userId
    );

    return remoteOrganizationUser?.key || "";
  }

  protected async syncUpsertOrganizationKey(organizationId: string) {
    const remoteOrganizationKey = await this.getOrganizationKey(organizationId);

    await this.localCryptoService.upsertOrganizationKey(organizationId, remoteOrganizationKey);
  }

  protected async syncUpsertOrganization(organizationId: string, isEdit: boolean) {
    if (!organizationId) {
      return;
    }

    const storedOrganization = await this.localOrganizationService.get(organizationId);
    const storedOrganizationkey = await this.localCryptoService.getOrgKey(organizationId);

    if (storedOrganization !== null && storedOrganizationkey != null) {
      return;
    }

    const remoteOrganization = await this.localApiService.getOrganization(organizationId);
    const remoteOrganizationResponse = (remoteOrganization as any).response;
    const remoteProfileOrganizationResponse = new ProfileOrganizationResponse(
      remoteOrganizationResponse
    );

    if (remoteOrganization !== null) {
      await this.localOrganizationService.upsertOrganization(remoteProfileOrganizationResponse);

      await this.syncUpsertOrganizationKey(organizationId);

      await this.syncUpsertCollections(organizationId, isEdit);
    }
  }

  protected async syncUpsertCollections(organizationId: string, isEdit: boolean) {
    const syncCollections = await this.localApiService.getCollections(organizationId);

    await this.localCollectionService.upsert(
      syncCollections.data.map((col) => {
        return {
          externalId: col.externalId,
          id: col.id,
          name: col.name,
          organizationId: col.organizationId,
          readOnly: false,
        };
      })
    );
  }

  protected localSyncStarted() {
    this.syncInProgress = true;
    this.localMessagingService.send("syncStarted");
  }

  protected localSyncCompleted(successfully: boolean): boolean {
    this.syncInProgress = false;
    this.localMessagingService.send("syncCompleted", { successfully: successfully });
    return successfully;
  }
}
