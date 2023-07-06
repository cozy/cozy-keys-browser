import Registry from "cozy-client/dist/registry";
import { firstValueFrom } from "rxjs";

import { SettingsService } from "@bitwarden/common/abstractions/settings.service";
import { UriMatchType } from "@bitwarden/common/enums/uriMatchType";
import { Utils } from "@bitwarden/common/misc/utils";
import { AccountSettingsSettings } from "@bitwarden/common/models/domain/account";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
/*
import { StateService } from "@bitwarden/common/abstractions/state.service";
*/
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { KonnectorsOrg } from "../../models/konnectorsOrganization";
import { BrowserStateService as StateService } from "../../services/abstractions/browser-state.service";

import { CozyClientService } from "./cozyClient.service";

const DomainMatchBlacklist = new Map<string, Set<string>>([
  ["google.com", new Set(["script.google.com"])],
]);

// store "Cozy Connectors" organization and collection from user settings

// interface KonnectorsOrg {
//   organizationId: string;
//   collectionId: string;
// }

export class KonnectorsService {
  private konnectorsOrg: KonnectorsOrg = null;

  constructor(
    private cipherService: CipherService,
    private settingsService: SettingsService,
    private cozyClientService: CozyClientService,
    private stateService: StateService
  ) {}

  /**
   *  Create and send to server the konnector's suggestion based on the available konnectors and ciphers
   *
   *  On a privacy note, this discloses to the server which services having an associated konnector
   *  exist in the vault. We consider it as acceptable, as the user would eventually create it,
   *  revealing it to the server anyway.
   */
  async createSuggestions() {
    try {
      const isDisabled = await this.stateService.getDisableKonnectorsSuggestions();
      if (!isDisabled) {
        const cozyClient = await this.cozyClientService.getClientInstance();
        const allKonnectors = await this.getRegistryKonnectors(cozyClient);
        const installedKonnectors = await this.getInstalledKonnectors(cozyClient);
        const suggestedKonnectors = await this.getSuggestedKonnectors(cozyClient);
        const ciphers = await this.cipherService.getAllDecrypted();
        const konnectorsToSuggest = await this.suggestedKonnectorsFromCiphers(
          allKonnectors,
          installedKonnectors,
          suggestedKonnectors,
          ciphers
        );
        this.sendKonnectorsSuggestion(cozyClient, konnectorsToSuggest);
      }
    } catch (e) {
      // console.error(e);
      // console.error("Error while trying to make konnectors suggestions");
    }
  }

  getRegistryKonnectors(client: any) {
    const registry = new Registry({ client: client });
    // 200 is the default for CozyClient but for now we have a TS issue on the CC's side
    // so let's use this number. Should be removed after https://github.com/cozy/cozy-client/issues/973
    // is fixed
    return registry.fetchApps({ channel: "stable", type: "konnector", limit: "200" });
  }

  async getInstalledKonnectors(client: any) {
    return client.queryAll(client.find("io.cozy.konnectors"));
  }

  async getSuggestedKonnectors(client: any) {
    return client.queryAll(client.find("io.cozy.apps.suggestions"));
  }

  async sendKonnectorsSuggestion(client: any, konnectors: any[]) {
    const creationPromises = konnectors.map((konnector) => {
      const suggested = {
        slug: konnector.slug,
        silenced: false,
        reason: {
          code: "FOUND_CIPHER",
        },
      };
      return client.create("io.cozy.apps.suggestions", suggested);
    });
    await Promise.all(creationPromises);
  }

  getSuggestableKonnectors(
    registryKonnectors: any[],
    installedKonnectors: any[],
    suggestedKonnectors: any[]
  ) {
    return registryKonnectors.filter((konn) => {
      const alreadySuggested = suggestedKonnectors.some(
        (suggested) => suggested.slug === konn.slug
      );
      const alreadyInstalled = installedKonnectors.some(
        (installed) => installed.slug === konn.slug
      );
      return !alreadySuggested && !alreadyInstalled;
    });
  }

  /**
   * Find if a url has a maching cipher.
   *
   * This function was extracted from `getAllDecryptedForUrl` in jslib/src/services/cipher.services,
   * as we experienced performances issues with the decryption part.
   * More precisely, `getAllDecryptedForUrl` calls `getAllDecrypted` to get the decrypted ciphers,
   * which surprisingly took hundreds of ms alone, even though the ciphers were in the cache.
   * As the decryption was processed in a loop for each suggestable konnector, this was taking
   * +1000ms in our tests to process this matching for 146 konnectors and 4 ciphers.
   *
   * See the getAllDecrypted call:
   * https://github.com/bitwarden/jslib/blob/
   * 57e49207e9ad57c71576fc487a38513a4d0fe120/src/services/cipher.service.ts#L344
   */
  async hasURLMatchingCiphers(url: string, ciphers: CipherView[], defaultMatch: number) {
    const domain = Utils.getDomain(url);
    const eqDomainsPromise =
      domain == null
        ? Promise.resolve([])
        : firstValueFrom(this.settingsService.settings$).then(
            (settings: AccountSettingsSettings) => {
              let matches: any[] = [];
              settings?.equivalentDomains?.forEach((eqDomain: any) => {
                if (eqDomain.length && eqDomain.indexOf(domain) >= 0) {
                  matches = matches.concat(eqDomain);
                }
              });

              if (!matches.length) {
                matches.push(domain);
              }

              return matches;
            }
          );
    const matchingDomains = await eqDomainsPromise;

    return ciphers.some((cipher) => {
      if (cipher.deletedDate != null) {
        return false;
      }
      if (url != null && cipher.type === CipherType.Login && cipher.login.uris != null) {
        for (let i = 0; i < cipher.login.uris.length; i++) {
          const u = cipher.login.uris[i];
          if (u.uri == null) {
            continue;
          }
          const match = u.match == null ? defaultMatch : u.match;
          switch (match) {
            case UriMatchType.Domain:
              if (domain != null && u.domain != null && matchingDomains.indexOf(u.domain) > -1) {
                if (DomainMatchBlacklist.has(u.domain)) {
                  const domainUrlHost = Utils.getHost(url);
                  if (!DomainMatchBlacklist.get(u.domain).has(domainUrlHost)) {
                    return true;
                  }
                } else {
                  return true;
                }
              }
              break;
            case UriMatchType.Host: {
              const urlHost = Utils.getHost(url);
              if (urlHost != null && urlHost === Utils.getHost(u.uri)) {
                return true;
              }
              break;
            }
            case UriMatchType.Exact:
              if (url === u.uri) {
                return true;
              }
              break;
            case UriMatchType.StartsWith:
              if (url.startsWith(u.uri)) {
                return true;
              }
              break;
            case UriMatchType.RegularExpression:
              try {
                const regex = new RegExp(u.uri, "i");
                if (regex.test(url)) {
                  return true;
                }
              } catch {
                //
              }
              break;
            case UriMatchType.Never:
            default:
              break;
          }
        }
      }
      return false;
    });
  }

  async suggestedKonnectorsFromCiphers(
    registryKonnectors: any[],
    installedKonnectors: any[],
    suggestedKonnectors: any[],
    ciphers: CipherView[]
  ) {
    // Do not consider installed or already suggested konnectors
    const suggestableKonnectors = this.getSuggestableKonnectors(
      registryKonnectors,
      installedKonnectors,
      suggestedKonnectors
    );
    // Get default matching setting for urls
    let defaultMatch = await this.stateService.getDefaultUriMatch();
    if (defaultMatch == null) {
      defaultMatch = UriMatchType.Domain;
    }
    const promises = suggestableKonnectors.map(async (konnector) => {
      const url =
        konnector && konnector.latest_version && konnector.latest_version.manifest
          ? konnector.latest_version.manifest.vendor_link
          : undefined;
      if (!url) {
        return null;
      }
      const matches = await this.hasURLMatchingCiphers(url, ciphers, defaultMatch);
      return matches ? konnector : null;
    });
    const results = await Promise.all(promises);
    const matchingKonnectors = results.filter((res) => res);
    return matchingKonnectors;
  }

  async isKonnectorsOrganization(organizationId: string): Promise<boolean> {
    const konnectorsOrg = await this.getKonnectorsOrganization();
    if (organizationId === konnectorsOrg.organizationId) {
      return true;
    }
    return false;
  }

  /**
   *  Get "Cozy Connectors" organization and collection from user settings
   */
  async getKonnectorsOrganization(): Promise<KonnectorsOrg> {
    if (this.konnectorsOrg) {
      return this.konnectorsOrg;
    }
    if (this.kOrgPromise) {
      return this.kOrgPromise;
    }
    this.kOrgPromise = this.stateService
      .getKonnectorsOrganization()
      .then((kOrganisationFromState) => {
        if (kOrganisationFromState) {
          this.konnectorsOrg = kOrganisationFromState;
          return this.konnectorsOrg;
        }
        return this.cozyClientService
          .getClientInstance()
          .then((client) => {
            return client
              .getStackClient()
              .fetchJSON("GET", "/data/io.cozy.settings/io.cozy.settings.bitwarden");
          })
          .then(async (settings: any) => {
            this.konnectorsOrg = {
              organizationId: settings.organization_id,
              collectionId: settings.collection_id,
            };
            this.stateService.setKonnectorsOrganization(this.konnectorsOrg);
            return this.konnectorsOrg;
          });
      });
    return this.kOrgPromise;
  }

  private kOrgPromise: Promise<KonnectorsOrg>;
}
