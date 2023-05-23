import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  NgZone,
  OnChanges,
  Output,
} from "@angular/core";

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
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

const BroadcasterSubscriptionId = "ViewComponent";

@Component({
  selector: "app-vault-view",
  templateUrl: "view.component.html",
})
export class ViewComponent extends BaseViewComponent implements OnChanges {
  @Output() onViewCipherPasswordHistory = new EventEmitter<CipherView>();

  constructor(
    cipherService: CipherService,
    folderService: FolderService,
    totpService: TotpService,
    tokenService: TokenService,
    i18nService: I18nService,
    cryptoService: CryptoService,
    platformUtilsService: PlatformUtilsService,
    auditService: AuditService,
    broadcasterService: BroadcasterService,
    ngZone: NgZone,
    changeDetectorRef: ChangeDetectorRef,
    eventCollectionService: EventCollectionService,
    apiService: ApiService,
    private messagingService: MessagingService,
    passwordRepromptService: PasswordRepromptService,
    logService: LogService,
    stateService: StateService,
    fileDownloadService: FileDownloadService
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
  ngOnInit() {
    super.ngOnInit();
    this.broadcasterService.subscribe(BroadcasterSubscriptionId, (message: any) => {
      this.ngZone.run(() => {
        switch (message.command) {
          case "windowHidden":
            this.onWindowHidden();
            break;
          default:
        }
      });
    });
  }

  ngOnDestroy() {
    super.ngOnDestroy();
    this.broadcasterService.unsubscribe(BroadcasterSubscriptionId);
  }

  async ngOnChanges() {
    await super.load();
  }

  viewHistory() {
    this.onViewCipherPasswordHistory.emit(this.cipher);
  }

  async copy(value: string, typeI18nKey: string, aType: string) {
    super.copy(value, typeI18nKey, aType);
    this.messagingService.send("minimizeOnCopy");
  }

  onWindowHidden() {
    this.showPassword = false;
    this.showCardNumber = false;
    this.showCardCode = false;
    if (this.cipher !== null && this.cipher.hasFields) {
      this.cipher.fields.forEach((field) => {
        field.showValue = false;
      });
    }
  }

  showGetPremium() {
    if (!this.canAccessPremium) {
      this.messagingService.send("premiumRequired");
    }
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
}
