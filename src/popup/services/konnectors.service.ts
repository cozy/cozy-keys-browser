import { Registry } from 'cozy-client';
import { CipherService } from 'jslib/abstractions/cipher.service';
import { Utils } from 'jslib/misc/utils';
import { CipherView } from 'jslib/models/view/cipherView';
import { CozyClientService } from './cozyClient.service';

export class KonnectorsService {
    constructor(private cipherService: CipherService, protected cozyClientService: CozyClientService) {
    }

    /**
     *  Create konnector's suggestion based on the available konnectors and ciphers.
     *
     *  On a privacy note, this discloses to the server which services having an associated konnector
     *  exist in the vault. Knowing that the konnector itself is not considered as secret
     *  on the server, we consider it as acceptable.
     */
    async createSuggestions() {
        const cozyClient = await this.cozyClientService.createClient();
        const allKonnectors = await this.getRegistryKonnectors(cozyClient);
        const installedKonnectors = await this.getInstalledKonnectors(cozyClient);
        const suggestedKonnectors = await this.getSuggestedKonnectors(cozyClient);
        const ciphers = await this.cipherService.getAllDecrypted();
        const suggested = await this.suggestedKonnectorsFromCiphers(
            allKonnectors, installedKonnectors, suggestedKonnectors, ciphers);
        await this.sendKonnectorsSuggestion(cozyClient, suggested);
    }

    async getRegistryKonnectors(client: any) {
        const registry = new Registry({client: client});
        return registry.fetchApps({channel: 'stable', type: 'konnector'});
    }

    async getInstalledKonnectors(client: any) {
        const konnectors = await client.query(client.find('io.cozy.konnectors'));
        return konnectors ? konnectors.data : null;
    }

    async getSuggestedKonnectors(client: any) {
        const suggestions = await client.query(client.find('io.cozy.apps.suggestions'));
        return suggestions ? suggestions.data : null;
    }

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

    removeWWW(hostname: string): string {
        const split = hostname.split('www.');
        return split.length > 1 ? split[1] : split[0];
    }

    hasMatchingCipher(konnector: any, ciphers: CipherView[]): boolean {
        return ciphers.some((cipher) => {
            // Test on name
            if ((konnector.slug && cipher.name) && konnector.slug.toLowerCase() === cipher.name.toLowerCase()) {
                return true;
            }
            // Test on uris
            if (!konnector.latest_version || !cipher.login.uris) {
                return false;
            }
            return cipher.login.uris.some((uri) => {
                const cipherHostname = this.removeWWW(uri.hostname);
                const konnectorHostname = this.removeWWW(
                    Utils.getHostname(konnector.latest_version.manifest.vendor_link),
                );
                return (cipherHostname && konnectorHostname) && cipherHostname === konnectorHostname;
            });
        });
    }

    filterKonnectors(registryKonnectors: any[], installedKonnectors: any[], suggestedKonnectors: any[]) {
        return registryKonnectors.filter((konn) => {
            const alreadySuggested = suggestedKonnectors.some((suggested) => suggested.slug === konn.slug);
            const alreadyInstalled = installedKonnectors.some((installed) => installed.slug === konn.slug);
            return !alreadySuggested && !alreadyInstalled;
        });
    }

    suggestedKonnectorsFromCiphers(registryKonnectors: any[], installedKonnectors: any[],
        suggestedKonnectors: any[], ciphers: CipherView[]) {
        // Do not consider installed or already suggested konnectors
        const filteredKonnectors = this.filterKonnectors(
            registryKonnectors, installedKonnectors, suggestedKonnectors);
        // Find eligible konnectors' suggestions
        const matchingKonnectors = filteredKonnectors.filter((konnector) => {
            return this.hasMatchingCipher(konnector, ciphers);
        });
        return matchingKonnectors;
    }
}
