import { KonnectorsService } from './konnectors.service';
import { CipherView } from 'jslib/models/view/cipherView';
import { LoginView } from 'jslib/models/view/loginView';
import { LoginUriView } from 'jslib/models/view/loginUriView';

const buildKonnectors = (konnectors: any[]) => {
    return konnectors.map(konnector => {
        return {
            slug: konnector.slug,
            latest_version: {
                manifest: {
                    vendor_link: konnector.uri
                }
            }
        };
    });
}

const buildCiphers = (ciphers: any[]) => {
    return ciphers.map(cipher => {
        const cipherView = new CipherView();
        cipherView.name = cipher.name;
        if (cipher.uri) {
            cipherView.login = new LoginView();
            const loginUri = new LoginUriView();
            loginUri.uri = cipher.uri;
            cipherView.login.uris = [loginUri];
        }
        return cipherView;
    });
}

describe('Konnectors Service', () => {
    const konnectorsService = new KonnectorsService(null, null, null);

    it('suggested konnectors should match by slug', () => {
        const konnectors = buildKonnectors([{slug: 'ameli'}, {slug: 'amazon'}, {slug: 'impots'}]);
        const ciphers = buildCiphers([{name: 'orange'}, {name: 'Ameli'}]);
        const suggested = konnectorsService.suggestedKonnectorsFromCiphers(konnectors, [], [], ciphers);
        expect(suggested).toEqual([konnectors[0]]);
    });
    it('suggested konnectors should match by uri', () => {
        const konnectors = buildKonnectors([{slug: 'ameli', uri: 'ameli.fr'}, {slug: 'sfr', uri: 'http://www.sfr.fr/login'}]);
        const ciphers = buildCiphers([{name: 'Sécurité Sociale', uri: 'http://ameli.fr/login'}, {name: 'SFR Mobile', uri: 'http://sfr.fr'}]);
        const suggested = konnectorsService.suggestedKonnectorsFromCiphers(konnectors, [], [], ciphers);
        expect(suggested).toEqual(konnectors);
    });
    it('empty konnector should not be suggested', () => {
        const konnectors = buildKonnectors([{slug: ''}]);
        const ciphers = buildCiphers([{name: ''}]);
        const suggested = konnectorsService.suggestedKonnectorsFromCiphers(konnectors, [], [], ciphers);
        expect(suggested).toEqual([]);
    });
    it('installed or already suggested konnector should not be suggested', () => {
        const konnectors = buildKonnectors([{slug: 'ameli'}, {slug: 'amazon'}, {slug: 'impots'}]);
        const ciphers = buildCiphers([{name: 'Ameli'}, {name: 'amazon'}]);
        const installedKonnectors = buildKonnectors([{slug: 'ameli'}]);
        const suggestedKonnectors = buildKonnectors([{slug: 'amazon'}]);
        const suggested = konnectorsService.suggestedKonnectorsFromCiphers(
            konnectors, installedKonnectors, suggestedKonnectors, ciphers);
        expect(suggested).toEqual([]);
    });
});
