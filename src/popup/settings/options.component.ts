import { Component, OnInit } from "@angular/core";

import { ThemeType } from "jslib-common/enums/themeType";
import { UriMatchType } from "jslib-common/enums/uriMatchType";

import { I18nService } from "jslib-common/abstractions/i18n.service";
import { MessagingService } from "jslib-common/abstractions/messaging.service";
import { StateService } from "jslib-common/abstractions/state.service";
import { TotpService } from "jslib-common/abstractions/totp.service";

/* Cozy imports */
import { LocalConstantsService as ConstantsService } from "..//services/constants.service";
import { BrowserApi } from "../../browser/browserApi";
import { StorageService } from "jslib-common/abstractions/storage.service";
/* END */

@Component({
  selector: "app-options",
  templateUrl: "options.component.html",
})
export class OptionsComponent implements OnInit {
  disableFavicon = false;
  disableKonnectorsSuggestions = false;
  enableInPageMenu = true;
  disableBadgeCounter = false;
  enableAutoFillOnPageLoad = false;
  autoFillOnPageLoadDefault = false;
  autoFillOnPageLoadOptions: any[];
  disableAutoTotpCopy = false;
  disableContextMenuItem = false;
  disableAddLoginNotification = false;
  disableChangedPasswordNotification = false;
  dontShowCards = false;
  dontShowIdentities = false;
  showClearClipboard = true;
  theme: ThemeType;
  themeOptions: any[];
  defaultUriMatch = UriMatchType.Domain;
  uriMatchOptions: any[];
  clearClipboard: number;
  clearClipboardOptions: any[];
  showGeneral: boolean = true;
  showAutofill: boolean = true;
  showDisplay: boolean = true;

  constructor(
    private messagingService: MessagingService,
    private stateService: StateService,
    private totpService: TotpService,
    i18nService: I18nService,
    private storageService: StorageService
  ) {
    this.themeOptions = [
      { name: i18nService.t("default"), value: ThemeType.System },
      { name: i18nService.t("light"), value: ThemeType.Light },
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
    // TODO REFACTO : where to set and get our keys ? sotrageService or stateService ?
    // other cases in this file & others
    this.disableKonnectorsSuggestions = await this.storageService.get(
      ConstantsService.disableKonnectorsSuggestionsKey
    );

    this.enableAutoFillOnPageLoad = await this.stateService.getEnableAutoFillOnPageLoad();

    this.enableInPageMenu = await this.storageService.get<boolean>(
      ConstantsService.enableInPageMenuKey
    );
    if (this.enableInPageMenu === null) {
      // if not yet set, then default to true
      this.enableInPageMenu = true;
    }

    this.autoFillOnPageLoadDefault =
      (await this.stateService.getAutoFillOnPageLoadDefault()) ?? true;

    this.disableAddLoginNotification = await this.stateService.getDisableAddLoginNotification();

    this.disableChangedPasswordNotification =
      await this.stateService.getDisableChangedPasswordNotification();

    this.disableContextMenuItem = await this.stateService.getDisableContextMenuItem();

    this.dontShowCards = await this.stateService.getDontShowCardsCurrentTab();
    this.dontShowIdentities = await this.stateService.getDontShowIdentitiesCurrentTab();

    this.disableAutoTotpCopy = !(await this.totpService.isAutoCopyEnabled());

    this.disableFavicon = await this.stateService.getDisableFavicon();

    this.disableBadgeCounter = await this.stateService.getDisableBadgeCounter();

    this.theme = await this.stateService.getTheme();

    const defaultUriMatch = await this.stateService.getDefaultUriMatch();
    this.defaultUriMatch = defaultUriMatch == null ? UriMatchType.Domain : defaultUriMatch;

    this.clearClipboard = await this.stateService.getClearClipboard();
  }

  async updateAddLoginNotification() {
    await this.stateService.setDisableAddLoginNotification(this.disableAddLoginNotification);
  }

  async updateChangedPasswordNotification() {
    await this.stateService.setDisableChangedPasswordNotification(
      this.disableChangedPasswordNotification
    );
  }

  async updateDisableContextMenuItem() {
    await this.stateService.setDisableContextMenuItem(this.disableContextMenuItem);
    this.messagingService.send("bgUpdateContextMenu");
  }

  /*
    TODO: enable back when TOTP is available
    async updateAutoTotpCopy() {
    await this.stateService.setDisableAutoTotpCopy(this.disableAutoTotpCopy);
  }
    */

  async updateKonnectorsSuggestions() {
    await this.storageService.save(
      ConstantsService.disableKonnectorsSuggestionsKey,
      this.disableKonnectorsSuggestions
    );
  }

  async updateEnableInPageMenu() {
    await this.storageService.save(ConstantsService.enableInPageMenuKey, this.enableInPageMenu);
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

  async updateDisableFavicon() {
    await this.stateService.setDisableFavicon(this.disableFavicon);
  }

  async updateDisableBadgeCounter() {
    await this.stateService.setDisableBadgeCounter(this.disableBadgeCounter);
    this.messagingService.send("bgUpdateContextMenu");
  }

  async updateShowCards() {
    await this.stateService.setDontShowCardsCurrentTab(this.dontShowCards);
  }

  async updateShowIdentities() {
    await this.stateService.setDontShowIdentitiesCurrentTab(this.dontShowIdentities);
  }

  async saveTheme() {
    await this.stateService.setTheme(this.theme);
    window.setTimeout(() => window.location.reload(), 200);
  }

  async saveDefaultUriMatch() {
    await this.stateService.setDefaultUriMatch(this.defaultUriMatch);
  }

  async saveClearClipboard() {
    await this.stateService.setClearClipboard(this.clearClipboard);
  }
}
