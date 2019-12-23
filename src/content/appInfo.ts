import { BrowserApi } from '../browser/browserApi';

window.addEventListener('message', async (event) => {
    if (event.data && event.data.message && event.data.message.source === 'cozy-passwords') {
        const version = BrowserApi.getApplicationVersion();
        const message = {
            source: 'cozy-extension',
            version: version,
        };
        window.postMessage({
            message: message,
        }, event.origin);
    }
});
