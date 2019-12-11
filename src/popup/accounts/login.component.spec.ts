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
        expect(url).toEqual('claude.mycozy.cloud');
    });
    it('should return the url with the default domain if missing', () => {
        const inputUrl = 'claude-drive';
        const url = loginComponent.sanitizeUrlInput(inputUrl);
        expect(url).toEqual('claude.mycozy.cloud');
    });
    it('should return the url if the input is correct', () => {
        const inputUrl = 'claude.mycozy.cloud';
        const url = loginComponent.sanitizeUrlInput(inputUrl);
        expect(url).toEqual('claude.mycozy.cloud');
    });
});
