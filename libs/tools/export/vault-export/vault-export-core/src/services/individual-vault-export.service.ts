import * as papa from "papaparse";
import { firstValueFrom, map } from "rxjs";

import { PinServiceAbstraction } from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { KdfConfigService } from "@bitwarden/common/auth/abstractions/kdf-config.service";
import { CipherWithIdExport, FolderWithIdExport } from "@bitwarden/common/models/export";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { Folder } from "@bitwarden/common/vault/models/domain/folder";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { KeyService } from "@bitwarden/key-management";

import {
  BitwardenCsvIndividualExportType,
  BitwardenEncryptedIndividualJsonExport,
  BitwardenUnEncryptedIndividualJsonExport,
} from "../types";

import { BaseVaultExportService } from "./base-vault-export.service";
import { IndividualVaultExportServiceAbstraction } from "./individual-vault-export.service.abstraction";
import { ExportFormat } from "./vault-export.service.abstraction";

export class IndividualVaultExportService
  extends BaseVaultExportService
  implements IndividualVaultExportServiceAbstraction
{
  constructor(
    private folderService: FolderService,
    private cipherService: CipherService,
    pinService: PinServiceAbstraction,
    private keyService: KeyService,
    encryptService: EncryptService,
    cryptoFunctionService: CryptoFunctionService,
    kdfConfigService: KdfConfigService,
    private accountService: AccountService,
  ) {
    super(pinService, encryptService, cryptoFunctionService, kdfConfigService);
  }

  async getExport(format: ExportFormat = "csv"): Promise<string> {
    if (format === "encrypted_json") {
      return this.getEncryptedExport();
    }
    return this.getDecryptedExport(format);
  }

  async getPasswordProtectedExport(password: string): Promise<string> {
    const clearText = await this.getExport("json");
    return this.buildPasswordExport(clearText, password);
  }

  private async getDecryptedExport(format: "json" | "csv"): Promise<string> {
    let decFolders: FolderView[] = [];
    let decCiphers: CipherView[] = [];
    const promises = [];

    promises.push(
      this.folderService.getAllDecryptedFromState().then((folders) => {
        decFolders = folders;
      }),
    );

    promises.push(
      this.cipherService.getAllDecrypted().then((ciphers) => {
        decCiphers = ciphers.filter((f) => f.deletedDate == null);
      }),
    );

    await Promise.all(promises);

    if (format === "csv") {
      return this.buildCsvExport(decFolders, decCiphers);
    }

    return this.buildJsonExport(decFolders, decCiphers);
  }

  private async getEncryptedExport(): Promise<string> {
    let folders: Folder[] = [];
    let ciphers: Cipher[] = [];
    const promises = [];

    promises.push(
      this.folderService.getAllFromState().then((f) => {
        folders = f;
      }),
    );

    promises.push(
      this.cipherService.getAll().then((c) => {
        ciphers = c.filter((f) => f.deletedDate == null);
      }),
    );

    await Promise.all(promises);

    const activeUserId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a) => a?.id)),
    );
    const userKey = await this.keyService.getUserKeyWithLegacySupport(activeUserId);
    const encKeyValidation = await this.encryptService.encrypt(Utils.newGuid(), userKey);

    const jsonDoc: BitwardenEncryptedIndividualJsonExport = {
      encrypted: true,
      encKeyValidation_DO_NOT_EDIT: encKeyValidation.encryptedString,
      folders: [],
      items: [],
    };

    folders.forEach((f) => {
      if (f.id == null) {
        return;
      }
      const folder = new FolderWithIdExport();
      folder.build(f);
      jsonDoc.folders.push(folder);
    });

    ciphers.forEach((c) => {
      // Cozy customization; do not export contacts
      if (c.type === CipherType.Contact) {
        return;
      }
      // Cozy customization end
      /* Commented by cozy
      // The default BW is to exclude ciphers that have an organizationId. But in Cozy, ciphers created
      // in harvest or by the stack (via migration script for example) are shared with the cozy organization.
      // These ciphers are still the user's ownership. So we want to include all ciphers in exported data.
      if (c.organizationId != null) {
        return;
      }
      */
      const cipher = new CipherWithIdExport();
      cipher.build(c);
      cipher.collectionIds = null;
      jsonDoc.items.push(cipher);
    });

    return JSON.stringify(jsonDoc, null, "  ");
  }

  private buildCsvExport(decFolders: FolderView[], decCiphers: CipherView[]): string {
    const foldersMap = new Map<string, FolderView>();
    decFolders.forEach((f) => {
      if (f.id != null) {
        foldersMap.set(f.id, f);
      }
    });

    const exportCiphers: BitwardenCsvIndividualExportType[] = [];
    decCiphers.forEach((c) => {
      // only export logins and secure notes
      if (c.type !== CipherType.Login && c.type !== CipherType.SecureNote) {
        return;
      }
      /* Commented by cozy
      // The default BW is to exclude ciphers that have an organizationId. But in Cozy, ciphers created
      // in harvest or by the stack (via migration script for example) are shared with the cozy organization.
      // These ciphers are still the user's ownership. So we want to include all ciphers in exported data.
      if (c.organizationId != null) {
        return;
      }
      */

      const cipher = {} as BitwardenCsvIndividualExportType;
      cipher.folder =
        c.folderId != null && foldersMap.has(c.folderId) ? foldersMap.get(c.folderId).name : null;
      cipher.favorite = c.favorite ? 1 : null;
      this.buildCommonCipher(cipher, c);
      exportCiphers.push(cipher);
    });

    return papa.unparse(exportCiphers);
  }

  private buildJsonExport(decFolders: FolderView[], decCiphers: CipherView[]): string {
    const jsonDoc: BitwardenUnEncryptedIndividualJsonExport = {
      encrypted: false,
      folders: [],
      items: [],
    };

    decFolders.forEach((f) => {
      if (f.id == null) {
        return;
      }
      const folder = new FolderWithIdExport();
      folder.build(f);
      jsonDoc.folders.push(folder);
    });

    decCiphers.forEach((c) => {
      // Cozy customization; do not export contacts
      if (c.type === CipherType.Contact) {
        return;
      }
      // Cozy customization end
      /* Commented by cozy
      // The default BW is to exclude ciphers that have an organizationId. But in Cozy, ciphers created
      // in harvest or by the stack (via migration script for example) are shared with the cozy organization.
      // These ciphers are still the user's ownership. So we want to include all ciphers in exported data.
      if (c.organizationId != null) {
        return;
      }
      */
      const cipher = new CipherWithIdExport();
      cipher.build(c);
      cipher.collectionIds = null;
      jsonDoc.items.push(cipher);
    });

    return JSON.stringify(jsonDoc, null, "  ");
  }
}
