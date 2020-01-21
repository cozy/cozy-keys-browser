import { ApiService } from 'jslib/abstractions/api.service';
import { CipherService } from 'jslib/abstractions/cipher.service';
import { CollectionService } from 'jslib/abstractions/collection.service';
import { CryptoService } from 'jslib/abstractions/crypto.service';
import { FolderService } from 'jslib/abstractions/folder.service';
import { MessagingService } from 'jslib/abstractions/messaging.service';
import { SettingsService } from 'jslib/abstractions/settings.service';
import { StorageService } from 'jslib/abstractions/storage.service';
import { UserService } from 'jslib/abstractions/user.service';

import { SyncService as BaseSyncService } from 'original-jslib/services/sync.service';
import { CozyClientService } from '../../../../src/popup/services/cozyClient.service';

const Keys = {
    lastSyncPrefix: 'lastSync_',
};

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
        logoutCallback: (expired: boolean) => Promise<void>,
        private cozyClientService: () => CozyClientService,
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
                logoutCallback,
            );

            this._userService = userService;
            this._storageService = storageService;
    }

    async setLastSync(date: Date): Promise<any> {
        await super.setLastSync(date);

        const cozyClientService = this.cozyClientService();
        await cozyClientService.updateSynchronizedAt();
    }
}
