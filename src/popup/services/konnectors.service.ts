import { Registry } from 'cozy-client';
import { CipherService } from 'jslib/abstractions/cipher.service';
import { SettingsService } from 'jslib/abstractions/settings.service';
import { StorageService } from 'jslib/abstractions/storage.service';
import { CipherType } from 'jslib/enums/cipherType';
import { UriMatchType } from 'jslib/enums/uriMatchType';
import { Utils } from 'jslib/misc/utils';
import { CipherView } from 'jslib/models/view/cipherView';
import { get } from 'lodash';
import { LocalConstantsService as ConstantsService } from '../services/constants.service';
import { CozyClientService } from './cozyClient.service';

const DomainMatchBlacklist = new Map<string, Set<string>>([
    ['google.com', new Set(['script.google.com'])],
]);

export class KonnectorsService {
    constructor(private cipherService: CipherService, private storageService: StorageService,
        private settingsService: SettingsService, private cozyClientService: CozyClientService) {
    }

    /**
     *  Create konnector's suggestion based on the available konnectors and ciphers.
     *
     *  On a privacy note, this discloses to the server which services having an associated konnector
     *  exist in the vault. We consider it as acceptable, as the user would eventually create it,
     *  revealing it to the server anyway.
     */
    async createSuggestions() {
        try {
            const isDisabled = await this.storageService.get<boolean>(ConstantsService.disableKonnectorsSuggestionsKey);
            if (!isDisabled) {
                const cozyClient = await this.cozyClientService.createClient();
                const allKonnectors = await this.getRegistryKonnectors(cozyClient);
                const installedKonnectors = await this.getInstalledKonnectors(cozyClient);
                const suggestedKonnectors = await this.getSuggestedKonnectors(cozyClient);
                const ciphers = await this.cipherService.getAllDecrypted();
                const konnectorsToSuggest = await this.suggestedKonnectorsFromCiphers(
                    allKonnectors, installedKonnectors, suggestedKonnectors, ciphers,
                );
                this.sendKonnectorsSuggestion(cozyClient, konnectorsToSuggest);
            }
        } catch (e) { }
    }

    async getRegistryKonnectors(client: any) {
        const registry = new Registry({client: client});
        return registry.fetchApps({channel: 'stable', type: 'konnector'});
    }

    async getInstalledKonnectors(client: any) {
        const konnectors = await client.query(client.find('io.cozy.konnectors'));
        if (!konnectors) {
            throw new Error('Error while fetching konnectors');
        }
        return konnectors.data;
    }

    async getSuggestedKonnectors(client: any) {
        const suggestions = await client.query(client.find('io.cozy.apps.suggestions'));
        if (!suggestions) {
            throw new Error('Error while fetching suggestions');
        }
        return suggestions.data;
    }

    // TODO: Add relationships
    // https://github.com/cozy/cozy-doctypes/blob/master/docs/io.cozy.accounts.md#vault-cipher
    async sendKonnectorsSuggestion(client: any, konnectors: any[]) {
        const creationPromises = konnectors.map((konnector) => {
            const suggested = {
                slug: konnector.slug,
                silenced: false,
                reason: {
                    code: 'FOUND_CIPHER',
                },
            };
            return client.create('io.cozy.apps.suggestions', suggested);
        });
        await Promise.all(creationPromises);
    }

    getSuggestableKonnectors(registryKonnectors: any[], installedKonnectors: any[], suggestedKonnectors: any[]) {
        return registryKonnectors.filter((konn) => {
            const alreadySuggested = suggestedKonnectors.some((suggested) => suggested.slug === konn.slug);
            const alreadyInstalled = installedKonnectors.some((installed) => installed.slug === konn.slug);
            return !alreadySuggested && !alreadyInstalled;
        });
    }

    /**
     * Find a cipher having a matching url.
     *
     * This function was extracted from `getAllDecryptedForUrl` in jslib/src/services/cipher.services,
     * as we experienced performances issues with the decryption part.
     */
    async matchingUrls(url: string, ciphers: CipherView[], defaultMatch: number) {

        const domain = Utils.getDomain(url);
        const eqDomainsPromise = domain == null ? Promise.resolve([]) :
            this.settingsService.getEquivalentDomains().then((eqDomains: any[][]) => {
                let matches: any[] = [];
                eqDomains.forEach((eqDomain) => {
                    if (eqDomain.length && eqDomain.indexOf(domain) >= 0) {
                        matches = matches.concat(eqDomain);
                    }
                });

                if (!matches.length) {
                    matches.push(domain);
                }

                return matches;
            });
        const matchingDomains = await eqDomainsPromise;

        return ciphers.some((cipher) => {
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
                        case UriMatchType.Host:
                            const urlHost = Utils.getHost(url);
                            if (urlHost != null && urlHost === Utils.getHost(u.uri)) {
                                return true;
                            }
                            break;
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
                                const regex = new RegExp(u.uri, 'i');
                                if (regex.test(url)) {
                                    return true;
                                }
                            } catch { }
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

    async suggestedKonnectorsFromCiphers(registryKonnectors: any[], installedKonnectors: any[],
        suggestedKonnectors: any[], ciphers: CipherView[]) {
        // Do not consider installed or already suggested konnectors
        const suggestableKonnectors = this.getSuggestableKonnectors(
            registryKonnectors, installedKonnectors, suggestedKonnectors,
        );
        // Get default matching setting for urls
        let defaultMatch = await this.storageService.get<UriMatchType>(ConstantsService.defaultUriMatch);
        if (defaultMatch == null) {
            defaultMatch = UriMatchType.Domain;
        }
        const promises = suggestableKonnectors.map(async (konnector) => {
            const url = get(konnector, 'latest_version.manifest.vendor_link');
            if (!url) {
                return null;
            }
            const matches = await this.matchingUrls(url, ciphers, defaultMatch);
            return matches ? konnector : null;
        });
        const results = await Promise.all(promises);
        const matchingKonnectors = results.filter((res) => res);
        return matchingKonnectors;
    }
}
