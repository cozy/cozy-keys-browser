import { Component, NgZone } from "@angular/core";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import flag from "cozy-flags";

import { BroadcasterService } from "@bitwarden/common/abstractions/broadcaster.service";
import { I18nService } from "@bitwarden/common/abstractions/i18n.service";

import { BrowserApi } from "../../../../browser/browserApi";
import { CozyClientService } from "../../../../popup/services/cozyClient.service";
import { BrowserStateService as StateService } from "../../../../services/abstractions/browser-state.service";

const BroadcasterSubscriptionId = "PremiumBanner";

@Component({
  selector: "app-vault-premium-banner",
  templateUrl: "premium-banner.component.html",
})
export class PremiumBannerComponent {
  static showBanner = false;
  static closedByUser = false;

  constructor(
    i18nService: I18nService,
    private cozyClientService: CozyClientService,
    private broadcasterService: BroadcasterService,
    private ngZone: NgZone,
    private stateService: StateService
  ) {
    this.refresh();
  }

  async ngOnInit() {
    this.broadcasterService.subscribe(BroadcasterSubscriptionId, (message: any) => {
      this.ngZone.run(async () => {
        switch (message.command) {
          case "syncCompleted": {
            this.refresh();
            break;
          }
          default:
            break;
        }
      });
    });
    PremiumBannerComponent.closedByUser = await this.stateService.getBannerClosedByUser();
    this.refresh();
  }

  ngOnDestroy() {
    this.broadcasterService.unsubscribe(BroadcasterSubscriptionId);
  }

  shouldDisplayPremiumNote() {
    return PremiumBannerComponent.showBanner;
  }

  async refresh() {
    const vaultCreationDate = await this.cozyClientService.getVaultCreationDate();
    const limitDate = new Date(Date.now() - 21 * (3600 * 1000 * 24));
    PremiumBannerComponent.showBanner =
      !flag("passwords.can-share-organizations") &&
      vaultCreationDate < limitDate &&
      !PremiumBannerComponent.closedByUser;
  }

  close() {
    PremiumBannerComponent.closedByUser = true;
    PremiumBannerComponent.showBanner = false;
    this.stateService.setBannerClosedByUser(true);
  }

  async openPremiumPage() {
    const link = await this.cozyClientService.getPremiumLink();
    if (link) {
      BrowserApi.createNewTab(link);
    } else {
      BrowserApi.createNewTab("https://cozy.io/fr/pricing/");
    }
  }
}
