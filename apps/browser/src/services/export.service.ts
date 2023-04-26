import * as papa from "papaparse";

import { ApiService } from "jslib-common/abstractions/api.service";
import { CipherService } from "jslib-common/abstractions/cipher.service";
import { CryptoService } from "jslib-common/abstractions/crypto.service";
import { CryptoFunctionService } from "jslib-common/abstractions/cryptoFunction.service";
import { FolderService } from "jslib-common/abstractions/folder.service";
import { CipherType } from "jslib-common/enums/cipherType";
import { CipherWithIdExport as CipherExport } from "jslib-common/models/export/cipherWithIdsExport";
import { FolderWithIdExport as FolderExport } from "jslib-common/models/export/folderWithIdExport";
import { CipherView } from "jslib-common/models/view/cipherView";
import { FolderView } from "jslib-common/models/view/folderView";
import { ExportService as BaseExportService } from "jslib-common/services/export.service";

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
  constructor(
    folderService: FolderService,
    cipherService: CipherService,
    apiService: ApiService,
    cryptoService: CryptoService,
    cryptoFunctionService: CryptoFunctionService
  ) {
    super(folderService, cipherService, apiService, cryptoService, cryptoFunctionService);
  }

  async getExport(format: "csv" | "json" = "csv"): Promise<string> {
    let decFolders: FolderView[] = [];
    let decCiphers: CipherView[] = [];
    const promises = [];

    promises.push(
      this.folderService.getAllDecrypted().then((folders) => {
        decFolders = folders;
      })
    );

    promises.push(
      this.cipherService.getAllDecrypted().then((ciphers) => {
        decCiphers = ciphers;
      })
    );

    await Promise.all(promises);

    if (format === "csv") {
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
        cipher.folder =
          c.folderId != null && foldersMap.has(c.folderId) ? foldersMap.get(c.folderId).name : null;
        cipher.favorite = c.favorite ? 1 : null;
        this.buildCommonCipher(cipher, c);
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

      return JSON.stringify(jsonDoc, null, "  ");
    }
  }
}
