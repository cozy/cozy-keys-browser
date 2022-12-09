import { ApiService } from "jslib-common/abstractions/api.service";
import { CipherService as CipherServiceBase } from "jslib-common/services/cipher.service";
import { CipherView } from "jslib-common/models/view/cipherView";
import { CryptoService } from "jslib-common/abstractions/crypto.service";
import { FileUploadService } from "jslib-common/abstractions/fileUpload.service";
import { I18nService } from "jslib-common/abstractions/i18n.service";
import { LogService } from "jslib-common/abstractions/log.service";
import { SearchService } from "jslib-common/abstractions/search.service";
import { sequentialize } from "jslib-common/misc/sequentialize";
import { SettingsService } from "jslib-common/abstractions/settings.service";
import { StorageService } from "jslib-common/abstractions/storage.service";
import { UserService } from "jslib-common/abstractions/user.service";

/**
 * Cozy : we overcharge this class in order to modify `getAllDecrypted()`
 */

export class CipherService extends CipherServiceBase {
  constructor(
    private localCryptoService: CryptoService,
    private localUserService: UserService,
    settingsService: SettingsService,
    apiService: ApiService,
    fileUploadService: FileUploadService,
    storageService: StorageService,
    i18nService: I18nService,
    private localSearchService: () => SearchService,
    logService: LogService
  ) {
    super(
      localCryptoService,
      localUserService,
      settingsService,
      apiService,
      fileUploadService,
      storageService,
      i18nService,
      localSearchService,
      logService
    );
  }

  @sequentialize(() => "getAllDecrypted")
  async getAllDecrypted(): Promise<CipherView[]> {
    if (this.decryptedCipherCache != null) {
      const userId = await this.localUserService.getUserId();
      if (
        this.localSearchService != null &&
        (this.localSearchService().indexedEntityId ?? userId) !== userId
      ) {
        await this.localSearchService().indexCiphers(userId, this.decryptedCipherCache);
      }
      return this.decryptedCipherCache;
    }

    const decCiphers: CipherView[] = [];
    const hasKey = await this.localCryptoService.hasKey();
    if (!hasKey) {
      throw new Error("No key.");
    }

    /** Cozy modifications */
    // the aim is to filter the ciphers on their organizationId
    const orgKeys = await this.localCryptoService.getOrgKeys();
    const orgIds = orgKeys ? [...orgKeys.keys()] : [];

    const promises: any[] = [];
    const ciphers = (await this.getAll()).filter(
      (cipher) => !cipher.organizationId || orgIds.includes(cipher.organizationId)
    );
    /** end Cozy modifications */

    ciphers.forEach((cipher) => {
      promises.push(cipher.decrypt().then((c) => decCiphers.push(c)));
    });

    await Promise.all(promises);
    decCiphers.sort(this.getLocaleSortingFunction());
    this.decryptedCipherCache = decCiphers;
    return this.decryptedCipherCache;
  }
}
