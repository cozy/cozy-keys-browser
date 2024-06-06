/* Cozy custo
import { ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit } from "@angular/core";
*/
import {
  ChangeDetectorRef,
  Component,
  NgZone,
  OnDestroy,
  OnInit,
  HostListener,
} from "@angular/core";
/* end custo */
import { Router } from "@angular/router";
import { Subject, firstValueFrom, from } from "rxjs";
import { debounceTime, switchMap, takeUntil } from "rxjs/operators";

import { UnassignedItemsBannerService } from "@bitwarden/angular/services/unassigned-items-banner.service";
import { SearchService } from "@bitwarden/common/abstractions/search.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AutofillOverlayVisibility } from "@bitwarden/common/autofill/constants";
import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { VaultSettingsService } from "@bitwarden/common/vault/abstractions/vault-settings/vault-settings.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { PasswordRepromptService } from "@bitwarden/vault";

import { AutofillService } from "../../../../autofill/services/abstractions/autofill.service";
import { BrowserApi } from "../../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../../platform/popup/browser-popup-utils";
import { VaultFilterService } from "../../../services/vault-filter.service";
/** Start Cozy imports */
/* eslint-disable */
import { CozyClientService } from "../../../../popup/services/cozyClient.service";
import { HistoryService } from "../../../../popup/services/history.service";
import { Location } from "@angular/common";
/* eslint-enable */
/** End Cozy imports */

const BroadcasterSubscriptionId = "CurrentTabComponent";

@Component({
  selector: "app-current-tab",
  templateUrl: "current-tab.component.html",
})
export class CurrentTabComponent implements OnInit, OnDestroy {
  pageDetails: any[] = [];
  tab: chrome.tabs.Tab;
  cardCiphers: CipherView[];
  identityCiphers: CipherView[];
  loginCiphers: CipherView[];
  contactCiphers: CipherView[];
  url: string;
  hostname: string;
  searchText: string;
  inSidebar = false;
  searchTypeSearch = false;
  loaded = false;
  isLoading = false;
  showOrganizations = false;
  showHowToAutofill = false;
  autofillCalloutText: string[] = ["", ""];
  protected search$ = new Subject<void>();
  private destroy$ = new Subject<void>();
  dontShowCards = false;
  dontShowIdentities = false;

  private totpCode: string;
  private totpTimeout: number;
  private loadedTimeout: number;
  private searchTimeout: number;
  private initPageDetailsTimeout: number;

  protected unassignedItemsBannerEnabled$ = this.configService.getFeatureFlag$(
    FeatureFlag.UnassignedItemsBanner,
  );

  constructor(
    private platformUtilsService: PlatformUtilsService,
    private cipherService: CipherService,
    private autofillService: AutofillService,
    private i18nService: I18nService,
    private router: Router,
    private ngZone: NgZone,
    private broadcasterService: BroadcasterService,
    private changeDetectorRef: ChangeDetectorRef,
    private syncService: SyncService,
    private searchService: SearchService,
    private autofillSettingsService: AutofillSettingsServiceAbstraction,
    private passwordRepromptService: PasswordRepromptService,
    private organizationService: OrganizationService,
    private vaultFilterService: VaultFilterService,
    private vaultSettingsService: VaultSettingsService,
    private configService: ConfigService,
    protected unassignedItemsBannerService: UnassignedItemsBannerService,
    private cozyClientService: CozyClientService,
    private historyService: HistoryService
  ) {}

  async ngOnInit() {
    this.searchTypeSearch = !this.platformUtilsService.isSafari();
    this.inSidebar = BrowserPopupUtils.inSidebar(window);

    this.broadcasterService.subscribe(BroadcasterSubscriptionId, (message: any) => {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.ngZone.run(async () => {
        switch (message.command) {
          case "syncCompleted":
            if (this.isLoading) {
              window.setTimeout(() => {
                // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                this.load();
              }, 500);
            }
            break;
          case "collectPageDetailsResponse":
            if (message.sender === BroadcasterSubscriptionId) {
              this.pageDetails.push({
                frameId: message.webExtSender.frameId,
                tab: message.tab,
                details: message.details,
              });
            }
            break;
          default:
            break;
        }

        this.changeDetectorRef.detectChanges();
      });
    });

    if (!this.syncService.syncInProgress) {
      await this.load();
      await this.setCallout();
    } else {
      this.loadedTimeout = window.setTimeout(async () => {
        if (!this.isLoading) {
          await this.load();
          await this.setCallout();
        }
      }, 5000);
    }

    this.search$
      .pipe(
        debounceTime(500),
        switchMap(() => {
          return from(this.searchVault());
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    const autofillOnPageLoadOrgPolicy = await firstValueFrom(
      this.autofillSettingsService.activateAutofillOnPageLoadFromPolicy$,
    );
    const autofillOnPageLoadPolicyToastHasDisplayed = await firstValueFrom(
      this.autofillSettingsService.autofillOnPageLoadPolicyToastHasDisplayed$,
    );

    // If the org "autofill on page load" policy is set, set the user setting to match it
    // @TODO override user setting instead of overwriting
    if (autofillOnPageLoadOrgPolicy === true) {
      await this.autofillSettingsService.setAutofillOnPageLoad(true);

      if (!autofillOnPageLoadPolicyToastHasDisplayed) {
        this.platformUtilsService.showToast(
          "info",
          null,
          this.i18nService.t("autofillPageLoadPolicyActivated"),
        );

        await this.autofillSettingsService.setAutofillOnPageLoadPolicyToastHasDisplayed(true);
      }
    }

    // If the org policy is ever disabled after being enabled, reset the toast notification
    if (!autofillOnPageLoadOrgPolicy && autofillOnPageLoadPolicyToastHasDisplayed) {
      await this.autofillSettingsService.setAutofillOnPageLoadPolicyToastHasDisplayed(false);
    }
  }

  ngOnDestroy() {
    window.clearTimeout(this.loadedTimeout);
    this.broadcasterService.unsubscribe(BroadcasterSubscriptionId);

    this.destroy$.next();
    this.destroy$.complete();
  }

  // Cozy custo : beforeunload event would be better but is not triggered in webextension...
  // see : https://stackoverflow.com/questions/2315863/does-onbeforeunload-event-trigger-for-popup-html-in-a-google-chrome-extension
  @HostListener("window:unload", ["$event"])
  async unloadMnger(event?: any) {
    this.historyService.updateTimeStamp();
  }
  // end custo

  async refresh() {
    await this.load();
  }

  //* Cozy custo
  addCipher() {
    this.router.navigate(["/add-generic"], {
      queryParams: {
        name: this.hostname,
        uri: this.url,
        selectedVault: this.vaultFilterService.getVaultFilter().selectedOrganizationId,
      },
    });
  }
  //*/
  //*
  addLoginCipher() {
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.router.navigate(["/add-cipher"], {
      queryParams: {
        name: this.hostname,
        uri: this.url,
        selectedVault: this.vaultFilterService.getVaultFilter().selectedOrganizationId,
      },
    });
  }

  addCardCipher() {
    this.router.navigate(["/add-cipher"], { queryParams: { type: 3 } });
  }

  addIdentityCipher() {
    this.router.navigate(["/add-cipher"], { queryParams: { type: 4 } });
  }

  // Cozy customization
  addContactCipher() {
    const appUrl = this.cozyClientService.getAppURL("contacts", "new");
    window.open(appUrl);
  }
  // Cozy customization end
  //*/

  viewCipher(cipher: CipherView) {
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.router.navigate(["/view-cipher"], { queryParams: { cipherId: cipher.id } });
  }

  async fillCipher(cipher: CipherView, closePopupDelay?: number) {
    if (
      cipher.reprompt !== CipherRepromptType.None &&
      !(await this.passwordRepromptService.showPasswordPrompt())
    ) {
      return;
    }

    this.totpCode = null;
    if (this.totpTimeout != null) {
      window.clearTimeout(this.totpTimeout);
    }

    if (this.pageDetails == null || this.pageDetails.length === 0) {
      this.platformUtilsService.showToast("error", null, this.i18nService.t("autofillError"));
      return;
    }

    try {
      this.totpCode = await this.autofillService.doAutoFill({
        tab: this.tab,
        cipher: cipher,
        pageDetails: this.pageDetails,
        doc: window.document,
        fillNewPassword: true,
        allowTotpAutofill: true,
      });
      if (this.totpCode != null) {
        this.platformUtilsService.copyToClipboard(this.totpCode, { window: window });
        // Cozy custo
        this.platformUtilsService.showToast(
          "success",
          this.i18nService.t("TOTP"),
          this.i18nService.t("TOTPCopiedInClipboard")
        );
        return;
        // end custo
      }
      if (BrowserPopupUtils.inPopup(window)) {
        if (!closePopupDelay) {
          if (this.platformUtilsService.isFirefox() || this.platformUtilsService.isSafari()) {
            BrowserApi.closePopup(window);
          } else {
            // Slight delay to fix bug in Chromium browsers where popup closes without copying totp to clipboard
            setTimeout(() => BrowserApi.closePopup(window), 50);
          }
        } else {
          setTimeout(() => BrowserApi.closePopup(window), closePopupDelay);
        }
      }
    } catch {
      this.ngZone.run(() => {
        this.platformUtilsService.showToast("error", null, this.i18nService.t("autofillError"));
        this.changeDetectorRef.detectChanges();
      });
    }
  }

  async searchVault() {
    if (!(await this.searchService.isSearchable(this.searchText))) {
      return;
    }

    await this.router.navigate(["/tabs/vault"], { queryParams: { searchText: this.searchText } });
  }

  @HostListener("window:keydown", ["$event"]) // Cozy custo
  closeOnEsc(e: KeyboardEvent) {
    /**
    // If input not empty, use browser default behavior of clearing input instead
    if (e.key === "Escape" && (this.searchText == null || this.searchText === "")) {
      BrowserApi.closePopup(window);
    }
    */
    if (e.key === "Escape") {
      this.back();
      e.preventDefault();
    }
  }

  protected async load() {
    this.isLoading = false;
    this.tab = await BrowserApi.getTabFromCurrentWindow();
    if (this.tab != null) {
      this.url = this.tab.url;
    } else {
      this.loginCiphers = [];
      this.isLoading = this.loaded = true;
      return;
    }

    this.hostname = Utils.getHostname(this.url);
    this.pageDetails = [];
    const otherTypes: CipherType[] = [];
    const dontShowCards = !(await firstValueFrom(this.vaultSettingsService.showCardsCurrentTab$));
    const dontShowIdentities = !(await firstValueFrom(
      this.vaultSettingsService.showIdentitiesCurrentTab$,
    ));
    this.showOrganizations = await this.organizationService.hasOrganizations();
    if (!dontShowCards) {
      otherTypes.push(CipherType.Card);
    }
    if (!dontShowIdentities) {
      otherTypes.push(CipherType.Identity);
      otherTypes.push(CipherType.Contact);
    }

    // Cozy customization, forward dontShowCards and dontShowIdentities
    // to view to hide completely these types if we do not want to show them
    this.dontShowCards = dontShowCards;
    this.dontShowIdentities = dontShowIdentities;

    const ciphers = await this.cipherService.getAllDecryptedForUrl(
      this.url,
      otherTypes.length > 0 ? otherTypes : null,
    );

    this.loginCiphers = [];
    this.cardCiphers = [];
    this.identityCiphers = [];
    this.contactCiphers = [];

    ciphers.forEach((c) => {
      if (!this.vaultFilterService.filterCipherForSelectedVault(c)) {
        switch (c.type) {
          case CipherType.Login:
            this.loginCiphers.push(c);
            break;
          case CipherType.Card:
            this.cardCiphers.push(c);
            break;
          case CipherType.Identity:
            this.identityCiphers.push(c);
            break;
          // Cozy customization
          case CipherType.Contact:
            this.contactCiphers.push(c);
            break;
          // Cozy customization end
          default:
            break;
        }
      }
    });

    if (this.loginCiphers.length) {
      this.loginCiphers = this.loginCiphers.sort((a, b) =>
        this.cipherService.sortCiphersByLastUsedThenName(a, b),
      );
    }

    this.isLoading = this.loaded = true;
    this.collectTabPageDetails();
  }

  async goToSettings() {
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.router.navigate(["autofill"]);
  }

  async dismissCallout() {
    await this.autofillSettingsService.setAutofillOnPageLoadCalloutIsDismissed(true);
    this.showHowToAutofill = false;
  }

  private async setCallout() {
    const inlineMenuVisibilityIsOff =
      (await firstValueFrom(this.autofillSettingsService.inlineMenuVisibility$)) ===
      AutofillOverlayVisibility.Off;

    this.showHowToAutofill =
      this.loginCiphers.length > 0 &&
      inlineMenuVisibilityIsOff &&
      !(await firstValueFrom(this.autofillSettingsService.autofillOnPageLoad$)) &&
      !(await firstValueFrom(this.autofillSettingsService.autofillOnPageLoadCalloutIsDismissed$));

    if (this.showHowToAutofill) {
      const autofillCommand = await this.platformUtilsService.getAutofillKeyboardShortcut();
      await this.setAutofillCalloutText(autofillCommand);
    }
  }

  private setAutofillCalloutText(command: string) {
    /* Cozy custo
    if (command) {
      this.autofillCalloutText = this.i18nService.t("autofillSelectInfoWithCommand", command);
    } else {
      this.autofillCalloutText = this.i18nService.t("autofillSelectInfoWithoutCommand");
    }
    */
    let trans;
    if (command) {
      trans = this.i18nService.t("autofillSelectInfoWithCommand", command);
    } else {
      trans = this.i18nService.t("autofillSelectInfoWithoutCommand");
    }
    this.autofillCalloutText = trans.split(" ✨ ");
    /* end custo  */
  }

  // Cozy custo
  back() {
    this.historyService.gotoPreviousUrl();
  }

  openWebApp() {
    window.open(this.cozyClientService.getAppURL("passwords", ""));
  }
  // end custo

  private collectTabPageDetails() {
    void BrowserApi.tabSendMessage(this.tab, {
      command: "collectPageDetails",
      tab: this.tab,
      sender: BroadcasterSubscriptionId,
    });

    window.clearTimeout(this.initPageDetailsTimeout);
    this.initPageDetailsTimeout = window.setTimeout(() => {
      if (this.pageDetails.length === 0) {
        this.collectTabPageDetails();
      }
    }, 250);
  }
}
