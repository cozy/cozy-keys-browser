import { DatePipe, Location } from "@angular/common";
/* Cozy custo
import { Component } from "@angular/core";
*/
import { Component, HostListener } from "@angular/core";
/* end custo */
import { ActivatedRoute, Router } from "@angular/router";
import qrcodeParser from "qrcode-parser";
import { firstValueFrom } from "rxjs";
import { first } from "rxjs/operators";

import { AddEditComponent as BaseAddEditComponent } from "@bitwarden/angular/vault/components/add-edit.component";
import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CollectionService } from "@bitwarden/common/vault/abstractions/collection.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { DialogService, ToastService } from "@bitwarden/components";
import { PasswordRepromptService } from "@bitwarden/vault";

import { BrowserApi } from "../../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../../platform/popup/browser-popup-utils";
import { PopupCloseWarningService } from "../../../../popup/services/popup-close-warning.service";
import { BrowserFido2UserInterfaceSession } from "../../../fido2/browser-fido2-user-interface.service";
import { Fido2UserVerificationService } from "../../../services/fido2-user-verification.service";
import { fido2PopoutSessionData$ } from "../../utils/fido2-popout-session-data";
import { closeAddEditVaultItemPopout, VaultPopoutType } from "../../utils/vault-popout-window";
/* Cozy imports */
/* eslint-disable */
import { CozyClientService } from "../../../../popup/services/cozyClient.service";
import { KonnectorsService } from "../../../../popup/services/konnectors.service";
import { HistoryService } from "../../../../popup/services/history.service";
import { deleteCipher } from "./cozy-utils";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
/* eslint-enable */
/* END */

@Component({
  selector: "app-vault-add-edit",
  templateUrl: "add-edit.component.html",
})

/**
 * See the original component:
 * https://github.com/bitwarden/browser/blob/
 * 7bfb8d91e3fcec00424d28410ef33401d582c3cc/src/popup/vault/add-edit.component.ts
 */
// eslint-disable-next-line rxjs-angular/prefer-takeuntil
export class AddEditComponent extends BaseAddEditComponent {
  currentUris: string[];
  openAttachmentsInPopup: boolean;
  showAutoFillOnPageLoadOptions: boolean;
  // Cozy customization
  //*
  typeOptions: any[];
  //*/

  private fido2PopoutSessionData$ = fido2PopoutSessionData$();

  constructor(
    cipherService: CipherService,
    folderService: FolderService,
    i18nService: I18nService,
    platformUtilsService: PlatformUtilsService,
    auditService: AuditService,
    accountService: AccountService,
    private autofillSettingsService: AutofillSettingsServiceAbstraction,
    collectionService: CollectionService,
    messagingService: MessagingService,
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    eventCollectionService: EventCollectionService,
    policyService: PolicyService,
    private popupCloseWarningService: PopupCloseWarningService,
    organizationService: OrganizationService,
    passwordRepromptService: PasswordRepromptService,
    logService: LogService,
    private konnectorsService: KonnectorsService,
    private historyService: HistoryService,
    private cozyClientService: CozyClientService,
    sendApiService: SendApiService,
    dialogService: DialogService,
    toastService: ToastService,
    datePipe: DatePipe,
    configService: ConfigService,
    private fido2UserVerificationService: Fido2UserVerificationService,
  ) {
    super(
      cipherService,
      folderService,
      i18nService,
      platformUtilsService,
      auditService,
      accountService,
      collectionService,
      messagingService,
      eventCollectionService,
      policyService,
      logService,
      passwordRepromptService,
      organizationService,
      sendApiService,
      dialogService,
      toastService,
      window,
      datePipe,
      configService,
    );
    this.typeOptions = [
      { name: i18nService.t("typeLogin"), value: CipherType.Login },
      { name: i18nService.t("typeCard"), value: CipherType.Card },
      { name: i18nService.t("typeIdentity"), value: CipherType.Identity },
    ];
  }

  @HostListener("window:keydown", ["$event"])
  handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      void this.cancel();
      event.preventDefault();
    } else if (event.key === "Enter" && event.getModifierState("Control")) {
      void this.submit();
    }
  }

  async ngOnInit() {
    await super.ngOnInit();

    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.queryParams.pipe(first()).subscribe(async (params: any) => {
      if (params.cipherId) {
        this.cipherId = params.cipherId;
      }
      if (params.folderId) {
        this.folderId = params.folderId;
      }
      if (params.collectionId) {
        const collection = this.writeableCollections.find((c) => c.id === params.collectionId);
        if (collection != null) {
          this.collectionIds = [collection.id];
          this.organizationId = collection.organizationId;
        }
      }
      if (params.type) {
        const type = parseInt(params.type, null);
        this.type = type;
      }
      this.editMode = !params.cipherId;

      if (params.cloneMode != null) {
        this.cloneMode = params.cloneMode === "true";
      }
      if (params.selectedVault) {
        this.organizationId = params.selectedVault;
      }

      await this.load();

      // Cozy customization
      //*
      if (params.tempCipher) {
        // the cipher was already in edition and popup has been closed or navigation in pwd generator
        // we have to select the correct pwd
        // first retrive data form url
        const cipherJson = JSON.parse(params.tempCipher);
        const histCipher = CipherView.fromJSON(cipherJson);
        Object.assign(this.cipher, histCipher);
      }
      // end custo */

      if (!this.editMode || this.cloneMode) {
        // Only allow setting username if there's no existing value
        if (
          params.username &&
          (this.cipher.login.username == null || this.cipher.login.username === "")
        ) {
          this.cipher.login.username = params.username;
        }

        if (params.name && (this.cipher.name == null || this.cipher.name === "")) {
          this.cipher.name = params.name;
        }
        if (
          params.uri &&
          this.cipher.login.uris[0] &&
          (this.cipher.login.uris[0].uri == null || this.cipher.login.uris[0].uri === "")
        ) {
          this.cipher.login.uris[0].uri = params.uri;
        }
      }

      this.openAttachmentsInPopup = BrowserPopupUtils.inPopup(window);

      if (this.inAddEditPopoutWindow()) {
        BrowserApi.messageListener("add-edit-popout", this.handleExtensionMessage.bind(this));
      }
    });

    if (!this.editMode) {
      const tabs = await BrowserApi.tabsQuery({ windowType: "normal" });
      this.currentUris =
        tabs == null
          ? null
          : tabs.filter((tab) => tab.url != null && tab.url !== "").map((tab) => tab.url);
    }

    this.setFocus();

    if (BrowserPopupUtils.inPopout(window)) {
      this.popupCloseWarningService.enable();
    }
  }

  /* Cozy custo
   note Cozy : beforeunload event would be better but is not triggered in webextension...
   see : https://stackoverflow.com/questions/2315863/does-onbeforeunload-event-trigger-for-popup-html-in-a-google-chrome-extension
  */
  @HostListener("window:unload", ["$event"])
  async unloadMnger(event: any) {
    this.historyService.saveTempCipherInHistory(this.cipher);
  }
  /* end custo */

  async load() {
    await super.load();
    this.showAutoFillOnPageLoadOptions =
      this.cipher.type === CipherType.Login &&
      (await firstValueFrom(this.autofillSettingsService.autofillOnPageLoad$));

    // Cozy customization, override the page title to include the Item's type
    // part of this code is copied from the parent's `load()` method
    //*
    const currentTypeKey = CipherType[this.type];

    this.editMode = this.cipherId != null;
    if (this.editMode) {
      this.editMode = true;
      if (this.cloneMode) {
        this.cloneMode = true;
        this.title = this.i18nService.t(`add${currentTypeKey}`);
      } else {
        this.title = this.i18nService.t(`edit${currentTypeKey}`);
      }
    } else {
      this.title = this.i18nService.t(`add${currentTypeKey}`);
    }
    //*/
  }

  async submit(): Promise<boolean> {
    const fido2SessionData = await firstValueFrom(this.fido2PopoutSessionData$);
    const { isFido2Session, sessionId, userVerification } = fido2SessionData;
    const inFido2PopoutWindow = BrowserPopupUtils.inPopout(window) && isFido2Session;

    // TODO: Revert to use fido2 user verification service once user verification for passkeys is approved for production.
    // PM-4577 - https://github.com/bitwarden/clients/pull/8746
    if (
      inFido2PopoutWindow &&
      !(await this.handleFido2UserVerification(sessionId, userVerification))
    ) {
      return false;
    }

    const success = await super.submit();
    if (!success) {
      return false;
    }

    if (BrowserPopupUtils.inPopout(window)) {
      this.popupCloseWarningService.disable();
    }

    if (inFido2PopoutWindow) {
      BrowserFido2UserInterfaceSession.confirmNewCredentialResponse(
        sessionId,
        this.cipher.id,
        userVerification,
      );
      return true;
    }

    if (this.inAddEditPopoutWindow()) {
      this.messagingService.send("addEditCipherSubmitted");
      await closeAddEditVaultItemPopout(1000);
      return true;
    }

    if (this.cloneMode) {
      /* Cozy customization : why should we go back to vault after cloning a cipher ?
         we prefer go back in history twice (from where the initial cipher has been opened)
      /*
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.router.navigate(["/tabs/vault"]);
      */
      this.historyService.gotoPreviousUrl(2);
      /* end custo */
    } else {
      /* Cozy customization
      this.location.back();
      */
      void this.konnectorsService.createSuggestions();
      this.historyService.gotoPreviousUrl();
      /* end custo */
    }
    return true;
  }

  attachments() {
    super.attachments();

    if (this.openAttachmentsInPopup) {
      const destinationUrl = this.router
        .createUrlTree(["/attachments"], { queryParams: { cipherId: this.cipher.id } })
        .toString();
      const currentBaseUrl = window.location.href.replace(this.router.url, "");
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      BrowserPopupUtils.openCurrentPagePopout(window, currentBaseUrl + destinationUrl);
    } else {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.router.navigate(["/attachments"], { queryParams: { cipherId: this.cipher.id } });
    }
  }

  editCollections() {
    super.editCollections();
    if (this.cipher.organizationId != null) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.router.navigate(["/collections"], { queryParams: { cipherId: this.cipher.id } });
    }
  }

  async cancel() {
    super.cancel();

    const sessionData = await firstValueFrom(this.fido2PopoutSessionData$);
    if (BrowserPopupUtils.inPopout(window) && sessionData.isFido2Session) {
      this.popupCloseWarningService.disable();
      BrowserFido2UserInterfaceSession.abortPopout(sessionData.sessionId);
      return;
    }

    if (this.inAddEditPopoutWindow()) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      closeAddEditVaultItemPopout();
      return;
    }
    /* Cozy customization
    this.location.back();
    */
    this.historyService.gotoPreviousUrl();
    //*/
  }

  async generateUsername(): Promise<boolean> {
    const confirmed = await super.generateUsername();
    if (confirmed) {
      await this.saveCipherState();
      // save cipher state in url for when popup will be closed.
      this.historyService.saveTempCipherInHistory(this.cipher);
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.router.navigate(["generator"], {
        queryParams: {
          type: "username",
          tempCipher: JSON.stringify(this.cipher),
        },
      });
    }
    return confirmed;
  }

  async generatePassword(): Promise<boolean> {
    const confirmed = await super.generatePassword();
    if (confirmed) {
      await this.saveCipherState();
      // save cipher state in url for when popup will be closed.
      this.historyService.saveTempCipherInHistory(this.cipher);
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.router.navigate(["generator"], {
        queryParams: { type: "password", tempCipher: JSON.stringify(this.cipher) },
      });
    }
    return confirmed;
  }

  /**
   * @override by Cozy
   * Calls the overrided deleteCipher
   */
  async delete(): Promise<boolean> {
    const confirmed = await deleteCipher(
      this.cipherService,
      this.i18nService,
      this.dialogService,
      this.toastService,
      this.cipher,
      this.cozyClientService,
      this.organizationService,
    );
    if (confirmed) {
      /* Cozy customization
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.router.navigate(["/tabs/vault"]);
      */
      this.historyService.gotoPreviousUrl();
    }
    return confirmed;
  }

  toggleUriInput(uri: LoginUriView) {
    const u = uri as any;
    u.showCurrentUris = !u.showCurrentUris;
  }

  allowOwnershipOptions(): boolean {
    return false; // Cozy custo : inactivate while submit doen't properly manage organizations & collections for Cozy
    return (
      (!this.editMode || this.cloneMode) &&
      this.ownershipOptions &&
      (this.ownershipOptions.length > 1 || !this.allowPersonal)
    );
  }

  private saveCipherState() {
    return this.cipherService.setAddEditCipherInfo({
      cipher: this.cipher,
      collectionIds:
        this.collections == null
          ? []
          : this.collections.filter((c) => (c as any).checked).map((c) => c.id),
    });
  }

  private setFocus() {
    window.setTimeout(() => {
      if (this.editMode) {
        return;
      }

      if (this.cipher.name != null && this.cipher.name !== "") {
        document.getElementById("loginUsername").focus();
      } else {
        document.getElementById("name").focus();
      }
    }, 200);
  }

  repromptChanged() {
    super.repromptChanged();

    if (!this.showAutoFillOnPageLoadOptions) {
      return;
    }

    if (this.reprompt) {
      this.platformUtilsService.showToast(
        "info",
        null,
        this.i18nService.t("passwordRepromptDisabledAutofillOnPageLoad"),
      );
      return;
    }

    this.platformUtilsService.showToast(
      "info",
      null,
      this.i18nService.t("autofillOnPageLoadSetToDefault"),
    );
  }

  private inAddEditPopoutWindow() {
    return BrowserPopupUtils.inSingleActionPopout(window, VaultPopoutType.addEditVaultItem);
  }

  async captureTOTPFromTab() {
    try {
      const screenshot = await BrowserApi.captureVisibleTab();
      const data = await qrcodeParser(screenshot);
      const url = new URL(data.toString());
      if (url.protocol == "otpauth:" && url.searchParams.has("secret")) {
        this.cipher.login.totp = data.toString();
        this.platformUtilsService.showToast(
          "success",
          null,
          this.i18nService.t("totpCaptureSuccess"),
        );
      }
    } catch (e) {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("totpCaptureError"),
      );
    }
  }

  private handleExtensionMessage(message: { [key: string]: any; command: string }) {
    if (message.command === "inlineAutofillMenuRefreshAddEditCipher") {
      this.load().catch((error) => this.logService.error(error));
    }
  }

  // TODO: Remove and use fido2 user verification service once user verification for passkeys is approved for production.
  private async handleFido2UserVerification(
    sessionId: string,
    userVerification: boolean,
  ): Promise<boolean> {
    // We are bypassing user verification pending approval for production.
    return true;
  }
}
