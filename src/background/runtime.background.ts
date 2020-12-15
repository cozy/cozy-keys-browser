import { CipherType } from 'jslib/enums';

import { CipherView } from 'jslib/models/view/cipherView';
import { LoginUriView } from 'jslib/models/view/loginUriView';
import { LoginView } from 'jslib/models/view/loginView';

import { AutofillService } from '../services/abstractions/autofill.service';
import BrowserPlatformUtilsService from '../services/browserPlatformUtils.service';
import { CipherService } from 'jslib/abstractions/cipher.service';
import { ConstantsService } from 'jslib/services/constants.service';
import { LocalConstantsService } from '../popup/services/constants.service';

import { EnvironmentService } from 'jslib/abstractions/environment.service';
import { I18nService } from 'jslib/abstractions/i18n.service';
import { CipherString } from 'jslib/models/domain/cipherString';
import { UserService } from 'jslib/abstractions';
import { CryptoService } from 'jslib/abstractions/crypto.service';
import { NotificationsService } from 'jslib/abstractions/notifications.service';
import { PopupUtilsService } from '../popup/services/popup-utils.service';
import { StateService } from 'jslib/abstractions/state.service';
import { StorageService } from 'jslib/abstractions/storage.service';
import { SyncService } from 'jslib/abstractions/sync.service';
import { SystemService } from 'jslib/abstractions/system.service';
import { VaultTimeoutService } from 'jslib/abstractions/vaultTimeout.service';

import { BrowserApi } from '../browser/browserApi';

import MainBackground from './main.background';

import { CipherWithIds as CipherExport } from 'jslib/models/export/cipherWithIds.ts';

import { Utils } from 'jslib/misc/utils';
import { PasswordVerificationRequest } from 'jslib/models/request/passwordVerificationRequest';
import { KonnectorsService } from '../popup/services/konnectors.service';
import { AuthService } from '../services/auth.service';
import { CozyClientService } from 'src/popup/services/cozyClient.service';

export default class RuntimeBackground {
    private runtime: any;
    private autofillTimeout: any;
    private pageDetailsToAutoFill: any[] = [];
    private isSafari: boolean;
    private onInstalledReason: string = null;

    constructor(private main: MainBackground, private autofillService: AutofillService,
        private cipherService: CipherService, private platformUtilsService: BrowserPlatformUtilsService,
        private storageService: StorageService, private i18nService: I18nService,
        private notificationsService: NotificationsService,
        private systemService: SystemService, private vaultTimeoutService: VaultTimeoutService,
        private environmentService: EnvironmentService,
        private cozyClientService: CozyClientService,
        private konnectorsService: KonnectorsService, private syncService: SyncService,
        private authService: AuthService, private cryptoService: CryptoService,
        private userService: UserService) {
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
        @override by Cozy : this log is very useful for reverse engineering the code, keep it for tests
        console.log('runtime.background PROCESS MESSAGE ', {
            'command': msg.subcommand ? msg.subcommand : msg.command,
            'sender': msg.sender + ' of ' +
            (sender.url ? (new URL(sender.url)).host + ' frameId:' + sender.frameId : sender),
            'full.msg': msg,
            'full.sender': sender,
        });
        */

        switch (msg.command) {
            case 'loggedIn':
            case 'unlocked':
                await this.loggedinAndUnlocked(msg.command); //
                break;
            case 'logout':
                // 1- ask all frames of all tabs to activate login-in-page-menu
                const allTabs = await BrowserApi.getAllTabs();
                for (const tab of allTabs) {
                    BrowserApi.tabSendMessage(tab, {
                        command           : 'autofillAnswerRequest',
                        subcommand        : 'loginIPMenuActivate',
                    });
                }
                // 2- logout
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
                        const logins = await this.cipherService.getAllDecryptedForUrl(sender.tab.url, null);
                        logins.sort((a, b) => this.cipherService.sortCiphersByLastUsedThenName(a, b));
                        const allCiphers = await this.cipherService.getAllDecrypted();
                        const ciphers = {logins: logins, cards: new Array(), identities: new Array()};
                        for (const cipher of allCiphers) {
                            if (cipher.isDeleted) { continue; }
                            const cipherData: CipherExport = new CipherExport();
                            cipherData.build(cipher);
                            switch (cipher.type) {
                                case CipherType.Card:
                                    ciphers.cards.push(cipherData);
                                    break;
                                case CipherType.Identity:
                                    ciphers.identities.push(cipher);
                                    break;
                            }
                        }
                        const cozyUrl = new URL(this.environmentService.getWebVaultUrl()).origin;
                        await BrowserApi.tabSendMessageData(sender.tab, 'updateMenuCiphers', {
                            ciphers: ciphers,
                            cozyUrl: cozyUrl,
                        });
                        break;
                    case 'closeMenu':
                        await BrowserApi.tabSendMessage(sender.tab, {
                            command    : 'autofillAnswerRequest',
                            subcommand : 'closeMenu',
                            force      : msg.force,
                        }); // don't add the frameId, since the emiter (menu) is not the target...
                        break;
                    case 'setMenuHeight':
                        await BrowserApi.tabSendMessage(sender.tab, {
                            command   : 'autofillAnswerRequest',
                            subcommand: 'setMenuHeight',
                            height    : msg.height,
                        });  // don't add the frameId, since the emiter (menu) is not the target...
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
                        await BrowserApi.tabSendMessage(sender.tab, {
                            command   : 'menuAnswerRequest',
                            subcommand: 'menuSelectionValidate',
                        });
                        break;
                    case 'login':
                        await this.logIn(msg.email, msg.pwd, sender.tab, msg.loginUrl);
                        break;
                    case 'unlock':
                        await this.unlock(msg.email, msg.pwd, sender.tab, msg.loginUrl);
                        break;
                    case 'unPinlock':
                        await this.unPinlock(msg.email, msg.pwd, sender.tab, msg.loginUrl);
                        break;
                    case '2faCheck':
                        await this.twoFaCheck(msg.token, sender.tab);
                        break;
                    case 'getRememberedCozyUrl':
                        let rememberedCozyUrl = await this.storageService.get<string>('rememberedCozyUrl');
                        if (!rememberedCozyUrl) { rememberedCozyUrl = ''; }
                        await BrowserApi.tabSendMessage(sender.tab, {
                            command           : 'menuAnswerRequest'    ,
                            subcommand        : 'setRememberedCozyUrl' ,
                            rememberedCozyUrl : rememberedCozyUrl      ,
                        }); // don't add the frameId, since the emiter (menu) is not the target...
                        break;
                    case 'fieldFillingWithData':
                        await BrowserApi.tabSendMessage(sender.tab, {
                            command : 'fieldFillingWithData',
                            opId    : msg.opId              ,
                            data    : msg.data              ,
                        }, {frameId: msg.frameId});
                        break;
                    case 'askMenuTofillFieldWithData':
                        await BrowserApi.tabSendMessage(sender.tab, {
                            command       : 'menuAnswerRequest'       ,
                            subcommand    : 'trigerFillFieldWithData' ,
                            frameTargetId : sender.frameId            ,
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
            case 'bgGetLoginMenuFillScript':
                // addon has been disconnected or the page was loaded while addon was not connected
                let enableInPageMenu = await this.storageService.get<boolean>(
                    LocalConstantsService.enableInPageMenuKey);
                if (enableInPageMenu === null) {enableInPageMenu = true; }
                if (!enableInPageMenu) { break; }
                const fieldsForInPageMenuScripts = await
                    this.autofillService.generateFieldsForInPageMenuScripts(msg.pageDetails, false, sender.frameId);
                this.autofillService.postFilterFieldsForInPageMenu(
                    fieldsForInPageMenuScripts, msg.pageDetails.forms, msg.pageDetails.fields,
                );
                const isAuthenticated = await this.userService.isAuthenticated(); // = connected or installed
                const isLocked = isAuthenticated && await this.vaultTimeoutService.isLocked();
                const pinSet = await this.vaultTimeoutService.isPinLockSet();
                const isPinLocked = (pinSet[0] && this.vaultTimeoutService.pinProtectedKey != null) || pinSet[1];
                await BrowserApi.tabSendMessage(sender.tab, {
                    command                   : 'autofillAnswerRequest',
                    subcommand                : 'loginIPMenuSetFields',
                    fieldsForInPageMenuScripts: fieldsForInPageMenuScripts,
                    isPinLocked               : isPinLocked,
                    isLocked                  : isLocked,
                    frameId                   : sender.frameId,
                }, {frameId: sender.frameId});
                break;
            case 'bgGetAutofillMenuScript':
                // If goes here : means that addon has just been connected (page was already loaded)
                const script = await
                    this.autofillService.generateFieldsForInPageMenuScripts(msg.details, true, sender.frameId);
                await this.autofillService.doAutoFillActiveTab([{
                    frameId                   : sender.frameId,
                    tab                       : sender.tab,
                    details                   : msg.details,
                    fieldsForInPageMenuScripts: script,
                    sender                    : 'notifBarForInPageMenu', // to prepare a fillscript for the in-page-menu
                }], true);
                break;
            case 'collectPageDetailsResponse':
                if (await this.vaultTimeoutService.isLocked()) {
                    BrowserApi.tabSendMessage(msg.tab, {
                        command: 'autofillAnswerRequest',
                        subcommand: 'inPageMenuDeactivate',
                    });
                    return;
                }
                switch (msg.sender) {
                    case 'notificationBar':
                        /* auttofill.js sends the page details requested by the notification bar.
                           Result will be used by both the notificationBar and for the inPageMenu.
                           inPageMenu requires a fillscrip to know wich fields are relevant for the menu and which
                           is the type of each field in order to adapt the menu content (cards, identities, login or
                            existing logins)
                        */
                        // 1- request a fill script for the in-page-menu (if activated)
                        let enableInPageMenu2 = await this.storageService.get<any>(
                            LocalConstantsService.enableInPageMenuKey);
                        // default to true
                        if (enableInPageMenu2 === null) {enableInPageMenu2 = true; }
                        if (enableInPageMenu2) {
                            // If goes here : means that the page has just been loaded while addon was already connected
                            // get scripts for logins, cards and identities

                            const fieldsForAutofillMenuScripts = await
                                this.autofillService.generateFieldsForInPageMenuScripts(
                                    msg.details, true, sender.frameId);
                            // get script for existing logins.
                            // the 4 scripts (existing logins, logins, cards and identities) will be sent
                            // to autofill.js by autofill.service
                            try {
                                const totpCode1 = await this.autofillService.doAutoFillActiveTab([{
                                    frameId: sender.frameId,
                                    tab: msg.tab,
                                    details: msg.details,
                                    fieldsForInPageMenuScripts: fieldsForAutofillMenuScripts,
                                    sender: 'notifBarForInPageMenu', // to prepare a fillscript for the in-page-menu
                                }], true);
                            } catch (error) {
                                // the `doAutoFillActiveTab` is run in a `try` because the original BW code
                                // casts an error when no autofill is detected;
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
                        const totpCode = await this.autofillService.doAutoFillActiveTab([{
                            frameId: sender.frameId,
                            tab: msg.tab,
                            details: msg.details,
                            sender: msg.sender,
                        }], msg.sender === 'autofill_cmd');
                        if (totpCode != null) {
                            this.platformUtilsService.copyToClipboard(totpCode, { window: window });
                        }
                        break;

                    // autofill request for a specific cipher from menu.js
                    case 'autofillForMenu.js':
                        const tab = await BrowserApi.getTabFromCurrentWindow();
                        const c = await this.cipherService.get(msg.cipherId);
                        const cipher = await c.decrypt();
                        const totpCode2 = await this.autofillService.doAutoFill({
                            cipher     : cipher,
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
            case 'authResult':
                let vaultUrl = this.environmentService.webVaultUrl;
                if (vaultUrl == null) {
                    vaultUrl = 'https://vault.bitwarden.com';
                }

                if (msg.referrer == null || Utils.getHostname(vaultUrl) !== msg.referrer) {
                    return;
                }

                try {
                    BrowserApi.createNewTab('popup/index.html?uilocation=popout#/sso?code=' +
                        msg.code + '&state=' + msg.state);
                }
                catch { }
                break;
            default:
                break;
        }
    }

    private async autofillPage() {
        const totpCode = await this.autofillService.doAutoFill({
            cipher: this.main.loginToAutoFill,
            pageDetails: this.pageDetailsToAutoFill,
            fillNewPassword: true
        });

        if (totpCode != null) {
            this.platformUtilsService.copyToClipboard(totpCode, { window: window });
        }

        // reset
        this.main.loginToAutoFill = null;
        this.pageDetailsToAutoFill = [];
    }

    private async saveAddLogin(tab: any) {
        if (await this.vaultTimeoutService.isLocked()) {
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
            this.konnectorsService.createSuggestions();
        }
    }

    private async saveChangePassword(tab: any) {
        if (await this.vaultTimeoutService.isLocked()) {
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
        if (await this.vaultTimeoutService.isLocked()) {
            return;
        }

        const loginDomain = Utils.getDomain(loginInfo.url);
        if (loginDomain == null) {
            return;
        }

        let normalizedUsername = loginInfo.username;
        if (normalizedUsername != null) {
            normalizedUsername = normalizedUsername.toLowerCase();
        }

        const ciphers = await this.cipherService.getAllDecryptedForUrl(loginInfo.url);
        const usernameMatches = ciphers.filter((c) =>
            c.login.username != null && c.login.username.toLowerCase() === normalizedUsername);
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
        if (await this.vaultTimeoutService.isLocked()) {
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
                this.onInstalledReason = null;
            }
        }, 100);
    }

    private async setDefaultSettings() {
        // Default timeout option to "on restart".
        const currentVaultTimeout = await this.storageService.get<number>(LocalConstantsService.vaultTimeoutKey);
        if (currentVaultTimeout == null) {
            await this.storageService.save(LocalConstantsService.vaultTimeoutKey, -1);
        }

        // Default action to "lock".
        const currentVaultTimeoutAction = await
            this.storageService.get<string>(LocalConstantsService.vaultTimeoutActionKey);
        if (currentVaultTimeoutAction == null) {
            await this.storageService.save(LocalConstantsService.vaultTimeoutActionKey, 'lock');
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

    /*
    @override by Cozy
    this function is based on the submit() function in src\popup\accounts\login.component.ts
    */
    private async logIn(email: string, pwd: string, tab: any, loginUrl: string) {
        try {
            // This adds the scheme if missing
            await this.environmentService.setUrls({
                base: loginUrl + '/bitwarden',
            });
            // logIn
            const response = await this.authService.logIn(email, pwd);

            if (response.twoFactor) {
                await BrowserApi.tabSendMessage(tab, {
                    command   : 'autofillAnswerRequest',
                    subcommand: '2faRequested',
                });
            } else {
                // Save the URL for next time (default to yes)
                let rememberCozyUrl = await this.storageService.get<boolean>('rememberCozyUrl');
                if (rememberCozyUrl == null) {rememberCozyUrl = true; }
                if (rememberCozyUrl) {
                    await this.storageService.save('rememberedCozyUrl', loginUrl);
                } else {
                    await this.storageService.remove('rememberedCozyUrl');
                }
                await BrowserApi.tabSendMessage(tab, {
                    command   : 'menuAnswerRequest',
                    subcommand: 'loginOK',
                });
                // when login is processed on background side, then your messages are not receivend by the background,
                // so you need to triger yourself "loggedIn" actions
                this.processMessage({command: 'loggedIn'}, 'runtime.background.ts.login()', null);
            }
        } catch (e) {
            await BrowserApi.tabSendMessage(tab, {
                command   : 'menuAnswerRequest',
                subcommand: 'loginNOK',
            });
        }
    }

    /*
    @override by Cozy
    this function is based on the submit() function in src\popup\accounts\login.component.ts
    */
    private async unlock(email: string, pwd: string, tab: any, loginUrl: string) {
        const kdf = await this.userService.getKdf();
        const kdfIterations = await this.userService.getKdfIterations();
        const key = await this.cryptoService.makeKey(pwd, email, kdf, kdfIterations);
        const keyHash = await this.cryptoService.hashPassword(pwd, key);

        let passwordValid = false;

        if (keyHash != null) {
            const storedKeyHash = await this.cryptoService.getKeyHash();
            if (storedKeyHash != null) {
                passwordValid = storedKeyHash === keyHash;
            }
        }

        if (passwordValid) {
            await this.cryptoService.setKey(key);
            await BrowserApi.tabSendMessage(tab, {
                command   : 'menuAnswerRequest',
                subcommand: 'loginOK',
            });
            // when unlock is processed on background side, then your messages are not receivend by the background,
            // so you need to triger yourself "loggedIn" actions
            this.processMessage({command: 'unlocked'}, 'runtime.background.ts.unlock()', null);

        } else {
            await BrowserApi.tabSendMessage(tab, {
                command   : 'menuAnswerRequest',
                subcommand: 'loginNOK',
            });
        }
    }

    // tslint:disable-next-line
    private invalidPinAttempts = 0;

    /*
    @override by Cozy
    this function is based on the submit() function in jslib/src/angular/components/lock.component.ts
    */
    private async unPinlock(email: string, pin: string, tab: any, loginUrl: string) {
        const kdf = await this.userService.getKdf();
        const kdfIterations = await this.userService.getKdfIterations();
        const pinSet = await this.vaultTimeoutService.isPinLockSet();
        let failed = true;
        try {
            if (pinSet[0]) {
                const key = await this.cryptoService.makeKeyFromPin(pin, email, kdf, kdfIterations,
                    this.vaultTimeoutService.pinProtectedKey);
                const encKey = await this.cryptoService.getEncKey(key);
                const protectedPin = await this.storageService.get<string>(ConstantsService.protectedPin);
                const decPin = await this.cryptoService.decryptToUtf8(new CipherString(protectedPin), encKey);

                failed = decPin !== pin;

                if (!failed) {
                    await this.cryptoService.setKey(key);
                    this.processMessage({command: 'unlocked'}, 'runtime.background.ts.unPinlock()', null);
                }
            } else {
                const key = await this.cryptoService.makeKeyFromPin(pin, email, kdf, kdfIterations);
                failed = false;
                await this.cryptoService.setKey(key);
                chrome.runtime.sendMessage({ command: 'unlocked' });
            }
        } catch {
            failed = true;
        }

        if (failed) {
            this.invalidPinAttempts++;
            if (this.invalidPinAttempts >= 5) {
                // this.messagingService.send('logout');
                chrome.runtime.sendMessage({ command: 'logout' });
                return;
            }
            await BrowserApi.tabSendMessage(tab, {
                command   : 'menuAnswerRequest',
                subcommand: 'loginNOK',
            });
            this.platformUtilsService.showToast('error', this.i18nService.t('errorOccurred'),
                this.i18nService.t('invalidPin'));

        }
    }

    /*
    @override by Cozy
    this function is based on the submit() function in jslib/src/angular/components/two-factor.component.ts
    */
    private async twoFaCheck(token: string, tab: any) {

        try {
            const selectedProviderType = 1; // value observed in running code
            const remember = false;         // value observed in running code
            const resp = await this.authService.logInTwoFactor(selectedProviderType, token, remember);

            if (resp.twoFactor) {
                // validation failed, a new token will be sent to the user.
                await BrowserApi.tabSendMessage(tab, {
                    command   : 'menuAnswerRequest',
                    subcommand: '2faCheckNOK',
                });
            } else {
                // validation succeeded
                this.processMessage({command: 'loggedIn'}, 'runtime.background.ts.twoFaCheck()', null);
            }
        } catch (e) {}
    }

    private async loggedinAndUnlocked(command: string) {
        await this.main.setIcon();
        await this.main.refreshBadgeAndMenu(false);
        this.notificationsService.updateConnection(command === 'unlocked');
        this.systemService.cancelProcessReload();

        await this.cozyClientService.createClient();

        // ask notificationbar of all tabs to retry to collect pageDetails in order to activate in-page-menu
        let enableInPageMenu = await this.storageService.get<boolean>(
            LocalConstantsService.enableInPageMenuKey);
        if (enableInPageMenu === null) { // if not yet set, then default to true
            enableInPageMenu = true;
        }
        let subCommand = 'inPageMenuDeactivate';
        if (enableInPageMenu) {
            subCommand = 'autofilIPMenuActivate';
        }
        await this.syncService.fullSync(true);
        const allTabs = await BrowserApi.getAllTabs();
        for (const tab of allTabs) {
            BrowserApi.tabSendMessage(tab, {
                command   : 'autofillAnswerRequest',
                subcommand: subCommand,
            });
        }
    }

}
