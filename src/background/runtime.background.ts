import { CipherType } from 'jslib/enums';

import { CipherView } from 'jslib/models/view/cipherView';
import { LoginUriView } from 'jslib/models/view/loginUriView';
import { LoginView } from 'jslib/models/view/loginView';

import { LocalConstantsService } from '../popup/services/constants.service';

import { I18nService } from 'jslib/abstractions/i18n.service';

import { Analytics } from 'jslib/misc';

import { CipherService } from 'jslib/abstractions/cipher.service';
import { LockService } from 'jslib/abstractions/lock.service';
import { StorageService } from 'jslib/abstractions/storage.service';
import { SystemService } from 'jslib/abstractions/system.service';

import { BrowserApi } from '../browser/browserApi';

import MainBackground from './main.background';

import { KonnectorsService } from '../popup/services/konnectors.service';

import { AutofillService } from '../services/abstractions/autofill.service';
import BrowserPlatformUtilsService from '../services/browserPlatformUtils.service';

import { NotificationsService } from 'jslib/abstractions/notifications.service';

import { Utils } from 'jslib/misc/utils';

export default class RuntimeBackground {
    private runtime: any;
    private autofillTimeout: any;
    private pageDetailsToAutoFill: any[] = [];
    private isSafari: boolean;
    private onInstalledReason: string = null;

    constructor(private main: MainBackground, private autofillService: AutofillService,
        private cipherService: CipherService, private platformUtilsService: BrowserPlatformUtilsService,
        private storageService: StorageService, private i18nService: I18nService,
        private analytics: Analytics, private notificationsService: NotificationsService,
        private systemService: SystemService, private lockService: LockService,
        private konnectorsService: KonnectorsService) {
        this.isSafari = this.platformUtilsService.isSafari();
        this.runtime = this.isSafari ? {} : chrome.runtime;

        // onInstalled listener must be wired up before anything else, so we do it in the ctor
        if (!this.isSafari) {
            this.runtime.onInstalled.addListener((details: any) => {
                this.onInstalledReason = details.reason;
            });
        }
    }

    async init() {
        if (!this.runtime) {
            return;
        }

        await this.checkOnInstalled();
        BrowserApi.messageListener('runtime.background', (msg: any, sender: any, sendResponse: any) => {
            this.processMessage(msg, sender, sendResponse);
        });
    }

    async processMessage(msg: any, sender: any, sendResponse: any) {
        /*
        @override by Cozy : this log is very usefoul for reverse engineer the code, keep it for tests

        console.log('PROCESS MESSAGE msg.command:', msg.command, 'msg.subcommandm', msg.subcommand, 'msg.sender', msg.sender, 'sender', sender);

        */

        switch (msg.command) {
            case 'loggedIn':
            case 'unlocked':
                await this.main.setIcon();
                await this.main.refreshBadgeAndMenu(false);
                this.notificationsService.updateConnection(msg.command === 'unlocked');
                this.systemService.cancelProcessReload();
                // ask notificationbar of all tabs to retry to collect pageDetails in order to activate in-page-menu
                window.setTimeout(async () => {
                    const allTabs = await BrowserApi.getAllTabs();
                    for (const tab of allTabs) {
                        BrowserApi.tabSendMessage(tab,{command: 'notificationBarCollect'})
                    }
                }, 1);
                break;
            case 'logout':
                await this.main.logout(msg.expired);
                break;
            case 'syncCompleted':
                if (msg.successfully) {
                    setTimeout(async () => await this.main.refreshBadgeAndMenu(), 2000);
                }
                break;
            case 'openPopup':
                await this.main.openPopup();
                break;
            case 'showDialogResolve':
                this.platformUtilsService.resolveDialogPromise(msg.dialogId, msg.confirmed);
                break;
            case 'bgGetDataForTab':
                await this.getDataForTab(sender.tab, msg.responseCommand);
                break;
            case 'bgOpenNotificationBar':
                await BrowserApi.tabSendMessageData(sender.tab, 'openNotificationBar', msg.data);
                break;
            case 'bgCloseNotificationBar':
                await BrowserApi.tabSendMessageData(sender.tab, 'closeNotificationBar');
                break;
            case 'bgAdjustNotificationBar':
                await BrowserApi.tabSendMessageData(sender.tab, 'adjustNotificationBar', msg.data);
                break;
            case 'bgCollectPageDetails':
                await this.main.collectPageDetailsForContentScript(sender.tab, msg.sender, sender.frameId);
                break;
            case 'bgAnswerMenuRequest':
                switch (msg.subcommand) {
                    case 'getCiphersForTab':
                        const ciphers = await this.cipherService.getAllDecryptedForUrl(sender.tab.url, null);
                        await BrowserApi.tabSendMessageData(sender.tab, 'updateMenuCiphers', ciphers);
                        break;
                    case 'closeMenu':
                        await BrowserApi.tabSendMessage(sender.tab, {
                            command    : 'autofillAnswerRequest',
                            subcommand : 'closeMenu',
                        });
                        break;
                    case 'setMenuHeight':
                        await BrowserApi.tabSendMessage(sender.tab, {
                            command   : 'autofillAnswerRequest',
                            subcommand: 'setMenuHeight',
                            height    : msg.height,
                        });
                        break;
                    case 'fillFormWithCipher':
                        await BrowserApi.tabSendMessage(sender.tab, {
                            command   : 'autofillAnswerRequest',
                            subcommand: 'fillFormWithCipher',
                            cipherId  : msg.cipherId,
                        });
                        break;
                    case 'menuMoveSelection':
                        await BrowserApi.tabSendMessage(sender.tab, {
                            command     : 'menuAnswerRequest',
                            subcommand  : 'menuSetSelectionOnCipher',
                            targetCipher: msg.targetCipher,
                        });
                        break;
                    case 'menuSelectionValidate':
                        await BrowserApi.tabSendMessage(sender.tab, {
                            command   : 'menuAnswerRequest',
                            subcommand: 'menuSelectionValidate',
                        });
                        break;
                }
                break;
            case 'bgGetCiphersForTab':

            case 'bgAddLogin':
                await this.addLogin(msg.login, sender.tab);
                break;
            case 'bgChangedPassword':
                await this.changedPassword(msg.data, sender.tab);
                break;
            case 'bgAddClose':
            case 'bgChangeClose':
                this.removeTabFromNotificationQueue(sender.tab);
                break;
            case 'bgAddSave':
                await this.saveAddLogin(sender.tab);
                break;
            case 'bgChangeSave':
                await this.saveChangePassword(sender.tab);
                break;
            case 'bgNeverSave':
                await this.saveNever(sender.tab);
                break;
            case 'bgUpdateContextMenu':
            case 'editedCipher':
            case 'addedCipher':
            case 'deletedCipher':
                await this.main.refreshBadgeAndMenu();
                break;
            case 'bgReseedStorage':
                await this.main.reseedStorage();
                break;
            case 'collectPageDetailsResponse':
                if (await this.lockService.isLocked()) {
                    return;
                }
                switch (msg.sender) {
                    case 'notificationBar':
                        // auttofill.js sends the page details requested by the notification bar.
                        // 1- request autofill for the in page menu (if activated)
                        let enableInPageMenu = await this.storageService.get<any>(
                            LocalConstantsService.enableInPageMenuKey);
                        if (enableInPageMenu === null) { // if not yet set, then default to true
                            enableInPageMenu = true;
                        }
                        if (enableInPageMenu) {
                            const totpCode1 = await this.autofillService.doAutoFillForLastUsedLogin([{
                                frameId: sender.frameId,
                                tab: msg.tab,
                                details: msg.details,
                                sender: 'notifBarForInPageMenu', // in order to prepare a fillscript for the menu
                            }], true);
                            if (totpCode1 != null) {
                                this.platformUtilsService.copyToClipboard(totpCode1, { window: window });
                            }
                        }
                        // 2- send page details to the notification bar
                        const forms = this.autofillService.getFormsWithPasswordFields(msg.details);
                        await BrowserApi.tabSendMessageData(msg.tab, 'notificationBarPageDetails', {
                            details: msg.details,
                            forms: forms,
                        });

                        break;
                    case 'autofiller':
                    case 'autofill_cmd':
                        const totpCode = await this.autofillService.doAutoFillForLastUsedLogin([{
                            frameId: sender.frameId,
                            tab: msg.tab,
                            details: msg.details,
                            sender: msg.sender, // @override by Cozy : sent to precise it is for inPageMenu fillScript
                        }], msg.sender === 'autofill_cmd');
                        if (totpCode != null) {
                            this.platformUtilsService.copyToClipboard(totpCode, { window: window });
                        }
                        break;

                    case 'menu.js':
                        const tab = await BrowserApi.getTabFromCurrentWindow();
                        const totpCode2 = await this.autofillService.doAutoFill({
                            cipher     : msg.cipher,
                            pageDetails: [{
                                frameId: sender.frameId,
                                tab    : tab,
                                details: msg.details,
                            }],
                        });
                        if (totpCode2 != null) {
                            this.platformUtilsService.copyToClipboard(totpCode2, { window: window });
                        }
                        break;

                    case 'contextMenu':
                        clearTimeout(this.autofillTimeout);
                        this.pageDetailsToAutoFill.push({
                            frameId: sender.frameId,
                            tab: msg.tab,
                            details: msg.details,
                        });
                        this.autofillTimeout = setTimeout(async () => await this.autofillPage(), 300);
                        break;
                    default:
                        break;
                }
                break;
            default:
                break;
        }
    }

    private async autofillPage() {
        const totpCode = await this.autofillService.doAutoFill({
            cipher: this.main.loginToAutoFill,
            pageDetails: this.pageDetailsToAutoFill,
        });

        if (totpCode != null) {
            this.platformUtilsService.copyToClipboard(totpCode, { window: window });
        }

        // reset
        this.main.loginToAutoFill = null;
        this.pageDetailsToAutoFill = [];
    }

    private async saveAddLogin(tab: any) {
        if (await this.lockService.isLocked()) {
            return;
        }

        for (let i = this.main.notificationQueue.length - 1; i >= 0; i--) {
            const queueMessage = this.main.notificationQueue[i];
            if (queueMessage.tabId !== tab.id || queueMessage.type !== 'addLogin') {
                continue;
            }

            const tabDomain = Utils.getDomain(tab.url);
            if (tabDomain != null && tabDomain !== queueMessage.domain) {
                continue;
            }

            this.main.notificationQueue.splice(i, 1);
            BrowserApi.tabSendMessageData(tab, 'closeNotificationBar');

            const loginModel = new LoginView();
            const loginUri = new LoginUriView();
            loginUri.uri = queueMessage.uri;
            loginModel.uris = [loginUri];
            loginModel.username = queueMessage.username;
            loginModel.password = queueMessage.password;
            const model = new CipherView();
            model.name = Utils.getHostname(queueMessage.uri) || queueMessage.domain;
            model.name = model.name.replace(/^www\./, '');
            model.type = CipherType.Login;
            model.login = loginModel;

            const cipher = await this.cipherService.encrypt(model);
            await this.cipherService.saveWithServer(cipher);
            this.analytics.ga('send', {
                hitType: 'event',
                eventAction: 'Added Login from Notification Bar',
            });
            this.konnectorsService.createSuggestions();
        }
    }

    private async saveChangePassword(tab: any) {
        if (await this.lockService.isLocked()) {
            return;
        }

        for (let i = this.main.notificationQueue.length - 1; i >= 0; i--) {
            const queueMessage = this.main.notificationQueue[i];
            if (queueMessage.tabId !== tab.id || queueMessage.type !== 'changePassword') {
                continue;
            }

            const tabDomain = Utils.getDomain(tab.url);
            if (tabDomain != null && tabDomain !== queueMessage.domain) {
                continue;
            }

            this.main.notificationQueue.splice(i, 1);
            BrowserApi.tabSendMessageData(tab, 'closeNotificationBar');

            const cipher = await this.cipherService.get(queueMessage.cipherId);
            if (cipher != null && cipher.type === CipherType.Login) {
                const model = await cipher.decrypt();
                model.login.password = queueMessage.newPassword;
                const newCipher = await this.cipherService.encrypt(model);
                await this.cipherService.saveWithServer(newCipher);
                this.analytics.ga('send', {
                    hitType: 'event',
                    eventAction: 'Changed Password from Notification Bar',
                });
            }
        }
    }

    private async saveNever(tab: any) {
        for (let i = this.main.notificationQueue.length - 1; i >= 0; i--) {
            const queueMessage = this.main.notificationQueue[i];
            if (queueMessage.tabId !== tab.id || queueMessage.type !== 'addLogin') {
                continue;
            }

            const tabDomain = Utils.getDomain(tab.url);
            if (tabDomain != null && tabDomain !== queueMessage.domain) {
                continue;
            }

            this.main.notificationQueue.splice(i, 1);
            BrowserApi.tabSendMessageData(tab, 'closeNotificationBar');

            const hostname = Utils.getHostname(tab.url);
            await this.cipherService.saveNeverDomain(hostname);
        }
    }

    private async addLogin(loginInfo: any, tab: any) {
        if (await this.lockService.isLocked()) {
            return;
        }

        const loginDomain = Utils.getDomain(loginInfo.url);
        if (loginDomain == null) {
            return;
        }

        const ciphers = await this.cipherService.getAllDecryptedForUrl(loginInfo.url);
        const usernameMatches = ciphers.filter((c) => c.login.username === loginInfo.username);
        if (usernameMatches.length === 0) {
            const disabledAddLogin = await this.storageService.get<boolean>(
                LocalConstantsService.disableAddLoginNotificationKey);
            if (disabledAddLogin) {
                return;
            }
            // remove any old messages for this tab
            this.removeTabFromNotificationQueue(tab);
            this.main.notificationQueue.push({
                type: 'addLogin',
                username: loginInfo.username,
                password: loginInfo.password,
                domain: loginDomain,
                uri: loginInfo.url,
                tabId: tab.id,
                expires: new Date((new Date()).getTime() + 30 * 60000), // 30 minutes
            });
            await this.main.checkNotificationQueue(tab);
        } else if (usernameMatches.length === 1 && usernameMatches[0].login.password !== loginInfo.password) {
            const disabledChangePassword = await this.storageService.get<boolean>(
                LocalConstantsService.disableChangedPasswordNotificationKey);
            if (disabledChangePassword) {
                return;
            }
            this.addChangedPasswordToQueue(usernameMatches[0].id, loginDomain, loginInfo.password, tab);
        }
    }

    private async changedPassword(changeData: any, tab: any) {
        if (await this.lockService.isLocked()) {
            return;
        }

        const loginDomain = Utils.getDomain(changeData.url);
        if (loginDomain == null) {
            return;
        }

        let id: string = null;
        const ciphers = await this.cipherService.getAllDecryptedForUrl(changeData.url);
        if (changeData.currentPassword != null) {
            const passwordMatches = ciphers.filter((c) => c.login.password === changeData.currentPassword);
            if (passwordMatches.length === 1) {
                id = passwordMatches[0].id;
            }
        } else if (ciphers.length === 1) {
            id = ciphers[0].id;
        }
        if (id != null) {
            this.addChangedPasswordToQueue(id, loginDomain, changeData.newPassword, tab);
        }
    }

    private async addChangedPasswordToQueue(cipherId: string, loginDomain: string, newPassword: string, tab: any) {
        // remove any old messages for this tab
        this.removeTabFromNotificationQueue(tab);
        this.main.notificationQueue.push({
            type: 'changePassword',
            cipherId: cipherId,
            newPassword: newPassword,
            domain: loginDomain,
            tabId: tab.id,
            expires: new Date((new Date()).getTime() + 30 * 60000), // 30 minutes
        });
        await this.main.checkNotificationQueue(tab);
    }

    private removeTabFromNotificationQueue(tab: any) {
        for (let i = this.main.notificationQueue.length - 1; i >= 0; i--) {
            if (this.main.notificationQueue[i].tabId === tab.id) {
                this.main.notificationQueue.splice(i, 1);
            }
        }
    }

    private async checkOnInstalled() {
        if (this.isSafari) {
            const installedVersion = await this.storageService.get<string>(LocalConstantsService.installedVersionKey);
            if (installedVersion == null) {
                this.onInstalledReason = 'install';
            } else if (BrowserApi.getApplicationVersion() !== installedVersion) {
                this.onInstalledReason = 'update';
            }

            if (this.onInstalledReason != null) {
                await this.storageService.save(LocalConstantsService.installedVersionKey,
                    BrowserApi.getApplicationVersion());
            }
        }

        setTimeout(async () => {
            if (this.onInstalledReason != null) {
                if (this.onInstalledReason === 'install') {
                    await this.setDefaultSettings();
                }

                // Execute the content-script on all tabs in case cozy-passwords is waiting for an answer
                const allTabs = await BrowserApi.getAllTabs();
                for (const tab of allTabs) {
                    chrome.tabs.executeScript(tab.id, { file: 'content/appInfo.js' });
                }

                this.analytics.ga('send', {
                    hitType: 'event',
                    eventAction: 'onInstalled ' + this.onInstalledReason,
                });
                this.onInstalledReason = null;
            }
        }, 100);
    }

    private async setDefaultSettings() {
        // Default lock options to "on restart".
        const currentLockOption = await this.storageService.get<number>(LocalConstantsService.lockOptionKey);
        if (currentLockOption == null) {
            await this.storageService.save(LocalConstantsService.lockOptionKey, -1);
        }
    }

    private async getDataForTab(tab: any, responseCommand: string) {
        const responseData: any = {};
        if (responseCommand === 'notificationBarDataResponse') {
            responseData.neverDomains = await this.storageService.get<any>(LocalConstantsService.neverDomainsKey);
            responseData.disabledAddLoginNotification = await this.storageService.get<boolean>(
                LocalConstantsService.disableAddLoginNotificationKey);
            responseData.disabledChangedPasswordNotification = await this.storageService.get<boolean>(
                LocalConstantsService.disableChangedPasswordNotificationKey);
        } else if (responseCommand === 'autofillerAutofillOnPageLoadEnabledResponse') {
            responseData.autofillEnabled = await this.storageService.get<boolean>(
                LocalConstantsService.enableAutoFillOnPageLoadKey);
        } else if (responseCommand === 'notificationBarFrameDataResponse') {
            responseData.i18n = {
                appName: this.i18nService.t('appName'),
                close: this.i18nService.t('close'),
                yes: this.i18nService.t('yes'),
                never: this.i18nService.t('never'),
                notificationAddSave: this.i18nService.t('notificationAddSave'),
                notificationNeverSave: this.i18nService.t('notificationNeverSave'),
                notificationAddDesc: this.i18nService.t('notificationAddDesc'),
                notificationChangeSave: this.i18nService.t('notificationChangeSave'),
                notificationChangeDesc: this.i18nService.t('notificationChangeDesc'),
                notificationDontSave: this.i18nService.t('notificationDontSave'),
            };
        }

        await BrowserApi.tabSendMessageData(tab, responseCommand, responseData);
    }
}
