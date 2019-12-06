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

    it('should sugggest konnectors by slug', () => {
        const konnectors = buildKonnectors([{slug: 'ameli'}, {slug: 'amazon'}, {slug: 'impots'}]);
        const ciphers = buildCiphers([{name: 'orange'}, {name: 'Ameli'}]);
        const suggested = konnectorsService.suggestedKonnectorsFromCiphers(konnectors, [], [], ciphers);
        expect(suggested).toEqual([konnectors[0]]);
    });
    it('should suggest konnectors by full url match', () => {
        const konnectors = buildKonnectors([{slug: 'ameli', uri: 'http://ameli.fr/login'}]);
        const ciphers = buildCiphers([{name: 'Sécurité Sociale', uri: 'http://ameli.fr/login'}]);
        const suggested = konnectorsService.suggestedKonnectorsFromCiphers(konnectors, [], [], ciphers);
        expect(suggested).toEqual(konnectors);
    });
    it('should suggest konnectors by hostname', () => {
        const konnectors = buildKonnectors([{slug: 'ameli', uri: 'ameli.fr'}]);
        const ciphers = buildCiphers([{name: 'Sécurité Sociale', uri: 'http://ameli.fr/login'}]);
        let suggested = konnectorsService.suggestedKonnectorsFromCiphers(konnectors, [], [], ciphers);
        expect(suggested).toEqual(konnectors);

        konnectors[0].latest_version.manifest.vendor_link  = 'http://ameli.fr/login';
        ciphers[0].login.uris[0].uri = 'ameli.fr';
        suggested = konnectorsService.suggestedKonnectorsFromCiphers(konnectors, [], [], ciphers);
        expect(suggested).toEqual(konnectors);
    });
    it('should suggest konnectors by domain', () => {
        const konnectors = buildKonnectors([{slug: 'ameli', uri: 'ameli.fr'}]);
        const ciphers = buildCiphers([{name: 'Sécurité Sociale', uri: 'http://www.ameli.fr/login'}]);
        let suggested = konnectorsService.suggestedKonnectorsFromCiphers(konnectors, [], [], ciphers);
        expect(suggested).toEqual(konnectors);

        konnectors[0].latest_version.manifest.vendor_link = 'http://www.ameli.fr/login';
        ciphers[0].login.uris[0].uri = 'ameli.fr';
        suggested = konnectorsService.suggestedKonnectorsFromCiphers(konnectors, [], [], ciphers);
        expect(suggested).toEqual(konnectors);
    });
    it('should not suggest konnectors with close url', () => {
        const konnectors = buildKonnectors([{slug: 'Orange', uri: 'orange.fr'}, {slug: 'cozy cloud', uri: 'cozy.io'}]);
        const ciphers = buildCiphers([{name: 'fruit lover', uri: 'http://fruitlover.fr/orange'}, {slug: 'cozy cat', uri: 'cozy.fr'}]);
        const suggested = konnectorsService.suggestedKonnectorsFromCiphers(konnectors, [], [], ciphers);
        expect(suggested).toEqual([]);
    });
    it('should not suggest empty konnector', () => {
        const konnectors = buildKonnectors([{slug: ''}]);
        const ciphers = buildCiphers([{name: ''}]);
        const suggested = konnectorsService.suggestedKonnectorsFromCiphers(konnectors, [], [], ciphers);
        expect(suggested).toEqual([]);
    });
    it('should not suggest installed or already suggested konnector', () => {
        const konnectors = buildKonnectors([{slug: 'ameli'}, {slug: 'amazon'}, {slug: 'impots'}]);
        const ciphers = buildCiphers([{name: 'Ameli'}, {name: 'amazon'}]);
        const installedKonnectors = buildKonnectors([{slug: 'ameli'}]);
        const suggestedKonnectors = buildKonnectors([{slug: 'amazon'}]);
        const suggested = konnectorsService.suggestedKonnectorsFromCiphers(
            konnectors, installedKonnectors, suggestedKonnectors, ciphers);
        expect(suggested).toEqual([]);
    });
});
