/* -----------------------------------------------------------------------------------

    Cozy custo : this file is specific to Cozy

    This file extends the JSlib class : @bitwarden/common/vault/services/sync/sync.service
    For more context, see commit f1956682454d00328dea38d37257ab32dc80129f
    The original extended file version is here :
       https://github.com/bitwarden/jslib/blob/669f6ddf93bbfe8acd18a4834fff5e1c7f9c91ba/src/services/sync.service.ts

   ----------------------------------------------------------------------------------- */

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { CollectionService } from "@bitwarden/common/abstractions/collection.service";
import { LogService } from "@bitwarden/common/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/abstractions/messaging.service";
import { InternalOrganizationService } from "@bitwarden/common/abstractions/organization/organization.service.abstraction";
import { InternalPolicyService } from "@bitwarden/common/abstractions/policy/policy.service.abstraction";
import { SendService } from "@bitwarden/common/abstractions/send.service";
import { SettingsService } from "@bitwarden/common/abstractions/settings.service";
import { KeyConnectorService } from "@bitwarden/common/auth/abstractions/key-connector.service";
/* start Cozy imports */
/* eslint-disable */
import { SyncCipherNotification } from "@bitwarden/common/models/response/notification.response";
import { ProfileProviderOrganizationResponse as ProfileProviderOrganizationResponse } from "@bitwarden/common/models/response/profile-provider-organization.response";
import { SyncService as BaseSyncService } from "@bitwarden/common/vault/services/sync/sync.service";
import { CozyClientService } from "./cozyClient.service";
import { BrowserCryptoService as CryptoService } from "../../services/browserCrypto.service";
import { StateService } from "@bitwarden/common/abstractions/state.service";
import { ProviderService } from "@bitwarden/common/abstractions/provider.service";
import { FolderApiServiceAbstraction } from "@bitwarden/common/vault/abstractions/folder/folder-api.service.abstraction";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { InternalFolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
/* eslint-enable */
/* end Cozy imports */

interface Member {
  user_id: string;
  key?: string;
}

type Members = { [id: string]: Member };

interface CozyOrganizationDocument {
  members?: Members;
}

let isfullSyncRunning = false;
let fullSyncPromise: Promise<boolean>;

export class SyncService extends BaseSyncService {
  constructor(
    private localApiService: ApiService,
    settingsService: SettingsService,
    folderService: InternalFolderService,
    cipherService: CipherService,
    private localCryptoService: CryptoService,
    private localCollectionService: CollectionService,
    private localMessagingService: MessagingService,
    policyService: InternalPolicyService,
    sendService: SendService,
    logService: LogService,
    keyConnectorService: KeyConnectorService,
    private localStateService: StateService,
    providerService: ProviderService,
    private localFolderApiService: FolderApiServiceAbstraction,
    private _organizationService: InternalOrganizationService,
    logoutCallback: (expired: boolean) => Promise<void>,
    cozyClientService: CozyClientService
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
      providerService,
      localFolderApiService,
      _organizationService,
      logoutCallback,
      cozyClientService
    );
  }

  async setLastSync(date: Date): Promise<any> {
    await super.setLastSync(date);

    // Update remote sync date only for non-zero date, which is used for logout
    if (date.getTime() !== 0) {
      await this.cozyClientService.updateSynchronizedAt();
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
      return fullSyncPromise;
    }
  }

  async syncUpsertCipher(notification: SyncCipherNotification, isEdit: boolean): Promise<boolean> {
    const isAuthenticated = await this.localStateService.getIsAuthenticated();
    if (!isAuthenticated) {
      return false;
    }

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

    const storedOrganization = await this._organizationService.get(organizationId);
    const storedOrganizationkey = await this.localCryptoService.getOrgKey(organizationId);

    if (storedOrganization !== null && storedOrganizationkey != null) {
      return;
    }

    const remoteOrganization = await this._organizationService.get(organizationId);
    const remoteOrganizationResponse = (remoteOrganization as any).response;
    const remoteProfileProviderOrganizationResponse = new ProfileProviderOrganizationResponse(
      remoteOrganizationResponse
    );

    if (remoteOrganization !== null) {
      await this._organizationService.upsertOrganization(remoteProfileProviderOrganizationResponse);

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
