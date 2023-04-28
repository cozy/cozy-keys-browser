import { KeySuffixOptions } from "@bitwarden/common/enums/keySuffixOptions";
import { CryptoService } from "@bitwarden/common/services/crypto.service";

import { ProfileOrganizationResponse } from "@bitwarden/common/models/response/profileOrganizationResponse";
import { ProfileProviderOrganizationResponse } from "@bitwarden/common/models/response/profileProviderOrganizationResponse";

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
