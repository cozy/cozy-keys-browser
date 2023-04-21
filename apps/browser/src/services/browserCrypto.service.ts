import { KeySuffixOptions } from "jslib-common/enums/keySuffixOptions";
import { ProfileOrganizationResponse } from "jslib-common/models/response/profileOrganizationResponse";
import { ProfileProviderOrganizationResponse } from "jslib-common/models/response/profileProviderOrganizationResponse";
import { CryptoService } from "jslib-common/services/crypto.service";

export class BrowserCryptoService extends CryptoService {
  async upsertOrganizationKey(organizationId: string, key: string) {
    if (key === "") {
      return;
    }
    const encOrgKeys = await this.stateService.getEncryptedOrganizationKeys();

    encOrgKeys[organizationId] = key;

    await this.clearOrgKeys();
    await this.stateService.setEncryptedOrganizationKeys(encOrgKeys);
  }

  setOrgKeys(
    orgs: ProfileOrganizationResponse[],
    providerOrgs: ProfileProviderOrganizationResponse[]
  ): Promise<void> {
    const validOrgs = orgs.filter((org) => org.key !== "");

    return super.setOrgKeys(validOrgs, providerOrgs);
  }

  protected async retrieveKeyFromStorage(keySuffix: KeySuffixOptions) {
    if (keySuffix === "biometric") {
      await this.platformUtilService.authenticateBiometric();
      return (await this.getKey())?.keyB64;
    }

    return await super.retrieveKeyFromStorage(keySuffix);
  }
}
