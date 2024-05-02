import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/abstractions/messaging.service";
import { NotificationsService } from "@bitwarden/common/abstractions/notifications.service";
import { SystemService } from "@bitwarden/common/abstractions/system.service";
import { Utils } from "@bitwarden/common/misc/utils";

import { AutofillService } from "../autofill/services/abstractions/autofill.service";
import { BrowserApi } from "../browser/browserApi";
import { BrowserEnvironmentService } from "../services/browser-environment.service";
import BrowserPlatformUtilsService from "../services/browserPlatformUtils.service";

import MainBackground from "./main.background";
import LockedVaultPendingNotificationsItem from "./models/lockedVaultPendingNotificationsItem";

// Cozy Imports
/* eslint-disable */
import { AuthService } from "@bitwarden/common/auth/services/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { CipherWithIdExport as CipherExport } from "@bitwarden/common/models/export/cipher-with-ids.export";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CozyClientService } from "src/popup/services/cozyClient.service";
import { CryptoService } from "@bitwarden/common/abstractions/crypto.service";
import { EncString } from "@bitwarden/common/models/domain/enc-string";
import { HashPurpose } from "@bitwarden/common/enums/hashPurpose";
import { PasswordRequest } from "@bitwarden/common/auth/models/request/password.request";
import { PasswordLogInCredentials } from "@bitwarden/common/auth/models/domain/log-in-credentials";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { BrowserStateService as StateService } from "src/services/browser-state.service";
import { VaultTimeoutService } from "@bitwarden/common/abstractions/vaultTimeout/vaultTimeout.service";
import { VaultTimeoutSettingsService } from "@bitwarden/common/abstractions/vaultTimeout/vaultTimeoutSettings.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
/* eslint-enable */
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
    private i18nService: I18nService,
    private notificationsService: NotificationsService,
    private systemService: SystemService,
    private environmentService: BrowserEnvironmentService,
    private messagingService: MessagingService,
    private stateService: StateService,
    private logService: LogService,
    private syncService: SyncService,
    private authService: AuthService,
    private cryptoService: CryptoService,
    private apiService: ApiService,
    private cipherService: CipherService,
    private cozyClientService: CozyClientService,
    private vaultTimeoutSettingsService: VaultTimeoutSettingsService
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
    const backgroundMessageListener = async (
      msg: any,
      sender: chrome.runtime.MessageSender,
      sendResponse: any
    ) => {
      await this.processMessage(msg, sender, sendResponse);
    };

    BrowserApi.messageListener("runtime.background", backgroundMessageListener);
    if (this.main.popupOnlyContext) {
      (window as any).bitwardenBackgroundMessageListener = backgroundMessageListener;
    }
  }

  async processMessage(msg: any, sender: chrome.runtime.MessageSender, sendResponse: any) {
    /*
      Cozy custo : this log is very useful for reverse engineering the code, keep it for tests
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
      case "unlocked": {
        let item: LockedVaultPendingNotificationsItem;

        if (this.lockedVaultPendingNotifications?.length > 0) {
          item = this.lockedVaultPendingNotifications.pop();
          BrowserApi.closeBitwardenExtensionTab();
        }

        await this.main.refreshBadge();
        await this.main.refreshMenu(false);
        this.notificationsService.updateConnection(msg.command === "unlocked");
        this.systemService.cancelProcessReload();

        // Cozy insertion
        await this.cozyClientService.createClient();

        // ask notificationbar of all tabs to retry to collect pageDetails in order to activate in-page-menu
        const enableInPageMenu = await this.stateService.getEnableInPageMenu();
        let subCommand = "inPageMenuDeactivate";
        if (enableInPageMenu) {
          subCommand = "autofilIPMenuActivate";
        }
        for (const tab of await BrowserApi.getAllTabs()) {
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
      }
      case "addToLockedVaultPendingNotifications":
        this.lockedVaultPendingNotifications.push(msg.data);
        break;
      case "logout":
        // 1- logout
        await this.main.logout(msg.expired, msg.userId);
        // 2- ask all frames of all tabs to activate login-in-page-menu
        for (const tab of await BrowserApi.getAllTabs()) {
          BrowserApi.tabSendMessage(tab, {
            command: "autofillAnswerRequest",
            subcommand: "loginIPMenuActivate",
          });
        }
        break;
      case "syncCompleted":
        if (msg.successfully) {
          setTimeout(async () => {
            await this.main.refreshBadge();
            await this.main.refreshMenu();
          }, 2000);
          this.main.avatarUpdateService.loadColorFromState();
        }
        break;
      case "fullSync":
        this.syncService.fullSync(true);
        break;
      case "openPopup":
        await this.main.openPopup();
        break;
      case "promptForLogin":
        BrowserApi.openBitwardenExtensionTab("popup/index.html", true, sender.tab);
        break;
      case "openAddEditCipher": {
        const addEditCipherUrl =
          msg.data?.cipherId == null
            ? "popup/index.html#/edit-cipher"
            : "popup/index.html#/edit-cipher?cipherId=" + msg.data.cipherId;

        BrowserApi.openBitwardenExtensionTab(addEditCipherUrl, true, sender.tab);
        break;
      }
      case "closeTab":
        setTimeout(() => {
          BrowserApi.closeBitwardenExtensionTab();
        }, msg.delay ?? 0);
        break;
      case "showDialogResolve":
        this.platformUtilsService.resolveDialogPromise(msg.dialogId, msg.confirmed);
        break;
      case "bgCollectPageDetails":
        await this.main.collectPageDetailsForContentScript(sender.tab, msg.sender, sender.frameId);
        break;
      case "bgAnswerMenuRequest":
        switch (msg.subcommand) {
          case "getCiphersForTab": {
            const logins = await this.cipherService.getAllDecryptedForUrl(sender.tab.url, null);
            logins.sort((a, b) => this.cipherService.sortCiphersByLastUsedThenName(a, b));
            const allCiphers = await this.cipherService.getAllDecrypted();
            const ciphers = {
              logins: logins,
              cards: [] as Array<CipherExport>,
              identities: [] as Array<CipherView>,
              contacts: [] as Array<CipherView>,
            };
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
                case CipherType.Contact:
                  if (cipher.contact.me) {
                    ciphers.contacts.unshift(cipher);
                  } else if (cipher.favorite) {
                    ciphers.contacts.push(cipher);
                  }
                  break;
              }
            }
            const cozyUrl = new URL(this.environmentService.getWebVaultUrl()).origin;
            await BrowserApi.tabSendMessageData(sender.tab, "updateMenuCiphers", {
              ciphers: ciphers,
              cozyUrl: cozyUrl,
            });
            break;
          }
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
          case "getRememberedCozyUrl": {
            let rememberedCozyUrl = await this.stateService.getRememberedEmail();

            rememberedCozyUrl = await this.stateService.getRememberedEmail();
            if (!rememberedCozyUrl) {
              rememberedCozyUrl = "";
            }
            await BrowserApi.tabSendMessage(sender.tab, {
              command: "menuAnswerRequest",
              subcommand: "setRememberedCozyUrl",
              rememberedCozyUrl: rememberedCozyUrl,
            }); // don't add the frameId, since the emiter (menu) is not the target...
            break;
          }
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
      case "bgUpdateContextMenu":
      case "editedCipher":
      case "addedCipher":
      case "deletedCipher":
        await this.main.refreshBadge();
        await this.main.refreshMenu();
        break;
      case "bgReseedStorage":
        await this.main.reseedStorage();
        break;
      case "bgGetLoginMenuFillScript": {
        // addon has been disconnected or the page was loaded while addon was not connected
        const enableInPageMenu = await this.stateService.getEnableInPageMenu();
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
        const isAuthenticated = await this.stateService.getIsAuthenticated(); // = connected or installed
        const authStatus = await this.authService.getAuthStatus();
        const isLocked = isAuthenticated && authStatus === AuthenticationStatus.Locked;
        const pinSet = await this.vaultTimeoutSettingsService.isPinLockSet();
        const isPinLocked = (pinSet[0] && this.stateService.getProtectedPin != null) || pinSet[1];
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
      }
      case "bgGetAutofillMenuScript": {
        // If goes here : means that addon has just been connected (page was already loaded)
        const activateMenu = async () => {
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
        };
        this.syncService.fullSync(false).then(activateMenu.bind(this));
        await activateMenu();
        break;
      }
      case "collectPageDetailsResponse":
        switch (msg.sender) {
          case "notificationBar": {
            /* auttofill.js sends the page details requested by the notification bar.
                Result will be used by both the notificationBar and for the inPageMenu.
                inPageMenu requires a fillscrip to know wich fields are relevant for the menu and which
                is the type of each field in order to adapt the menu content (cards, identities, login or
                existing logins)
              */
            // 1- request a fill script for the in-page-menu (if activated)
            let enableInPageMenu = await this.stateService.getEnableInPageMenu();
            // default to true
            if (enableInPageMenu === null) {
              enableInPageMenu = true;
            }
            if (enableInPageMenu) {
              // If goes here : means that the page has just been loaded while addon was already connected
              // get scripts for logins, cards and identities

              const fieldsForAutofillMenuScripts =
                await this.autofillService.generateFieldsForInPageMenuScripts(
                  msg.details,
                  true,
                  sender.frameId
                );
              // get script for existing logins.
              // the 4 scripts (existing logins, logins, cards and identities) will be sent
              // to autofill.js by autofill.service
              try {
                await this.autofillService.doAutoFillActiveTab(
                  [
                    {
                      frameId: sender.frameId,
                      tab: msg.tab,
                      details: msg.details,
                      fieldsForInPageMenuScripts: fieldsForAutofillMenuScripts,
                      sender: "notifBarForInPageMenu", // to prepare a fillscript for the in-page-menu
                    },
                  ],
                  true
                );
              } catch (error) {
                // the `doAutoFillActiveTab` is run in a `try` because the original BW code
                // casts an error when no autofill is detected;
              }
            }
            // 2- send page details to the notification bar
            const forms = this.autofillService.getFormsWithPasswordFields(msg.details);
            await BrowserApi.tabSendMessageData(msg.tab, "notificationBarPageDetails", {
              details: msg.details,
              forms: forms,
            });

            break;
          }
          case "autofiller":
          case "autofill_cmd": {
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
          }

          // autofill request for a specific cipher from menu.js
          case "autofillForMenu.js": {
            const tab = await BrowserApi.getTabFromCurrentWindow();
            const c = await this.cipherService.get(msg.cipherId);
            const cipher = await c.decrypt();
            const totpCode2 = await this.autofillService.doAutoFill({
              cipher: cipher,
              tab: null,
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
              BrowserApi.tabSendMessageData(tab, "openNotificationBar", {
                type: "TOTPCopied",
                typeData: {},
              });
            }
            break;
          }
          case "contextMenu":
            clearTimeout(this.autofillTimeout);
            this.pageDetailsToAutoFill.push({
              frameId: sender.frameId,
              tab: msg.tab,
              details: msg.details,
            });
            this.autofillTimeout = setTimeout(async () => await this.autofillPage(msg.tab), 300);
            break;
          default:
            break;
        }
        break;
      case "authResult": {
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
      }
      case "webAuthnResult": {
        const vaultUrl = this.environmentService.getWebVaultUrl();

        if (msg.referrer == null || Utils.getHostname(vaultUrl) !== msg.referrer) {
          return;
        }

        const params =
          `webAuthnResponse=${encodeURIComponent(msg.data)};` +
          `remember=${encodeURIComponent(msg.remember)}`;
        BrowserApi.openBitwardenExtensionTab(`popup/index.html#/2fa;${params}`, false);
        break;
      }
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
        break;
      default:
        break;
    }
  }

  private async autofillPage(tabToAutoFill: chrome.tabs.Tab) {
    const totpCode = await this.autofillService.doAutoFill({
      tab: tabToAutoFill,
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
          /* Cozy custo (commented)
          BrowserApi.createNewTab("https://bitwarden.com/browser-start/");

          if (await this.environmentService.hasManagedEnvironment()) {
            await this.environmentService.setUrlsToManagedEnvironment();
          }
        end custo */
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
      const cred = new PasswordLogInCredentials(email, pwd, null, null);
      const response = await this.authService.logIn(cred);

      if (response.requiresTwoFactor) {
        await BrowserApi.tabSendMessage(tab, {
          command: "autofillAnswerRequest",
          subcommand: "2faRequested",
        });
      } else {
        await this.stateService.setRememberedEmail(loginUrl);
        await BrowserApi.tabSendMessage(tab, {
          command: "menuAnswerRequest",
          subcommand: "loginOK",
        });
        // when login is processed on background side, then your messages are not receivend by the background,
        // so you need to triger yourself "loggedIn" actions
        this.processMessage(
          { command: "loggedIn" },
          "runtime.background.ts.login()" as chrome.runtime.MessageSender,
          null
        );
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
    const kdf = await this.stateService.getKdfType();
    // const kdfIterations = await this.stateService.getKdfIterations();
    const kdfConfig = await this.stateService.getKdfConfig();
    const key = await this.cryptoService.makeKey(pwd, email, kdf, kdfConfig);
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
      } catch {
        //
      }
    }

    if (passwordValid) {
      await this.cryptoService.setKey(key);
      await BrowserApi.tabSendMessage(tab, {
        command: "menuAnswerRequest",
        subcommand: "loginOK",
      });
      // when unlock is processed on background side, then your messages are not receivend by the background,
      // so you need to triger yourself "loggedIn" actions
      this.processMessage(
        { command: "unlocked" },
        "runtime.background.ts.unlock()" as chrome.runtime.MessageSender,
        null
      );
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
    const kdf = await this.stateService.getKdfType();
    // const kdfIterations = await this.stateService.getKdfIterations();
    const kdfConfig = await this.stateService.getKdfConfig();
    const pinSet = await this.vaultTimeoutSettingsService.isPinLockSet();
    let failed = true;
    try {
      if (pinSet[0]) {
        const key = await this.cryptoService.makeKeyFromPin(
          pin,
          email,
          kdf,
          kdfConfig,
          await this.stateService.getDecryptedPinProtected()
        );
        const encKey = await this.cryptoService.getEncKey(key);
        const protectedPin = await this.stateService.getProtectedPin();
        const decPin = await this.cryptoService.decryptToUtf8(new EncString(protectedPin), encKey);

        failed = decPin !== pin;

        if (!failed) {
          await this.cryptoService.setKey(key);
          this.processMessage(
            { command: "unlocked" },
            "runtime.background.ts.unPinlock()" as chrome.runtime.MessageSender,
            null
          );
        }
      } else {
        const key = await this.cryptoService.makeKeyFromPin(pin, email, kdf, kdfConfig);
        failed = false;
        await this.cryptoService.setKey(key);
        this.processMessage(
          { command: "unlocked" },
          "runtime.background.ts.unlock()" as chrome.runtime.MessageSender,
          null
        );
      }
    } catch {
      failed = true;
    }

    if (failed) {
      this.invalidPinAttempts++;
      if (this.invalidPinAttempts >= 5) {
        // this.messagingService.send('logout');
        this.processMessage(
          { command: "logout" },
          "runtime.background.ts.unlock()" as chrome.runtime.MessageSender,
          null
        );
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
      await this.authService.logInTwoFactor(
        {
          provider: selectedProviderType,
          token,
          remember,
        },
        null
      );
      // validation succeeded
      this.processMessage(
        { command: "loggedIn" },
        "runtime.background.ts.twoFaCheck()" as chrome.runtime.MessageSender,
        null
      );
    } catch (e) {
      await BrowserApi.tabSendMessage(tab, {
        command: "menuAnswerRequest",
        subcommand: "2faCheckNOK",
      });
    }
  }
}
