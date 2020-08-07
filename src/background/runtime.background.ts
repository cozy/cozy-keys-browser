import { CipherType } from 'jslib/enums';

import { CipherView } from 'jslib/models/view/cipherView';
import { LoginUriView } from 'jslib/models/view/loginUriView';
import { LoginView } from 'jslib/models/view/loginView';

import { ConstantsService } from 'jslib/services/constants.service';
import { LocalConstantsService } from '../popup/services/constants.service';

import { I18nService } from 'jslib/abstractions/i18n.service';

import { Analytics } from 'jslib/misc';

import { AuthService } from '../services/auth.service';
import { EnvironmentService } from 'jslib/services';
import { EnvironmentService as EnvironmentServiceAbstraction } from 'jslib/abstractions'; // BJA
import { CipherService } from 'jslib/abstractions/cipher.service';
import { StorageService } from 'jslib/abstractions/storage.service';
import { SystemService } from 'jslib/abstractions/system.service';
import { VaultTimeoutService } from 'jslib/abstractions/vaultTimeout.service';

import { BrowserApi } from '../browser/browserApi';

import MainBackground from './main.background';

import { KonnectorsService } from '../popup/services/konnectors.service';

import { AutofillService } from '../services/abstractions/autofill.service';
import BrowserPlatformUtilsService from '../services/browserPlatformUtils.service';

import { NotificationsService } from 'jslib/abstractions/notifications.service';
import { SyncService } from 'jslib/abstractions/sync.service';

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
        private systemService: SystemService, private vaultTimeoutService: VaultTimeoutService,
        private konnectorsService: KonnectorsService, private syncService: SyncService, private authService:AuthService, private environmentService:EnvironmentServiceAbstraction) {
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
        let allTabs;
        /*
        @override by Cozy : this log is very useful for reverse engineering the code, keep it for tests

        console.log('runtime.background PROCESS MESSAGE ', {
            'msg.command:': msg.command,
            'msg.subcommand': msg.subcommand,
            'msg.sender': msg.sender,
            'msg': msg,
            'sender': sender
        });

        */
        console.log('runtime.background PROCESS MESSAGE ', {
            'msg.command:': msg.command,
            'msg.subcommand': msg.subcommand,
            'msg.sender': msg.sender,
            'msg': msg,
            'sender': sender
        });

        switch (msg.command) {
            case 'loggedIn':
            case 'unlocked':
                console.log(msg.command, ' !!');

                await this.main.setIcon();
                await this.main.refreshBadgeAndMenu(false);
                this.notificationsService.updateConnection(msg.command === 'unlocked');
                this.systemService.cancelProcessReload();
                // ask notificationbar of all tabs to retry to collect pageDetails in order to activate in-page-menu
                let enableInPageMenu = await this.storageService.get<boolean>(
                    LocalConstantsService.enableInPageMenuKey);
                if (enableInPageMenu === null) { // if not yet set, then default to true
                    enableInPageMenu = true;
                }
                let subCommand = 'inPageMenuDeactivate'
                if (enableInPageMenu) {
                    subCommand = 'inPageMenuActivate'
                }
                await this.syncService.fullSync(true);
                allTabs = await BrowserApi.getAllTabs();
                for (const tab of allTabs) {
                    BrowserApi.tabSendMessage(tab, {
                        command   : 'autofillAnswerRequest',
                        subcommand: subCommand,
                    });
                }
                break;
            case 'logout':
                // ask all tabs to activate login-in-page-menu
                allTabs = await BrowserApi.getAllTabs();
                for (const tab of allTabs) {
                    BrowserApi.tabSendMessage(tab, {
                        command           : 'autofillAnswerRequest',
                        subcommand        : 'loginInPageMenuActivate',
                    });
                }
                // logout
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
                console.time('bgCollectPageDetails')
                await this.main.collectPageDetailsForContentScript(sender.tab, msg.sender, sender.frameId);
                console.timeEnd('bgCollectPageDetails')
                break;
            case 'bgAnswerMenuRequest':
                switch (msg.subcommand) {
                    case 'getCiphersForTab':
                        console.time("getAllDecryptedForUrl")
                        const ciphers = await this.cipherService.getAllDecryptedForUrl(sender.tab.url, null);
                        console.timeEnd("getAllDecryptedForUrl")
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
                    case 'login':
                        console.log('login requested with', msg.email, msg.pwd);
                        await this.logIn (msg.email, msg.pwd, sender.tab, msg.loginUrl)
                        break;
                    case '2faCheck':
                        console.log('2faCheck requested with', msg.token);
                        await this.twoFaCheck (msg.token, sender.tab)
                        break;
                    case 'getRememberedCozyUrl':
                        console.log('getRememberedCozyUrl requested');
                        let rememberedCozyUrl = await this.storageService.get<string>('rememberedCozyUrl')
                        if (!rememberedCozyUrl) { rememberedCozyUrl = "" }
                        await BrowserApi.tabSendMessage(sender.tab, {
                            command           : 'menuAnswerRequest',
                            subcommand        : 'setRememberedCozyUrl',
                            rememberedCozyUrl : rememberedCozyUrl,
                        });
                        break;
                        await this.twoFaCheck (msg.token, sender.tab)
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
                if (await this.vaultTimeoutService.isLocked()) {
                    return;
                }
                switch (msg.sender) {
                    case 'notificationBar':
                        // auttofill.js sends the page details requested by the notification bar.
                        // 1- request a fill script for the autofill-in-page-menu (if activated)

                        console.time('collectPageDetailsResponse - getkey');
                        let enableInPageMenu = await this.storageService.get<any>(
                            LocalConstantsService.enableInPageMenuKey);
                        if (enableInPageMenu === null) { // if not yet set, then default to true
                            enableInPageMenu = true;
                        }
                        console.timeEnd('collectPageDetailsResponse - getkey');
                        if (enableInPageMenu) {
                            console.time('collectPageDetailsResponse - doAutoFillForLastUsedLogin');
                            const totpCode1 = await this.autofillService.doAutoFillForLastUsedLogin([{
                                frameId: sender.frameId,
                                tab: msg.tab,
                                details: msg.details,
                                sender: 'notifBarForInPageMenu', // to prepare a fillscript for the in-page-menu
                            }], true);
                            console.timeEnd('collectPageDetailsResponse - doAutoFillForLastUsedLogin');
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
                            sender: msg.sender,
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
            this.analytics.ga('send', {
                hitType: 'event',
                eventAction: 'Added Login from Notification Bar',
            });
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

                this.analytics.ga('send', {
                    hitType: 'event',
                    eventAction: 'onInstalled ' + this.onInstalledReason,
                });
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

    private async logIn(email: string, pwd: string, tab:any, loginUrl: string) {
        try {
            // This adds the scheme if missing
            await this.environmentService.setUrls({
                base: loginUrl + '/bitwarden',
            });

            const response = await this.authService.logIn(email, pwd)
            // const formPromise = authService.logIn(this.email, masterPassword.value)
            // const response = await this.formPromise

            // Save the URL for next time // BJA - TODO
            // await this.storageService.save(Keys.rememberCozyUrl, this.rememberCozyUrl)
            // if (this.rememberCozyUrl) {
            //     await this.storageService.save(Keys.rememberedCozyUrl, loginUrl)
            // } else {
            //     await this.storageService.remove(Keys.rememberedCozyUrl)
            // }

            if (response.twoFactor) { // BJA : TODO
                console.log('two factor requested');
                await BrowserApi.tabSendMessage(tab, {
                    command   : 'menuAnswerRequest',
                    subcommand: '2faRequested',
                })
                // if (this.onSuccessfulLoginTwoFactorNavigate != null) {
                //     this.onSuccessfulLoginTwoFactorNavigate()
                // } else {
                //     this.router.navigate([this.twoFactorRoute])
                // }
            } else {
                // Save the URL for next time
                if (await this.storageService.get<boolean>('rememberCozyUrl')) {
                    await this.storageService.save('rememberedCozyUrl', loginUrl);
                } else {
                    await this.storageService.remove('rememberedCozyUrl');
                }
                await BrowserApi.tabSendMessage(tab, {
                    command   : 'menuAnswerRequest',
                    subcommand: 'loginOK',
                })
                // // const disableFavicon = await this.storageService.get<boolean>(ConstantsService.disableFaviconKey)
                // // await this.stateService.save(ConstantsService.disableFaviconKey, !!disableFavicon)
                // if (this.onSuccessfulLogin != null) {
                //     // this.onSuccessfulLogin()
                // }
                // // this.platformUtilsService.eventTrack('Logged In')
                // if (this.onSuccessfulLoginNavigate != null) {
                //     // this.onSuccessfulLoginNavigate()
                // } else {
                //     // this.router.navigate([this.successRoute])
                // }
            }
        } catch (e) {
            console.log('error during submit()', e);
            await BrowserApi.tabSendMessage(tab, {
                command   : 'menuAnswerRequest',
                subcommand: 'loginNOK',
            })
            // if (e.message === 'cozyUrlRequired' || e.message === 'noEmailAsCozyUrl') {
            //     this.platformUtilsService.showToast('error', this.i18nService.t('errorOccurred'),
            //         this.i18nService.t(e.message))
            // }
        }
    }


    private async twoFaCheck(token: string, tab:any) {

        // if (this.token == null || this.token === '') {
        //     await BrowserApi.tabSendMessage(tab, {
        //         command   : 'menuAnswerRequest',
        //         subcommand: 'twoFaCheckNOK',
        //     })
        //     return;
        // }
        //
        // if (this.selectedProviderType === TwoFactorProviderType.U2f) {
        //     if (this.u2f != null) {
        //         this.u2f.stop();
        //     } else {
        //         return;
        //     }
        // } else if (this.selectedProviderType === TwoFactorProviderType.Email ||
        //     this.selectedProviderType === TwoFactorProviderType.Authenticator) {
        //     this.token = this.token.replace(' ', '').trim();
        // }

        try {
            const selectedProviderType = 1 // value observed in running code
            const remember = false         // value observed in running code
            const resp = await this.authService.logInTwoFactor(selectedProviderType, token, remember);
            // if (resp.value.twoFactor) {
            console.log('twoFaCheck resp', resp);
            console.log('               ', resp.twoFactor);

            if (resp.twoFactor) {
                // validation failed, a new token will be sent to the user.
                console.log('2FA validation failed');
                await BrowserApi.tabSendMessage(tab, {
                    command   : 'menuAnswerRequest',
                    subcommand: '2faCheckNOK',
                })
            } else {
                console.log('2FA validation succeeded');
                // validation succeeded, nothing to do
            }
        } catch (e) {
            // if (this.selectedProviderType === TwoFactorProviderType.U2f && this.u2f != null) {
            //     this.u2f.start();
            // }
        }
    }
}
