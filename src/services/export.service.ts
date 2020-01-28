import * as papa from 'papaparse';

import { ExportService as BaseExportService } from 'jslib/services/export.service';

import { ApiService } from 'jslib/abstractions/api.service';
import { CipherService } from 'jslib/abstractions/cipher.service';
import { FolderService } from 'jslib/abstractions/folder.service';

import { CipherWithIds as CipherExport } from 'jslib/models/export/cipherWithIds';
import { FolderWithId as FolderExport } from 'jslib/models/export/folderWithId';
import { CipherView } from 'jslib/models/view/cipherView';
import { FolderView } from 'jslib/models/view/folderView';

import { CipherType } from 'jslib/enums/cipherType';

/**
 * By default the ciphers that have an organizationId and not included in the
 * exported data. In our case, ciphers created in harvest or by the stack (via
 * migration script for example) are shared with the cozy organization. But
 * these ciphers are still the user's ownership. So we want to include it in
 * exported data.
 *
 * So we extend the jslib's ExportService and override the `getExport` method
 * so that all ciphers are included in exported data. We also had to copy/paste
 * the `buildCommonCipher` because it's private so we can't access it from
 * child class.
 */
export class ExportService extends BaseExportService {
    /* tslint:disable-next-line */
    private _folderService: FolderService;
    /* tslint:disable-next-line */
    private _cipherService: CipherService;
    /* tslint:disable-next-line */
    private _apiService: ApiService;

    constructor(
        folderService: FolderService,
        cipherService: CipherService,
        apiService: ApiService,
    ) {
        super(folderService, cipherService, apiService);

        this._folderService = folderService;
        this._cipherService = cipherService;
        this._apiService = apiService;
    }

    async getExport(format: 'csv' | 'json' = 'csv'): Promise<string> {
        let decFolders: FolderView[] = [];
        let decCiphers: CipherView[] = [];
        const promises = [];

        promises.push(this._folderService.getAllDecrypted().then((folders) => {
            decFolders = folders;
        }));

        promises.push(this._cipherService.getAllDecrypted().then((ciphers) => {
            decCiphers = ciphers;
        }));

        await Promise.all(promises);

        if (format === 'csv') {
            const foldersMap = new Map<string, FolderView>();
            decFolders.forEach((f) => {
                foldersMap.set(f.id, f);
            });

            const exportCiphers: any[] = [];
            decCiphers.forEach((c) => {
                // only export logins and secure notes
                if (c.type !== CipherType.Login && c.type !== CipherType.SecureNote) {
                    return;
                }

                const cipher: any = {};
                cipher.folder = c.folderId != null && foldersMap.has(c.folderId) ?
                    foldersMap.get(c.folderId).name : null;
                cipher.favorite = c.favorite ? 1 : null;
                this._buildCommonCipher(cipher, c);
                exportCiphers.push(cipher);
            });

            return papa.unparse(exportCiphers);
        } else {
            const jsonDoc: any = {
                folders: [],
                items: [],
            };

            decFolders.forEach((f) => {
                if (f.id == null) {
                    return;
                }
                const folder = new FolderExport();
                folder.build(f);
                jsonDoc.folders.push(folder);
            });

            decCiphers.forEach((c) => {
                const cipher = new CipherExport();
                cipher.build(c);
                cipher.collectionIds = null;
                jsonDoc.items.push(cipher);
            });

            return JSON.stringify(jsonDoc, null, '  ');
        }
    }

    private _buildCommonCipher(cipher: any, c: CipherView) {
        cipher.type = null;
        cipher.name = c.name;
        cipher.notes = c.notes;
        cipher.fields = null;
        // Login props
        cipher.login_uri = null;
        cipher.login_username = null;
        cipher.login_password = null;
        cipher.login_totp = null;

        if (c.fields) {
            c.fields.forEach((f: any) => {
                if (!cipher.fields) {
                    cipher.fields = '';
                } else {
                    cipher.fields += '\n';
                }

                cipher.fields += ((f.name || '') + ': ' + f.value);
            });
        }

        switch (c.type) {
            case CipherType.Login:
                cipher.type = 'login';
                cipher.login_username = c.login.username;
                cipher.login_password = c.login.password;
                cipher.login_totp = c.login.totp;

                if (c.login.uris) {
                    cipher.login_uri = [];
                    c.login.uris.forEach((u) => {
                        cipher.login_uri.push(u.uri);
                    });
                }
                break;
            case CipherType.SecureNote:
                cipher.type = 'note';
                break;
            default:
                return;
        }

        return cipher;
    }
}
