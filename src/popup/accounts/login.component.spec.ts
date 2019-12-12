import { LoginComponent } from './login.component';

describe('url input', () => {
    const loginComponent = new LoginComponent(null, null, null, null, null, null, null, null);
    it('should return undefined if the input is empty', () => {
        const inputUrl = '';
        expect(() => {
            loginComponent.sanitizeUrlInput(inputUrl);
        }).toThrow(new Error('cozyUrlRequired'));
    });
    it('should return undefined if the input is an email', () => {
        const inputUrl = 'claude@cozycloud.cc';
        expect(() => {
            loginComponent.sanitizeUrlInput(inputUrl);
        }).toThrow(new Error('noEmailAsCozyUrl'));
    });
    it('should return the url without the app slug if present', () => {
        const inputUrl = 'claude-drive.mycozy.cloud';
        const url = loginComponent.sanitizeUrlInput(inputUrl);
        expect(url).toEqual('https://claude.mycozy.cloud');
    });
    it('should return the url with the default domain if missing', () => {
        const inputUrl = 'claude-drive';
        const url = loginComponent.sanitizeUrlInput(inputUrl);
        expect(url).toEqual('https://claude.mycozy.cloud');
    });
    it('should return the url with the default scheme if missing', () => {
        const inputUrl = 'claude.mycozy.cloud';
        const url = loginComponent.sanitizeUrlInput(inputUrl);
        expect(url).toEqual('https://claude.mycozy.cloud');
    });
    it('should return the url if the input is correct', () => {
        const inputUrl = 'https://claude.mycozy.cloud';
        const url = loginComponent.sanitizeUrlInput(inputUrl);
        expect(url).toEqual('https://claude.mycozy.cloud');
    });
    it('should accept local url', () => {
        const inputUrl = 'http://claude.cozy.tools:8080';
        const url = loginComponent.sanitizeUrlInput(inputUrl);
        expect(url).toEqual('http://claude.cozy.tools:8080');
    });
});
