/* -----------------------------------------------------------------------------------

    @override by Cozy

    COZY DUPLICATE -
    This file extends the JSlib file : jslib/services/sync.service
    For more context, see commit f1956682454d00328dea38d37257ab32dc80129f
    The copied file version is here :
       https://github.com/bitwarden/jslib/blob/669f6ddf93bbfe8acd18a4834fff5e1c7f9c91ba/src/services/sync.service.ts

   ----------------------------------------------------------------------------------- */

import { ApiService } from 'jslib-common/abstractions/api.service';
import { CipherService } from 'jslib-common/abstractions/cipher.service';
import { CollectionService } from 'jslib-common/abstractions/collection.service';
import { FolderService } from 'jslib-common/abstractions/folder.service';
import { KeyConnectorService } from 'jslib-common/abstractions/keyConnector.service';
import { LogService } from 'jslib-common/abstractions/log.service';
import { MessagingService } from 'jslib-common/abstractions/messaging.service';
import { PolicyService } from 'jslib-common/abstractions/policy.service';
import { TokenService } from 'jslib-common/abstractions/token.service';
import { SendService } from 'jslib-common/abstractions/send.service';
import { SettingsService } from 'jslib-common/abstractions/settings.service';
import { StorageService } from 'jslib-common/abstractions/storage.service';

/* start Cozy imports */
import { SyncCipherNotification } from 'jslib-common/models/response/notificationResponse';
import { ProfileOrganizationResponse } from 'jslib-common/models/response/profileOrganizationResponse';
import { SyncService as BaseSyncService } from 'jslib-common/services/sync.service';

import { CozyClientService } from './cozyClient.service';
import { UserService } from './user.service';

import { BrowserCryptoService as CryptoService } from '../../services/browserCrypto.service';
/* end Cozy imports */

const Keys = {
    lastSyncPrefix: 'lastSync_',
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
        private localUserService: UserService,
        private localApiService: ApiService,
        settingsService: SettingsService,
        folderService: FolderService,
        cipherService: CipherService,
        private localCryptoService: CryptoService,
        private localCollectionService: CollectionService,
        storageService: StorageService,
        private localMessagingService: MessagingService,
        policyService: PolicyService,
        sendService: SendService,
        logService: LogService,
        private localTtokenService: TokenService,
        keyConnectorService: KeyConnectorService,
        logoutCallback: (expired: boolean) => Promise<void>,
        private cozyClientService: CozyClientService
    ) {
            super(
                localUserService,
                localApiService,
                settingsService,
                folderService,
                cipherService,
                localCryptoService,
                localCollectionService,
                storageService,
                localMessagingService,
                policyService,
                sendService,
                logService,
                localTtokenService,
                keyConnectorService,
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
    async refreshIdentityToken() {
        const isAuthenticated = await this.localUserService.isAuthenticated();
        if (!isAuthenticated) {
            return;
        }

        const client = await this.cozyClientService.getClientInstance();

        const currentToken = await this.localTtokenService.getToken();

        await this.localApiService.refreshIdentityToken();
        const refreshedToken = await this.localTtokenService.getToken();
        client.getStackClient().setToken(refreshedToken);
        client.options.token = refreshedToken;

        if (currentToken !== refreshedToken) {
            const newUserId = this.localTtokenService.getUserId();
            const email = this.localTtokenService.getEmail();
            const kdf = await this.localUserService.getKdf();
            const kdfIterations = await this.localUserService.getKdfIterations();

            await this.localUserService.setInformation(newUserId, email, kdf, kdfIterations);
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
            isfullSyncRunning = true;
            await this.refreshIdentityToken(); 
            fullSyncPromise = super.fullSync(forceSync, allowThrowOnError)
            .then( resp => {
                isfullSyncRunning = false;
                return resp;
            });
            return fullSyncPromise;
        }
    }

    async syncUpsertCipher(notification: SyncCipherNotification, isEdit: boolean): Promise<boolean> {
        const isAuthenticated = await this.localUserService.isAuthenticated();
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
            'GET',
            `/data/com.bitwarden.organizations/${organizationId}`,
            []
        );

        const userId = await this.localUserService.getUserId();

        const remoteOrganizationUser = Object.values(remoteOrganizationData.members)
            .find(member => member.user_id === userId);

        return remoteOrganizationUser?.key || '';
    }

    protected async syncUpsertOrganizationKey(organizationId: string) {
        const remoteOrganizationKey = await this.getOrganizationKey(organizationId);

        await this.localCryptoService.upsertOrganizationKey(organizationId, remoteOrganizationKey);
    }

    protected async syncUpsertOrganization(organizationId: string, isEdit: boolean) {
        if (!organizationId) {
            return;
        }

        const storedOrganization = await this.localUserService.getOrganization(organizationId);
        const storedOrganizationkey = await this.localCryptoService.getOrgKey(organizationId);

        if (storedOrganization !== null && storedOrganizationkey != null) {
            return;
        }

        const remoteOrganization = await this.localApiService.getOrganization(organizationId);
        const remoteOrganizationResponse = (remoteOrganization as any).response;
        const remoteProfileOrganizationResponse = new ProfileOrganizationResponse(remoteOrganizationResponse);

        if (remoteOrganization !== null) {
            await this.localUserService.upsertOrganization(remoteProfileOrganizationResponse);

            await this.syncUpsertOrganizationKey(organizationId);

            await this.syncUpsertCollections(organizationId, isEdit);
        }
    }

    protected async syncUpsertCollections(organizationId: string, isEdit: boolean) {
        const syncCollections = await this.localApiService.getCollections(organizationId);

        await this.localCollectionService.upsert(syncCollections.data.map(col => {
            return {
                externalId: col.externalId,
                id: col.id,
                name: col.name,
                organizationId: col.organizationId,
                readOnly: false,
            };
        }));
    }

    protected localSyncStarted() {
        this.syncInProgress = true;
        this.localMessagingService.send('syncStarted');
    }

    protected localSyncCompleted(successfully: boolean): boolean {
        this.syncInProgress = false;
        this.localMessagingService.send('syncCompleted', { successfully: successfully });
        return successfully;
    }
}
