
// Cozy customization, file is heavily modified to manage premium banner
//*
import { Component, NgZone, OnInit } from "@angular/core";

import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";

import { BrowserApi } from "../platform/browser/browser-api";
import BrowserPopupUtils from "../platform/popup/browser-popup-utils";

import { CozyClientService } from "./services/cozyClient.service";

const BroadcasterSubscriptionId = "PremiumBanner";
/*/
import { Component, OnInit } from "@angular/core";

import BrowserPopupUtils from "../platform/popup/browser-popup-utils";
//*/

@Component({
  selector: "app-tabs",
  templateUrl: "tabs.component.html",
})
export class TabsComponent implements OnInit {
  showCurrentTab = true;

  // Cozy customization
  cozyUrl: string;
  static showBanner: boolean = undefined;
  static closedByUser: boolean = undefined;
  static isVaultTooOld: boolean = undefined;

  constructor(
    private broadcasterService: BroadcasterService,
    private stateService: StateService,
    private ngZone: NgZone,
    private cozyClientService: CozyClientService,
  ) {}
  // Cozy customization

  async ngOnInit() {
    this.showCurrentTab = !BrowserPopupUtils.inPopout(window);

    // Cozy customization
    this.cozyUrl = this.cozyClientService.getCozyURL();
    this.broadcasterService.subscribe(BroadcasterSubscriptionId, (message: any) => {
      this.ngZone.run(async () => {
        switch (message.command) {
          case "syncCompleted": {
            this.refreshBanner();
            break;
          }
          default:
            break;
        }
      });
    });
    if (TabsComponent.showBanner === undefined) {
      TabsComponent.closedByUser = await this.stateService.getBannerClosedByUser();
      this.refreshBanner();
    }
    // Cozy customization end
  }

  // Cozy customization
  async refreshBanner() {
    if (TabsComponent.isVaultTooOld === undefined) {
      const vaultCreationDate = await this.cozyClientService.getVaultCreationDate();
      const limitDate = new Date(Date.now() - 21 * (3600 * 1000 * 24));
      TabsComponent.isVaultTooOld = vaultCreationDate < limitDate;
    }

    TabsComponent.showBanner =
      !await this.cozyClientService.getFlagValue("passwords.can-share-organizations") &&
      TabsComponent.isVaultTooOld &&
      !TabsComponent.closedByUser;
  }

  shouldDisplayPremiumNote() {
    return TabsComponent.showBanner;
  }

  close() {
    TabsComponent.closedByUser = true;
    TabsComponent.showBanner = false;
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
  // Cozy customization end
}
