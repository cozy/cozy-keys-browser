import { Location } from "@angular/common";
/* Cozy custo
import { Component } from "@angular/core";
*/
import { Component, HostListener } from "@angular/core";
/* end custo */
import { ActivatedRoute, Router } from "@angular/router";
import { first } from "rxjs/operators";

import { AddEditComponent as BaseAddEditComponent } from "@bitwarden/angular/vault/components/add-edit.component";
import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { CollectionService } from "@bitwarden/common/abstractions/collection.service";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/abstractions/messaging.service";
import { OrganizationService } from "@bitwarden/common/abstractions/organization/organization.service.abstraction";
import { PlatformUtilsService } from "@bitwarden/common/abstractions/platformUtils.service";
import { PolicyService } from "@bitwarden/common/abstractions/policy/policy.service.abstraction";
import { StateService } from "@bitwarden/common/abstractions/state.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { PasswordRepromptService } from "@bitwarden/common/vault/abstractions/password-reprompt.service";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";

import { BrowserApi } from "../../../../browser/browserApi";
import { PopupUtilsService } from "../../../../popup/services/popup-utils.service";
/* Cozy imports */
/* eslint-disable */
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

  constructor(
    cipherService: CipherService,
    folderService: FolderService,
    i18nService: I18nService,
    platformUtilsService: PlatformUtilsService,
    auditService: AuditService,
    stateService: StateService,
    collectionService: CollectionService,
    messagingService: MessagingService,
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    eventCollectionService: EventCollectionService,
    policyService: PolicyService,
    private popupUtilsService: PopupUtilsService,
    organizationService: OrganizationService,
    passwordRepromptService: PasswordRepromptService,
    logService: LogService,
    private konnectorsService: KonnectorsService,
    private historyService: HistoryService
  ) {
    super(
      cipherService,
      folderService,
      i18nService,
      platformUtilsService,
      auditService,
      stateService,
      collectionService,
      messagingService,
      eventCollectionService,
      policyService,
      logService,
      passwordRepromptService,
      organizationService
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
      this.cancel();
      event.preventDefault();
    } else if (event.key === "Enter" && event.getModifierState("Control")) {
      this.submit();
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
        if (
          !this.popupUtilsService.inPopout(window) &&
          params.name &&
          (this.cipher.name == null || this.cipher.name === "")
        ) {
          this.cipher.name = params.name;
        }
        if (
          !this.popupUtilsService.inPopout(window) &&
          params.uri &&
          (this.cipher.login.uris[0].uri == null || this.cipher.login.uris[0].uri === "")
        ) {
          this.cipher.login.uris[0].uri = params.uri;
        }
      }

      this.openAttachmentsInPopup = this.popupUtilsService.inPopup(window);
    });

    if (!this.editMode) {
      const tabs = await BrowserApi.tabsQuery({ windowType: "normal" });
      this.currentUris =
        tabs == null
          ? null
          : tabs.filter((tab) => tab.url != null && tab.url !== "").map((tab) => tab.url);
    }

    this.setFocus();

    if (this.popupUtilsService.inTab(window)) {
      this.popupUtilsService.enableCloseTabWarning();
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
      (await this.stateService.getEnableAutoFillOnPageLoad());

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
    const success = await super.submit();
    if (!success) {
      return false;
    }

    if (this.popupUtilsService.inTab(window)) {
      this.popupUtilsService.disableCloseTabWarning();
      this.messagingService.send("closeTab", { delay: 1000 });
      return true;
    }

    if (this.cloneMode) {
      /* Cozy customization : why should we go back to vault after cloning a cipher ?
         we prefer go back in history twice (from where the initial cipher has been opened)
      /*
      this.router.navigate(["/tabs/vault"]);
      */
      this.historyService.gotoPreviousUrl(2);
      /* end custo */
    } else {
      /* Cozy customization
      this.location.back();
      */
      this.konnectorsService.createSuggestions();
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
      this.popupUtilsService.popOut(window, currentBaseUrl + destinationUrl);
    } else {
      this.router.navigate(["/attachments"], { queryParams: { cipherId: this.cipher.id } });
    }
  }

  editCollections() {
    super.editCollections();
    if (this.cipher.organizationId != null) {
      this.router.navigate(["/collections"], { queryParams: { cipherId: this.cipher.id } });
    }
  }

  cancel() {
    super.cancel();

    if (this.popupUtilsService.inTab(window)) {
      this.messagingService.send("closeTab");
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
      this.platformUtilsService,
      this.cipher,
      this.stateService
    );
    if (confirmed) {
      /* Cozy customization
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
    return this.stateService.setAddEditCipherInfo({
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
}
