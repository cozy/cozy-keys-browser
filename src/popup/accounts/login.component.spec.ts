import { LoginComponent } from './login.component';

describe('url input', () => {
    const loginComponent = new LoginComponent(null, null, null, null, null, null, null, null);
    it('should return undefined if the input is empty', () => {
        const inputUrl = '';
        const url = loginComponent.controlUrlInput(inputUrl);
        expect(url).toEqual(undefined);
    });
    it('should return undefined if the input is an email', () => {
        const inputUrl = 'claude@cozycloud.cc';
        const url = loginComponent.controlUrlInput(inputUrl);
        expect(url).toEqual(undefined);
    });
    it('should return the url without the app slug if present', () => {
        const inputUrl = 'claude-drive.mycozy.cloud';
        const url = loginComponent.controlUrlInput(inputUrl);
        expect(url).toEqual('claude.mycozy.cloud');
    });
    it('should return the url with the default domain if missing', () => {
        const inputUrl = 'claude-drive';
        const url = loginComponent.controlUrlInput(inputUrl);
        expect(url).toEqual('claude.mycozy.cloud');
    });
    it('should return the url if the input is correct', () => {
        const inputUrl = 'claude.mycozy.cloud';
        const url = loginComponent.controlUrlInput(inputUrl);
        expect(url).toEqual('claude.mycozy.cloud');
    });
});
