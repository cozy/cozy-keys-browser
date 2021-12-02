import { BrowserApi } from './browserApi';

export class SafariApp {
    static sendMessageToApp(command: string, data: any = null, resolveNow = false): Promise<any> {
        if (!BrowserApi.isSafariApi) {
            return Promise.resolve(null);
        }
        const now = new Date();
        const messageId = now.getTime().toString() + '_' + Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
        return browser.runtime.sendNativeMessage('io.cozy.pass.desktop', {
            id: messageId,
            command: command,
            data: data,
            responseData: null,
        });
    }
}
