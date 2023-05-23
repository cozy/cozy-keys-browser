import { KeySuffixOptions } from "@bitwarden/common/enums/keySuffixOptions";
import { CryptoService } from "@bitwarden/common/services/crypto.service";
/* start Cozy imports */
/* eslint-disable */
import { ProfileOrganizationResponse } from "@bitwarden/common/models/response/profile-organization.response";
import { ProfileProviderOrganizationResponse } from "@bitwarden/common/models/response/profile-provider-organization.response";
import { EncryptedOrganizationKeyData } from "@bitwarden/common/models/data/encrypted-organization-key.data";
/* eslint-enable */
/* end Cozy imports */

export class BrowserCryptoService extends CryptoService {

  /** Cozy custo */
  async upsertOrganizationKey(organizationId: string, key: string) {
    if (key === "") {
      return;
    }
    const encOrgKeys = await this.stateService.getEncryptedOrganizationKeys();

    encOrgKeys[organizationId] = key as unknown as EncryptedOrganizationKeyData;

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
  /** end custo */

  protected async retrieveKeyFromStorage(keySuffix: KeySuffixOptions) {
    if (keySuffix === "biometric") {
      await this.platformUtilService.authenticateBiometric();
      return (await this.getKey())?.keyB64;
    }

    return await super.retrieveKeyFromStorage(keySuffix);
  }
}
