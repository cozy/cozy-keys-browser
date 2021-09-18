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
import { CryptoService } from 'jslib-common/abstractions/crypto.service';
import { FolderService } from 'jslib-common/abstractions/folder.service';
import { MessagingService } from 'jslib-common/abstractions/messaging.service';
import { PolicyService } from 'jslib-common/abstractions/policy.service';
import { SendService } from 'jslib-common/abstractions/send.service';
import { SettingsService } from 'jslib-common/abstractions/settings.service';
import { StorageService } from 'jslib-common/abstractions/storage.service';
import { UserService } from 'jslib-common/abstractions/user.service';

/* start Cozy imports */
import { SyncService as BaseSyncService } from 'jslib-common/services/sync.service';
import { CozyClientService } from './cozyClient.service';
/* end Cozy imports */

const Keys = {
    lastSyncPrefix: 'lastSync_',
};
let isfullSyncRunning: boolean = false;
let fullSyncPromise: Promise<boolean>;

export class SyncService extends BaseSyncService {
    constructor(
        userService: UserService,
        apiService: ApiService,
        settingsService: SettingsService,
        folderService: FolderService,
        cipherService: CipherService,
        cryptoService: CryptoService,
        collectionService: CollectionService,
        storageService: StorageService,
        messagingService: MessagingService,
        policyService: PolicyService,
        sendService: SendService,
        logoutCallback: (expired: boolean) => Promise<void>,
        private cozyClientService: CozyClientService,
    ) {
            super(
                userService,
                apiService,
                settingsService,
                folderService,
                cipherService,
                cryptoService,
                collectionService,
                storageService,
                messagingService,
                policyService,
                sendService,
                logoutCallback,
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
            isfullSyncRunning = true;
            fullSyncPromise = super.fullSync(forceSync, allowThrowOnError)
            .then( resp => {
                isfullSyncRunning = false;
                return resp;
            });
            return fullSyncPromise;
        }
    }

}
