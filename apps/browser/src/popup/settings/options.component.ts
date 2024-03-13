import { Component, OnInit } from "@angular/core";

import { AbstractThemingService } from "@bitwarden/angular/services/theming/theming.service.abstraction";
import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/abstractions/messaging.service";
// import { StateService } from "@bitwarden/common/abstractions/state.service";
import { TotpService } from "@bitwarden/common/abstractions/totp.service";
import { ThemeType } from "@bitwarden/common/enums/themeType";
import { UriMatchType } from "@bitwarden/common/enums/uriMatchType";

/* Cozy imports */
import { BrowserApi } from "../../browser/browserApi";
import { BrowserStateService as StateService } from "../../services/abstractions/browser-state.service";
/* END */

@Component({
  selector: "app-options",
  templateUrl: "options.component.html",
})
export class OptionsComponent implements OnInit {
  enableFavicon = false;
  enableBadgeCounter = false;
  enableAutoFillOnPageLoad = false;
  autoFillOnPageLoadDefault = false;
  autoFillOnPageLoadOptions: any[];
  enableAutoTotpCopy = false; // TODO: Does it matter if this is set to false or true?
  enableContextMenuItem = false;
  enableAddLoginNotification = false;
  enableChangedPasswordNotification = false;
  showCardsCurrentTab = false;
  showIdentitiesCurrentTab = false;
  showClearClipboard = true;
  theme: ThemeType;
  themeOptions: any[];
  defaultUriMatch = UriMatchType.Domain;
  uriMatchOptions: any[];
  clearClipboard: number;
  clearClipboardOptions: any[];
  showGeneral = true;
  showAutofill = true;
  showDisplay = true;
  // Cozy custo
  disableKonnectorsSuggestions = false;
  enableInPageMenu = true;
  // end custo

  constructor(
    private messagingService: MessagingService,
    private stateService: StateService,
    private totpService: TotpService,
    i18nService: I18nService,
    private themingService: AbstractThemingService
  ) {
    this.themeOptions = [
      { name: i18nService.t("default"), value: ThemeType.System },
      { name: i18nService.t("light"), value: ThemeType.Light },
      { name: i18nService.t("lightContrasted"), value: ThemeType.LightContrasted },
      { name: i18nService.t("dark"), value: ThemeType.Dark },
      { name: "Nord", value: ThemeType.Nord },
      { name: i18nService.t("solarizedDark"), value: ThemeType.SolarizedDark },
    ];
    this.uriMatchOptions = [
      { name: i18nService.t("baseDomain"), value: UriMatchType.Domain },
      { name: i18nService.t("host"), value: UriMatchType.Host },
      { name: i18nService.t("startsWith"), value: UriMatchType.StartsWith },
      { name: i18nService.t("regEx"), value: UriMatchType.RegularExpression },
      { name: i18nService.t("exact"), value: UriMatchType.Exact },
      { name: i18nService.t("never"), value: UriMatchType.Never },
    ];
    this.clearClipboardOptions = [
      { name: i18nService.t("never"), value: null },
      { name: i18nService.t("tenSeconds"), value: 10 },
      { name: i18nService.t("twentySeconds"), value: 20 },
      { name: i18nService.t("thirtySeconds"), value: 30 },
      { name: i18nService.t("oneMinute"), value: 60 },
      { name: i18nService.t("twoMinutes"), value: 120 },
      { name: i18nService.t("fiveMinutes"), value: 300 },
    ];
    this.autoFillOnPageLoadOptions = [
      { name: i18nService.t("autoFillOnPageLoadYes"), value: true },
      { name: i18nService.t("autoFillOnPageLoadNo"), value: false },
    ];
  }

  async ngOnInit() {
    this.disableKonnectorsSuggestions = await this.stateService.getDisableKonnectorsSuggestions();

    this.enableAutoFillOnPageLoad = await this.stateService.getEnableAutoFillOnPageLoad();

    this.enableInPageMenu = await this.stateService.getEnableInPageMenu();

    this.autoFillOnPageLoadDefault =
      (await this.stateService.getAutoFillOnPageLoadDefault()) ?? true;

    this.enableAddLoginNotification = !(await this.stateService.getDisableAddLoginNotification());

    this.enableChangedPasswordNotification =
      !(await this.stateService.getDisableChangedPasswordNotification());

    this.enableContextMenuItem = !(await this.stateService.getDisableContextMenuItem());

    this.showCardsCurrentTab = !(await this.stateService.getDontShowCardsCurrentTab());
    this.showIdentitiesCurrentTab = !(await this.stateService.getDontShowIdentitiesCurrentTab());

    this.enableAutoTotpCopy = !(await this.stateService.getDisableAutoTotpCopy());

    this.enableFavicon = !(await this.stateService.getDisableFavicon());

    this.enableBadgeCounter = !(await this.stateService.getDisableBadgeCounter());

    this.theme = await this.stateService.getTheme();

    const defaultUriMatch = await this.stateService.getDefaultUriMatch();
    this.defaultUriMatch = defaultUriMatch == null ? UriMatchType.Domain : defaultUriMatch;

    this.clearClipboard = await this.stateService.getClearClipboard();
  }

  async updateAddLoginNotification() {
    await this.stateService.setDisableAddLoginNotification(!this.enableAddLoginNotification);
  }

  async updateChangedPasswordNotification() {
    await this.stateService.setDisableChangedPasswordNotification(
      !this.enableChangedPasswordNotification
    );
  }

  async updateContextMenuItem() {
    await this.stateService.setDisableContextMenuItem(!this.enableContextMenuItem);
    this.messagingService.send("bgUpdateContextMenu");
  }

  async updateAutoTotpCopy() {
    await this.stateService.setDisableAutoTotpCopy(!this.enableAutoTotpCopy);
  }

  async updateKonnectorsSuggestions() {
    await this.stateService.setDisableKonnectorsSuggestions(this.disableKonnectorsSuggestions);
  }

  async updateEnableInPageMenu() {
    await this.stateService.setEnableInPageMenu(this.enableInPageMenu);

    // activate or deactivate the menu from all tabs
    let subcommand = "autofilIPMenuActivate";
    if (!this.enableInPageMenu) {
      subcommand = "inPageMenuDeactivate";
    }
    const allTabs = await BrowserApi.getAllTabs();
    for (const tab of allTabs) {
      BrowserApi.tabSendMessage(tab, { command: "autofillAnswerRequest", subcommand: subcommand });
    }
  }

  async updateAutoFillOnPageLoad() {
    await this.stateService.setEnableAutoFillOnPageLoad(this.enableAutoFillOnPageLoad);
  }

  async updateAutoFillOnPageLoadDefault() {
    await this.stateService.setAutoFillOnPageLoadDefault(this.autoFillOnPageLoadDefault);
  }

  async updateFavicon() {
    await this.stateService.setDisableFavicon(!this.enableFavicon);
  }

  async updateBadgeCounter() {
    await this.stateService.setDisableBadgeCounter(!this.enableBadgeCounter);
    this.messagingService.send("bgUpdateContextMenu");
  }

  async updateShowCardsCurrentTab() {
    await this.stateService.setDontShowCardsCurrentTab(!this.showCardsCurrentTab);
  }

  async updateShowIdentitiesCurrentTab() {
    await this.stateService.setDontShowIdentitiesCurrentTab(!this.showIdentitiesCurrentTab);
  }

  async saveTheme() {
    await this.themingService.updateConfiguredTheme(this.theme);
  }

  async saveDefaultUriMatch() {
    await this.stateService.setDefaultUriMatch(this.defaultUriMatch);
  }

  async saveClearClipboard() {
    await this.stateService.setClearClipboard(this.clearClipboard);
  }
}
