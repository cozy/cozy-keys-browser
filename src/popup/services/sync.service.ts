/* -----------------------------------------------------------------------------------

    @override by Cozy

    COZY DUPLICATE -
    This file is duplicated from the JSlib file : jslib/abstractions/sync.service.ts
    For more context, see commit f1956682454d00328dea38d37257ab32dc80129f
    The copied file version is here :
       https://github.com/bitwarden/jslib/blob/669f6ddf93bbfe8acd18a4834fff5e1c7f9c91ba/src/services/sync.service.ts

   ----------------------------------------------------------------------------------- */

import { ApiService } from 'jslib/abstractions/api.service';
import { CipherService } from 'jslib/abstractions/cipher.service';
import { CollectionService } from 'jslib/abstractions/collection.service';
import { CryptoService } from 'jslib/abstractions/crypto.service';
import { FolderService } from 'jslib/abstractions/folder.service';
import { MessagingService } from 'jslib/abstractions/messaging.service';
import { PolicyService } from 'jslib/abstractions/policy.service';
import { SettingsService } from 'jslib/abstractions/settings.service';
import { StorageService } from 'jslib/abstractions/storage.service';
import { UserService } from 'jslib/abstractions/user.service';

/* start Cozy imports */
import { SyncService as BaseSyncService } from 'jslib/services/sync.service';
import { CozyClientService } from './cozyClient.service';
/* end Cozy imports */

const Keys = {
    lastSyncPrefix: 'lastSync_',
};
let isfullSyncRunning: boolean = false;
let fullSyncPromise: Promise<boolean>;

export class SyncService extends BaseSyncService {
    // We need to store these two service instances here because in the extended
    // class they are private, meaning we can't access this.userService or
    // this.storageService otherwise
    /* tslint:disable-next-line */
    private _userService: UserService;
    /* tslint:disable-next-line */
    private _storageService: StorageService;

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
                logoutCallback,
            );

            this._userService = userService;
            this._storageService = storageService;
    }

    async setLastSync(date: Date): Promise<any> {
        await super.setLastSync(date);

        // Update remote sync date only for non-zero date, which is used for logout
        if (date.getTime() !== new Date(0).getTime()) {
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
            .then( (resp) => {
                isfullSyncRunning = false;
                return resp;
            });
            return fullSyncPromise;
        }
    }

}
