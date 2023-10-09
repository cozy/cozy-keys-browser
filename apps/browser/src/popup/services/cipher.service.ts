import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { CryptoService } from "@bitwarden/common/abstractions/crypto.service";
import { EncryptService } from "@bitwarden/common/abstractions/encrypt.service";
import { FileUploadService } from "@bitwarden/common/abstractions/fileUpload.service";
import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/abstractions/log.service";
import { SearchService } from "@bitwarden/common/abstractions/search.service";
import { SettingsService } from "@bitwarden/common/abstractions/settings.service";
import { StateService } from "@bitwarden/common/abstractions/state.service";
import { sequentialize } from "@bitwarden/common/misc/sequentialize";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
/**
 * Cozy : we overcharge this class in order to modify `getAllDecrypted()`
 */
import { CipherService as CipherServiceBase } from "@bitwarden/common/vault/services/cipher.service";

export class CipherService extends CipherServiceBase {
  constructor(
    private localCryptoService: CryptoService,
    settingsService: SettingsService,
    apiService: ApiService,
    fileUploadService: FileUploadService,
    i18nService: I18nService,
    private localSearchService: () => SearchService,
    logService: LogService,
    private localStateService: StateService,
    private localEncryptService: EncryptService
  ) {
    super(
      localCryptoService,
      settingsService,
      apiService,
      fileUploadService,
      i18nService,
      localSearchService,
      logService,
      localStateService,
      localEncryptService
    );
  }

  @sequentialize(() => "getAllDecrypted")
  async getAllDecrypted(): Promise<CipherView[]> {
    const userId = await this.localStateService.getUserId();
    if ((await this.getDecryptedCipherCache()) != null) {
      if (
        this.localSearchService != null &&
        (this.localSearchService().indexedEntityId ?? userId) !== userId
      ) {
        await this.localSearchService().indexCiphers(userId, await this.getDecryptedCipherCache());
      }
      return await this.getDecryptedCipherCache();
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

    ciphers.forEach(async (cipher) => {
      promises.push(cipher.decrypt().then((c) => decCiphers.push(c)));
    });

    await Promise.all(promises);
    decCiphers.sort(this.getLocaleSortingFunction());
    await this.setDecryptedCipherCache(decCiphers);
    return decCiphers;
  }
}
