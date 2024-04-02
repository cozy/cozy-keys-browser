import { Location } from "@angular/common";
/* Cozy custo
import { ChangeDetectorRef, Component, NgZone } from "@angular/core";
*/
import { ChangeDetectorRef, Component, NgZone, HostListener } from "@angular/core";
/* end custo */
import { ActivatedRoute, Router } from "@angular/router";
import { first } from "rxjs/operators";

import { ViewComponent as BaseViewComponent } from "@bitwarden/angular/vault/components/view.component";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { BroadcasterService } from "@bitwarden/common/abstractions/broadcaster.service";
import { CryptoService } from "@bitwarden/common/abstractions/crypto.service";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { FileDownloadService } from "@bitwarden/common/abstractions/fileDownload/fileDownload.service";
import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/abstractions/platformUtils.service";
import { StateService } from "@bitwarden/common/abstractions/state.service";
import { TotpService } from "@bitwarden/common/abstractions/totp.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { PasswordRepromptService } from "@bitwarden/common/vault/abstractions/password-reprompt.service";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";

import { AutofillService } from "../../../../autofill/services/abstractions/autofill.service";
import { BrowserApi } from "../../../../browser/browserApi";
import { PopupUtilsService } from "../../../../popup/services/popup-utils.service";

const BroadcasterSubscriptionId = "ChildViewComponent";

/* start Cozy imports */
/* eslint-disable */
import { deleteCipher } from "./cozy-utils";
import { favoritePaperCipher, deletePaperCipher } from "../../../../../../../libs/cozy/paperCipher";
import { deleteContactCipher } from "../../../../../../../libs/cozy/contactCipher";
import { CozyClientService } from "../../../../popup/services/cozyClient.service";
import { CAN_SHARE_ORGANIZATION } from "../../../../cozy/flags";
import { HistoryService } from "../../../../popup/services/history.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { PaperType } from "@bitwarden/common/enums/paperType";
import { DomSanitizer } from "@angular/platform-browser";

/* eslint-enable */
/* end Cozy imports */

@Component({
  selector: "app-vault-view",
  templateUrl: "view.component.html",
})
export class ViewComponent extends BaseViewComponent {
  showAttachments = true;
  pageDetails: any[] = [];
  tab: any;
  loadPageDetailsTimeout: number;
  inPopout = false;
  cipherType = CipherType;
  CAN_SHARE_ORGANIZATION = CAN_SHARE_ORGANIZATION;

  constructor(
    cipherService: CipherService,
    folderService: FolderService,
    totpService: TotpService,
    tokenService: TokenService,
    i18nService: I18nService,
    cryptoService: CryptoService,
    platformUtilsService: PlatformUtilsService,
    auditService: AuditService,
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    broadcasterService: BroadcasterService,
    ngZone: NgZone,
    changeDetectorRef: ChangeDetectorRef,
    stateService: StateService,
    eventCollectionService: EventCollectionService,
    private autofillService: AutofillService,
    private messagingService: MessagingService,
    private popupUtilsService: PopupUtilsService,
    apiService: ApiService,
    passwordRepromptService: PasswordRepromptService,
    logService: LogService,
    fileDownloadService: FileDownloadService,
    private cozyClientService: CozyClientService,
    private historyService: HistoryService,
    private syncService: SyncService,
    private sanitizer: DomSanitizer
  ) {
    super(
      cipherService,
      folderService,
      totpService,
      tokenService,
      i18nService,
      cryptoService,
      platformUtilsService,
      auditService,
      window,
      broadcasterService,
      ngZone,
      changeDetectorRef,
      eventCollectionService,
      apiService,
      passwordRepromptService,
      logService,
      stateService,
      fileDownloadService
    );
  }

  /* Cozy customization */
  @HostListener("window:keydown", ["$event"])
  handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      this.close();
      event.preventDefault();
    }
  }
  /* end custo */

  ngOnInit() {
    this.inPopout = this.popupUtilsService.inPopout(window);
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.queryParams.pipe(first()).subscribe(async (params: any) => {
      if (params.cipherId) {
        this.cipherId = params.cipherId;
      } else {
        this.close();
      }

      await this.load();
    });

    super.ngOnInit();

    this.broadcasterService.subscribe(BroadcasterSubscriptionId, (message: any) => {
      this.ngZone.run(async () => {
        switch (message.command) {
          case "collectPageDetailsResponse":
            if (message.sender === BroadcasterSubscriptionId) {
              this.pageDetails.push({
                frameId: message.webExtSender.frameId,
                tab: message.tab,
                details: message.details,
              });
            }
            break;
          case "tabChanged":
          case "windowChanged":
            if (this.loadPageDetailsTimeout != null) {
              window.clearTimeout(this.loadPageDetailsTimeout);
            }
            this.loadPageDetailsTimeout = window.setTimeout(() => this.loadPageDetails(), 500);
            break;
          default:
            break;
        }
      });
    });
  }

  ngOnDestroy() {
    super.ngOnDestroy();
    this.broadcasterService.unsubscribe(BroadcasterSubscriptionId);
  }

  /* Cozy customization : beforeunload event would be better but is not triggered in webextension...
  // see : https://stackoverflow.com/questions/2315863/does-onbeforeunload-event-trigger-for-popup-html-in-a-google-chrome-extension */
  @HostListener("window:unload", ["$event"])
  async unloadMnger(event?: any) {
    this.historyService.updateTimeStamp();
  }
  /* end custo */

  async load() {
    await super.load();
    await this.loadPageDetails();
  }

  async edit() {
    if (this.cipher.isDeleted) {
      return false;
    }

    // Cozy customization
    if (this.cipher.type === CipherType.Paper || this.cipher.type === CipherType.Contact) {
      this.editInWebApp();
      return;
    }
    // Cozy customization end

    if (!(await super.edit())) {
      return false;
    }

    this.router.navigate(["/edit-cipher"], { queryParams: { cipherId: this.cipher.id } });
    return true;
  }

  async clone() {
    if (this.cipher.isDeleted) {
      return false;
    }

    if (!(await super.clone())) {
      return false;
    }

    this.router.navigate(["/clone-cipher"], {
      queryParams: {
        cloneMode: true,
        cipherId: this.cipher.id,
      },
    });
    return true;
  }

  async favorite() {
    try {
      await favoritePaperCipher(
        this.cipherService,
        this.i18nService,
        this.cipher,
        this.cozyClientService
      );

      const cipher = await this.cipherService.get(this.cipherId);

      this.cipher = await cipher.decrypt();
    } catch {
      this.platformUtilsService.showToast("error", null, this.i18nService.t("unexpectedError"));
    }
  }

  async share() {
    if (!(await super.share())) {
      return false;
    }

    /** Cozy custo : go to share screen even if organizationId is mentionned since in Cozy
     * a user can move a cipher to any organization (= folder) */
    /*
    if (this.cipher.organizationId == null) {
      this.router.navigate(["/share-cipher"], {
        replaceUrl: true,
        queryParams: { cipherId: this.cipher.id },
      });
    }
    */
    this.router.navigate(["/share-cipher"], {
      replaceUrl: true,
      queryParams: { cipherId: this.cipher.id },
    });
    /** end custo */
    return true;
  }

  async fillCipher() {
    const didAutofill = await this.doAutofill();
    if (didAutofill) {
      this.platformUtilsService.showToast("success", null, this.i18nService.t("autoFillSuccess"));
    }
  }

  async fillCipherAndSave() {
    const didAutofill = await this.doAutofill();

    if (didAutofill) {
      if (this.tab == null) {
        throw new Error("No tab found.");
      }

      if (this.cipher.login.uris == null) {
        this.cipher.login.uris = [];
      } else {
        if (this.cipher.login.uris.some((uri) => uri.uri === this.tab.url)) {
          this.platformUtilsService.showToast(
            "success",
            null,
            this.i18nService.t("autoFillSuccessAndSavedUri")
          );
          return;
        }
      }

      const loginUri = new LoginUriView();
      loginUri.uri = this.tab.url;
      this.cipher.login.uris.push(loginUri);

      try {
        const cipher: Cipher = await this.cipherService.encrypt(this.cipher);
        await this.cipherService.updateWithServer(cipher);
        this.platformUtilsService.showToast(
          "success",
          null,
          this.i18nService.t("autoFillSuccessAndSavedUri")
        );
        this.messagingService.send("editedCipher");
      } catch {
        this.platformUtilsService.showToast("error", null, this.i18nService.t("unexpectedError"));
      }
    }
  }

  async restore() {
    if (!this.cipher.isDeleted) {
      return false;
    }
    if (await super.restore()) {
      this.close();
      return true;
    }
    return false;
  }

  /**
   * Cozy custo
   * Calls the overrided deleteCipher
   */
  async delete() {
    const getDeleteMethod = () => {
      if (this.cipher.type === CipherType.Paper) {
        return deletePaperCipher;
      }

      if (this.cipher.type === CipherType.Contact) {
        return deleteContactCipher;
      }

      return deleteCipher;
    };

    const deleteMethod = getDeleteMethod();

    const deleted = await deleteMethod(
      this.cipherService,
      this.i18nService,
      this.platformUtilsService,
      this.cipher,
      this.cozyClientService
    );

    if (deleted) {
      this.messagingService.send("deletedCipher");
      this.close();
      return true;
    }
    return false;
  }

  close() {
    /* Cozy custo
    this.location.back();
    */
    this.historyService.gotoPreviousUrl();
    /* end custo */
  }

  private async loadPageDetails() {
    this.pageDetails = [];
    this.tab = await BrowserApi.getTabFromCurrentWindow();
    if (this.tab == null) {
      return;
    }
    BrowserApi.tabSendMessage(this.tab, {
      command: "collectPageDetails",
      tab: this.tab,
      sender: BroadcasterSubscriptionId,
    });
  }

  private async doAutofill() {
    if (!(await this.promptPassword())) {
      return false;
    }

    if (this.pageDetails == null || this.pageDetails.length === 0) {
      this.platformUtilsService.showToast("error", null, this.i18nService.t("autofillError"));
      return false;
    }

    try {
      this.totpCode = await this.autofillService.doAutoFill({
        tab: this.tab,
        cipher: this.cipher,
        pageDetails: this.pageDetails,
        doc: window.document,
        fillNewPassword: true,
      });
      if (this.totpCode != null) {
        this.platformUtilsService.copyToClipboard(this.totpCode, { window: window });
        /* Cozy custo */
        this.platformUtilsService.showToast(
          "success",
          this.i18nService.t("TOTP"),
          this.i18nService.t("TOTPCopiedInClipboard")
        );
        /* end custo */
      }
    } catch {
      this.platformUtilsService.showToast("error", null, this.i18nService.t("autofillError"));
      this.changeDetectorRef.detectChanges();
      return false;
    }

    return true;
  }

  /* ---------------------------------------------------------------
    @added by Cozy
    returns the postal adress as a string
    the adress will be formated according to the local standard
    ------------------------------------------------------------------- */
  getLocalizedAdress(): string {
    const id = this.cipher.identity;
    let fullAdress: string;
    switch (navigator.language.substr(0, 2)) {
      case "fr":
        /* for the french official format, see : AFNOR XPZ10-011 (no free acces)
                a free summary
                for an individual :
                    1- CIVILITE-TITRE ou QUALITE-PRENOM-NOM
                       permet d’identifier le destinataire, la ligne 2 le point de remise.
                    2- N° APP ou BAL-ETAGE-COULOIR-ESC
                       correspond à tout ce qui est situé à l’intérieur d’un bâtiment,
                    3- ENTREE-BATIMENT-IMMEUBLE-RESIDENCE
                       tout ce qui est à l’extérieur.
                    4- NUMERO-LIBELLE DE LA VOIE
                    5- LIEU DIT ou SERVICE PARTICULIER DE DISTRIBUTION
                    6- CODE POSTAL et LOCALITE DE DESTINATION ou CODE CEDEX et LIBELLE CEDEX
                for a company :
                    1. RAISON SOCIALE ou DENOMINATION
                    2. IDENTITE DU DESTINATAIRE et/ou SERVICE
                    3. ENTREE-BATIMENT-IMMEUBLE-RES-ZI
                    4. NUMERO-LIBELLE DE LA VOIE
                    5. MENTION SPECIALE et COMMUNE GEOGRAPHIQUE - si différente de celle indiquée ligne 6
                    6. (CODE POSTAL et LOCALITE DE DESTINATION) ou (CODE CEDEX et LIBELLE CEDEX)
                */
        fullAdress =
          (id.address1 ? id.address1 : "") +
          (id.address2 ? "\n" + id.address2 : "") +
          (id.address3 ? "\n" + id.address3 : "") +
          (id.postalCode || id.city ? "\n" + id.postalCode + " " + id.city : "") +
          (id.country ? "\n" + id.country : "");
        break;
      default:
        fullAdress =
          (id.address1 ? id.address1 : "") +
          (id.address2 ? "\n" + id.address2 : "") +
          (id.address3 ? "\n" + id.address3 : "") +
          (id.fullAddressPart2 ? "\n" + id.fullAddressPart2 : "") +
          (id.country ? "\n" + id.country : "");
        break;
    }
    return fullAdress;
  }

  openWebApp() {
    if (this.cipher.type === CipherType.Paper && this.cipher.paper.type === PaperType.Paper) {
      const hash = `/paper/files/${this.cipher.paper.qualificationLabel}/${this.cipher.id}`;
      window.open(this.cozyClientService.getAppURL("mespapiers", hash));
    } else if (this.cipher.type === CipherType.Paper && this.cipher.paper.type === PaperType.Note) {
      const returnUrl = this.cozyClientService.getAppURL(
        "mespapiers",
        `/paper/files/${this.cipher.paper.qualificationLabel}`
      );
      const destinationUrl = this.cozyClientService.getAppURL("notes", `n/${this.cipher.id}`);
      const url = new URL(destinationUrl);
      url.searchParams.set("returnUrl", returnUrl);
      window.open(url.toString());
    } else if (this.cipher.type === CipherType.Contact) {
      const hash = this.cipher.id;
      window.open(this.cozyClientService.getAppURL("contacts", hash));
    } else {
      const hash = "/vault?action=view&cipherId=" + this.cipherId;
      window.open(this.cozyClientService.getAppURL("passwords", hash));
    }
  }

  editInWebApp() {
    if (this.cipher.type === CipherType.Paper) {
      this.openWebApp();
      return;
    } else if (this.cipher.type === CipherType.Contact) {
      const hash = `${this.cipher.id}/edit`;
      window.open(this.cozyClientService.getAppURL("contacts", hash));
    }
  }

  // Cozy customization
  async print() {
    const client = await this.cozyClientService.getClientInstance();

    const printUrl = await client
      .collection("io.cozy.files")
      .getDownloadLinkById(this.cipher.id, this.cipher.name);

    window.open(printUrl);
  }
  // Cozy customization end

  // Cozy customization
  async download() {
    const client = await this.cozyClientService.getClientInstance();

    const downloadUrl = await client
      .collection("io.cozy.files")
      .getDownloadLinkById(this.cipher.id, this.cipher.name);

    client.collection("io.cozy.files").forceFileDownload(`${downloadUrl}?Dl=1`, this.cipher.name);
  }
  // Cozy customization end

  // Cozy customization
  async onIllustrationError() {
    // An illustration URL is valid for 10 minutes. If an illustration URL is expired,
    // it is very likely that all illustration URLs are expired. So we start a
    // full sync that will get new illustration URLs.
    await this.syncService.fullSync(true);
  }
  // Cozy customization end

  // Cozy customization
  sanitize(url: string) {
    return this.sanitizer.bypassSecurityTrustUrl(url);
  }
  // Cozy customization end
}
