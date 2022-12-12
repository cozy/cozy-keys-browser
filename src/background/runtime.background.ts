import { EnvironmentService } from "jslib-common/abstractions/environment.service";
import { I18nService } from "jslib-common/abstractions/i18n.service";
import { LogService } from "jslib-common/abstractions/log.service";
import { MessagingService } from "jslib-common/abstractions/messaging.service";
import { NotificationsService } from "jslib-common/abstractions/notifications.service";
import { StorageService } from "jslib-common/abstractions/storage.service";
import { SystemService } from "jslib-common/abstractions/system.service";
import { ConstantsService } from "jslib-common/services/constants.service";

import { AutofillService } from "../services/abstractions/autofill.service";
import BrowserPlatformUtilsService from "../services/browserPlatformUtils.service";

import { BrowserApi } from "../browser/browserApi";

import MainBackground from "./main.background";

import { Utils } from "jslib-common/misc/utils";
import LockedVaultPendingNotificationsItem from "./models/lockedVaultPendingNotificationsItem";

// Cozy Imports
import { AuthService } from "../services/auth.service";
import { ApiService } from "jslib-common/abstractions/api.service";
import { CipherService } from "jslib-common/abstractions/cipher.service";
import { CipherType } from "jslib-common/enums/cipherType";
import { CozyClientService } from "src/popup/services/cozyClient.service";
import { CryptoService } from "jslib-common/abstractions/crypto.service";
import { EncString } from "jslib-common/models/domain/encString";
import { HashPurpose } from "jslib-common/enums/hashPurpose";
import { KonnectorsService } from "../popup/services/konnectors.service";
import { LocalConstantsService } from "../popup/services/constants.service";
import { PasswordRequest } from "jslib-common/models/request/passwordRequest";
import { SyncService } from "jslib-common/abstractions/sync.service";
import { UserService } from "jslib-common/abstractions/user.service";
import { VaultTimeoutService } from "jslib-common/abstractions/vaultTimeout.service";
// End Cozy imports

export default class RuntimeBackground {
  private autofillTimeout: any;
  private pageDetailsToAutoFill: any[] = [];
  private onInstalledReason: string = null;
  private lockedVaultPendingNotifications: LockedVaultPendingNotificationsItem[] = [];

  constructor(
    private main: MainBackground,
    private autofillService: AutofillService,
    private platformUtilsService: BrowserPlatformUtilsService,
    private storageService: StorageService,
    private i18nService: I18nService,
    private notificationsService: NotificationsService,
    private systemService: SystemService,
    private environmentService: EnvironmentService,
    private messagingService: MessagingService,
    private logService: LogService,
    private cozyClientService: CozyClientService,
    private konnectorsService: KonnectorsService,
    private syncService: SyncService,
    private authService: AuthService,
    private cryptoService: CryptoService,
    private apiService: ApiService,
    private cipherService: CipherService,
    private userService: UserService,
    private vaultTimeoutService: VaultTimeoutService
  ) {
    // onInstalled listener must be wired up before anything else, so we do it in the ctor
    chrome.runtime.onInstalled.addListener((details: any) => {
      this.onInstalledReason = details.reason;
    });
  }

  async init() {
    if (!chrome.runtime) {
      return;
    }

    await this.checkOnInstalled();
    BrowserApi.messageListener(
      "runtime.background",
      (msg: any, sender: chrome.runtime.MessageSender, sendResponse: any) => {
        this.processMessage(msg, sender, sendResponse);
      }
    );
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
      case "loggedIn":
      case "unlocked":
        let item: LockedVaultPendingNotificationsItem;
        let enableInPageMenu: boolean;
        let allTabs: chrome.tabs.Tab[];

        if (this.lockedVaultPendingNotifications.length > 0) {
          await BrowserApi.closeLoginTab();

          item = this.lockedVaultPendingNotifications.pop();
          if (item.commandToRetry.sender?.tab?.id) {
            await BrowserApi.focusSpecifiedTab(item.commandToRetry.sender.tab.id);
          }
        }

        await this.main.setIcon();
        await this.main.refreshBadgeAndMenu(false);
        // this.notificationsService.init(); // TODO BJA : removed from upstream
        this.notificationsService.updateConnection(msg.command === "unlocked");
        this.systemService.cancelProcessReload();

        // Cozy insertion
        await this.cozyClientService.createClient();

        // ask notificationbar of all tabs to retry to collect pageDetails in order to activate in-page-menu
        enableInPageMenu = await this.storageService.get<boolean>(
          LocalConstantsService.enableInPageMenuKey
        );
        if (enableInPageMenu === null) {
          // if not yet set, then default to true
          enableInPageMenu = true;
        }
        let subCommand = "inPageMenuDeactivate";
        if (enableInPageMenu) {
          subCommand = "autofilIPMenuActivate";
        }
        await this.syncService.fullSync(true);
        allTabs = await BrowserApi.getAllTabs();
        for (const tab of allTabs) {
          BrowserApi.tabSendMessage(tab, {
            command: "autofillAnswerRequest",
            subcommand: subCommand,
          });
        }
        // end Cozy insertion

        if (item) {
          await BrowserApi.tabSendMessageData(
            item.commandToRetry.sender.tab,
            "unlockCompleted",
            item
          );
        }
        break;
      case "logout":
        // 1- logout
        await this.cozyClientService.logout();
        await this.authService.clear(); // moved from the logout to avoid potential infinite loop
        await this.main.logout(msg.expired);
        // 2- ask all frames of all tabs to activate login-in-page-menu
        allTabs = await BrowserApi.getAllTabs();
        for (const tab of allTabs) {
          BrowserApi.tabSendMessage(tab, {
            command: "autofillAnswerRequest",
            subcommand: "loginIPMenuActivate",
          });
        }
        break;
      case "syncCompleted":
        if (msg.successfully) {
          setTimeout(async () => await this.main.refreshBadgeAndMenu(), 2000);
        }
        break;
      case "fullSync":
        this.syncService.fullSync(true);
        break;
      case "openPopup":
        await this.main.openPopup();
        break;
      case "promptForLogin":
        await BrowserApi.createNewTab("popup/index.html?uilocation=popout", true, true);
        break;
      case "showDialogResolve":
        this.platformUtilsService.resolveDialogPromise(msg.dialogId, msg.confirmed);
        break;
      case "bgCollectPageDetails":
        await this.main.collectPageDetailsForContentScript(sender.tab, msg.sender, sender.frameId);
        break;
      case "bgAnswerMenuRequest":
        switch (msg.subcommand) {
          case "getCiphersForTab":
            const logins = await this.cipherService.getAllDecryptedForUrl(sender.tab.url, null);
            logins.sort((a, b) => this.cipherService.sortCiphersByLastUsedThenName(a, b));
            const allCiphers = await this.cipherService.getAllDecrypted();
            const ciphers = { logins: logins, cards: new Array(), identities: new Array() };
            for (const cipher of allCiphers) {
              if (cipher.isDeleted) {
                continue;
              }
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
            await BrowserApi.tabSendMessageData(sender.tab, "updateMenuCiphers", {
              ciphers: ciphers,
              cozyUrl: cozyUrl,
            });
            break;
          case "closeMenu":
            await BrowserApi.tabSendMessage(sender.tab, {
              command: "autofillAnswerRequest",
              subcommand: "closeMenu",
              force: msg.force,
            }); // don't add the frameId, since the emiter (menu) is not the target...
            break;
          case "setMenuHeight":
            await BrowserApi.tabSendMessage(sender.tab, {
              command: "autofillAnswerRequest",
              subcommand: "setMenuHeight",
              height: msg.height,
            }); // don't add the frameId, since the emiter (menu) is not the target...
            break;
          case "fillFormWithCipher":
            await BrowserApi.tabSendMessage(sender.tab, {
              command: "autofillAnswerRequest",
              subcommand: "fillFormWithCipher",
              cipherId: msg.cipherId,
            });
            break;
          case "menuMoveSelection":
            await BrowserApi.tabSendMessage(sender.tab, {
              command: "menuAnswerRequest",
              subcommand: "menuSetSelectionOnCipher",
              targetCipher: msg.targetCipher,
            });
            break;
          case "login":
            await this.logIn(msg.email, msg.pwd, sender.tab, msg.loginUrl);
            break;
          case "unlock":
            await this.unlock(msg.email, msg.pwd, sender.tab, msg.loginUrl);
            break;
          case "unPinlock":
            await this.unPinlock(msg.email, msg.pwd, sender.tab, msg.loginUrl);
            break;
          case "2faCheck":
            await this.twoFaCheck(msg.token, sender.tab);
            break;
          case "getRememberedCozyUrl":
            let rememberedCozyUrl = await this.storageService.get<string>("rememberedCozyUrl");
            if (!rememberedCozyUrl) {
              rememberedCozyUrl = "";
            }
            await BrowserApi.tabSendMessage(sender.tab, {
              command: "menuAnswerRequest",
              subcommand: "setRememberedCozyUrl",
              rememberedCozyUrl: rememberedCozyUrl,
            }); // don't add the frameId, since the emiter (menu) is not the target...
            break;
          case "fieldFillingWithData":
            await BrowserApi.tabSendMessage(
              sender.tab,
              {
                command: "fieldFillingWithData",
                opId: msg.opId,
                data: msg.data,
              },
              { frameId: msg.frameId }
            );
            break;
          case "askMenuTofillFieldWithData":
            await BrowserApi.tabSendMessage(sender.tab, {
              command: "menuAnswerRequest",
              subcommand: "trigerFillFieldWithData",
              frameTargetId: sender.frameId,
            });
            break;
        }
        break;
      //             case 'bgGetCiphersForTab': // todo BJA : supprimé de l'upstream ! laissé pour voir, supprimer qd ok.
      //             case 'bgAddLogin':         // todo BJA : supprimé de l'upstream !
      //                await this.addLogin(msg.login, sender.tab);
      //                break;
      case "bgUpdateContextMenu":
      case "editedCipher":
      case "addedCipher":
      case "deletedCipher":
        await this.main.refreshBadgeAndMenu();
        break;
      case "bgReseedStorage":
        await this.main.reseedStorage();
        break;
      case "bgGetLoginMenuFillScript":
        // addon has been disconnected or the page was loaded while addon was not connected
        enableInPageMenu = await this.storageService.get<boolean>(
          LocalConstantsService.enableInPageMenuKey
        );
        if (enableInPageMenu === null) {
          enableInPageMenu = true;
        }
        if (!enableInPageMenu) {
          break;
        }
        const fieldsForInPageMenuScripts =
          await this.autofillService.generateFieldsForInPageMenuScripts(
            msg.pageDetails,
            false,
            sender.frameId
          );
        this.autofillService.postFilterFieldsForInPageMenu(
          fieldsForInPageMenuScripts,
          msg.pageDetails.forms,
          msg.pageDetails.fields
        );
        const isAuthenticated = await this.userService.isAuthenticated(); // = connected or installed
        const isLocked = isAuthenticated && (await this.vaultTimeoutService.isLocked());
        const pinSet = await this.vaultTimeoutService.isPinLockSet();
        const isPinLocked =
          (pinSet[0] && this.vaultTimeoutService.pinProtectedKey != null) || pinSet[1];
        await BrowserApi.tabSendMessage(
          sender.tab,
          {
            command: "autofillAnswerRequest",
            subcommand: "loginIPMenuSetFields",
            fieldsForInPageMenuScripts: fieldsForInPageMenuScripts,
            isPinLocked: isPinLocked,
            isLocked: isLocked,
            frameId: sender.frameId,
          },
          { frameId: sender.frameId }
        );
        break;
      case "bgGetAutofillMenuScript":
        // If goes here : means that addon has just been connected (page was already loaded)
        const script = await this.autofillService.generateFieldsForInPageMenuScripts(
          msg.details,
          true,
          sender.frameId
        );
        await this.autofillService.doAutoFillActiveTab(
          [
            {
              frameId: sender.frameId,
              tab: sender.tab,
              details: msg.details,
              fieldsForInPageMenuScripts: script,
              sender: "notifBarForInPageMenu", // to prepare a fillscript for the in-page-menu
            },
          ],
          true
        );
        break;
      case "collectPageDetailsResponse":
        switch (msg.sender) {
          case "autofiller":
          case "autofill_cmd":
            const totpCode = await this.autofillService.doAutoFillActiveTab(
              [
                {
                  frameId: sender.frameId,
                  tab: msg.tab,
                  details: msg.details,
                  sender: msg.sender,
                },
              ],
              msg.sender === "autofill_cmd"
            );
            if (totpCode != null) {
              this.platformUtilsService.copyToClipboard(totpCode, { window: window });
            }
            break;

          // autofill request for a specific cipher from menu.js
          case "autofillForMenu.js":
            const tab = await BrowserApi.getTabFromCurrentWindow();
            const c = await this.cipherService.get(msg.cipherId);
            const cipher = await c.decrypt();
            const totpCode2 = await this.autofillService.doAutoFill({
              cipher: cipher,
              pageDetails: [
                {
                  frameId: sender.frameId,
                  tab: tab,
                  details: msg.details,
                },
              ],
            });
            if (totpCode2 != null) {
              this.platformUtilsService.copyToClipboard(totpCode2, { window: window });
            }
            break;

          case "contextMenu":
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
      case "authResult":
        const vaultUrl = this.environmentService.getWebVaultUrl();

        if (msg.referrer == null || Utils.getHostname(vaultUrl) !== msg.referrer) {
          return;
        }

        try {
          BrowserApi.createNewTab(
            "popup/index.html?uilocation=popout#/sso?code=" +
              encodeURIComponent(msg.code) +
              "&state=" +
              encodeURIComponent(msg.state)
          );
        } catch {
          this.logService.error("Unable to open sso popout tab");
        }
        break;
      case "webAuthnResult":
        const vaultUrl2 = this.environmentService.getWebVaultUrl();

        if (msg.referrer == null || Utils.getHostname(vaultUrl2) !== msg.referrer) {
          return;
        }

        const params =
          `webAuthnResponse=${encodeURIComponent(msg.data)};` +
          `remember=${encodeURIComponent(msg.remember)}`;
        BrowserApi.createNewTab(
          `popup/index.html?uilocation=popout#/2fa;${params}`,
          undefined,
          false
        );
        break;
      case "reloadPopup":
        this.messagingService.send("reloadPopup");
        break;
      case "emailVerificationRequired":
        this.messagingService.send("showDialog", {
          dialogId: "emailVerificationRequired",
          title: this.i18nService.t("emailVerificationRequired"),
          text: this.i18nService.t("emailVerificationRequiredDesc"),
          confirmText: this.i18nService.t("ok"),
          type: "info",
        });
        break;
      case "getClickedElementResponse":
        this.platformUtilsService.copyToClipboard(msg.identifier, { window: window });
      default:
        break;
    }
  }

  private async autofillPage() {
    const totpCode = await this.autofillService.doAutoFill({
      cipher: this.main.loginToAutoFill,
      pageDetails: this.pageDetailsToAutoFill,
      fillNewPassword: true,
    });

    if (totpCode != null) {
      this.platformUtilsService.copyToClipboard(totpCode, { window: window });
    }

    // reset
    this.main.loginToAutoFill = null;
    this.pageDetailsToAutoFill = [];
  }

  private async checkOnInstalled() {
    setTimeout(async () => {
      if (this.onInstalledReason != null) {
        if (this.onInstalledReason === "install") {
          // BrowserApi.createNewTab("https://bitwarden.com/browser-start/");
          await this.setDefaultSettings();
        }

        // Execute the content-script on all tabs in case cozy-passwords is waiting for an answer
        const allTabs = await BrowserApi.getAllTabs();
        for (const tab of allTabs) {
          chrome.tabs.executeScript(tab.id, { file: "content/appInfo.js" });
        }
        this.onInstalledReason = null;
      }
    }, 100);
  }

  private async setDefaultSettings() {
    // Default timeout option to "on restart".
    const currentVaultTimeout = await this.storageService.get<number>(
      LocalConstantsService.vaultTimeoutKey
    );
    if (currentVaultTimeout == null) {
      await this.storageService.save(LocalConstantsService.vaultTimeoutKey, -1);
    }

    // Default action to "lock".
    const currentVaultTimeoutAction = await this.storageService.get<string>(
      LocalConstantsService.vaultTimeoutActionKey
    );
    if (currentVaultTimeoutAction == null) {
      await this.storageService.save(LocalConstantsService.vaultTimeoutActionKey, "lock");
    }
  }

  /*
    @override by Cozy
    this function is based on the submit() function in src\popup\accounts\login.component.ts
    */
  private async logIn(email: string, pwd: string, tab: any, loginUrl: string) {
    try {
      // This adds the scheme if missing
      await this.environmentService.setUrls({
        base: loginUrl + "/bitwarden",
      });
      // logIn
      const response = await this.authService.logIn(email, pwd);

      if (response.twoFactor) {
        await BrowserApi.tabSendMessage(tab, {
          command: "autofillAnswerRequest",
          subcommand: "2faRequested",
        });
      } else {
        // Save the URL for next time (default to yes)
        let rememberCozyUrl = await this.storageService.get<boolean>("rememberCozyUrl");
        if (rememberCozyUrl == null) {
          rememberCozyUrl = true;
        }
        if (rememberCozyUrl) {
          await this.storageService.save("rememberedCozyUrl", loginUrl);
        } else {
          await this.storageService.remove("rememberedCozyUrl");
        }
        await BrowserApi.tabSendMessage(tab, {
          command: "menuAnswerRequest",
          subcommand: "loginOK",
        });
        // when login is processed on background side, then your messages are not receivend by the background,
        // so you need to triger yourself "loggedIn" actions
        this.processMessage({ command: "loggedIn" }, "runtime.background.ts.login()", null);
      }
    } catch (e) {
      await BrowserApi.tabSendMessage(tab, {
        command: "menuAnswerRequest",
        subcommand: "loginNOK",
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
    const storedKeyHash = await this.cryptoService.getKeyHash();

    let passwordValid = false;

    if (storedKeyHash != null) {
      passwordValid = await this.cryptoService.compareAndUpdateKeyHash(pwd, key);
    } else {
      const request = new PasswordRequest();
      const serverKeyHash = await this.cryptoService.hashPassword(
        pwd,
        key,
        HashPurpose.ServerAuthorization
      );
      request.masterPasswordHash = serverKeyHash;
      try {
        await this.apiService.postAccountVerifyPassword(request);
        passwordValid = true;
        const localKeyHash = await this.cryptoService.hashPassword(
          pwd,
          key,
          HashPurpose.LocalAuthorization
        );
        await this.cryptoService.setKeyHash(localKeyHash);
      } catch {}
    }

    if (passwordValid) {
      await this.cryptoService.setKey(key);
      await BrowserApi.tabSendMessage(tab, {
        command: "menuAnswerRequest",
        subcommand: "loginOK",
      });
      // when unlock is processed on background side, then your messages are not receivend by the background,
      // so you need to triger yourself "loggedIn" actions
      this.processMessage({ command: "unlocked" }, "runtime.background.ts.unlock()", null);
    } else {
      await BrowserApi.tabSendMessage(tab, {
        command: "menuAnswerRequest",
        subcommand: "loginNOK",
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
        const key = await this.cryptoService.makeKeyFromPin(
          pin,
          email,
          kdf,
          kdfIterations,
          this.vaultTimeoutService.pinProtectedKey
        );
        const encKey = await this.cryptoService.getEncKey(key);
        const protectedPin = await this.storageService.get<string>(ConstantsService.protectedPin);
        const decPin = await this.cryptoService.decryptToUtf8(new EncString(protectedPin), encKey);

        failed = decPin !== pin;

        if (!failed) {
          await this.cryptoService.setKey(key);
          this.processMessage({ command: "unlocked" }, "runtime.background.ts.unPinlock()", null);
        }
      } else {
        const key = await this.cryptoService.makeKeyFromPin(pin, email, kdf, kdfIterations);
        failed = false;
        await this.cryptoService.setKey(key);
        this.processMessage({ command: "unlocked" }, "runtime.background.ts.unlock()", null);
      }
    } catch {
      failed = true;
    }

    if (failed) {
      this.invalidPinAttempts++;
      if (this.invalidPinAttempts >= 5) {
        // this.messagingService.send('logout');
        this.processMessage({ command: "logout" }, "runtime.background.ts.unlock()", null);
        return;
      }
      await BrowserApi.tabSendMessage(tab, {
        command: "menuAnswerRequest",
        subcommand: "loginNOK",
      });
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("invalidPin")
      );
    }
  }

  /*
    @override by Cozy
    this function is based on the submit() function in jslib/src/angular/components/two-factor.component.ts
    */
  private async twoFaCheck(token: string, tab: any) {
    try {
      const selectedProviderType = 1; // value observed in running code
      const remember = false; // value observed in running code
      const resp = await this.authService.logInTwoFactor(selectedProviderType, token, remember);

      if (resp.twoFactor) {
        // validation failed, a new token will be sent to the user.
        await BrowserApi.tabSendMessage(tab, {
          command: "menuAnswerRequest",
          subcommand: "2faCheckNOK",
        });
      } else {
        // validation succeeded
        this.processMessage({ command: "loggedIn" }, "runtime.background.ts.twoFaCheck()", null);
      }
    } catch (e) {}
  }
}
