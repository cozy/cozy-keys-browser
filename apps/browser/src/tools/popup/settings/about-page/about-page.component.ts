import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { RouterModule } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { DeviceType } from "@bitwarden/common/enums";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService } from "@bitwarden/components";

import { BrowserApi } from "../../../../platform/browser/browser-api";
import { PopOutComponent } from "../../../../platform/popup/components/pop-out.component";
import { AboutDialogComponent } from "../about-dialog/about-dialog.component";
/* start Cozy imports */
/* eslint-disable */
import { CozyClientService } from "../../../../popup/services/cozyClient.service";
/* eslint-enable */
/* end Cozy imports */

// Cozy customization
//*
const RateUrls = {
  [DeviceType.ChromeExtension]:
    "https://chrome.google.com/webstore/detail/cozy-personal-cloud/jplochopoaajoochpoccajmgelpfbbic/reviews",
  [DeviceType.FirefoxExtension]:
    "https://addons.mozilla.org/en-US/firefox/addon/cozy-personal-cloud/reviews",
};
/*/
const RateUrls = {
  [DeviceType.ChromeExtension]:
    "https://chromewebstore.google.com/detail/bitwarden-free-password-m/nngceckbapebfimnlniiiahkandclblb/reviews",
  [DeviceType.FirefoxExtension]:
    "https://addons.mozilla.org/en-US/firefox/addon/bitwarden-password-manager/#reviews",
  [DeviceType.OperaExtension]:
    "https://addons.opera.com/en/extensions/details/bitwarden-free-password-manager/#feedback-container",
  [DeviceType.EdgeExtension]:
    "https://microsoftedge.microsoft.com/addons/detail/jbkfoedolllekgbhcbcoahefnbanhhlh",
  [DeviceType.VivaldiExtension]:
    "https://chromewebstore.google.com/detail/bitwarden-free-password-m/nngceckbapebfimnlniiiahkandclblb/reviews",
  [DeviceType.SafariExtension]: "https://apps.apple.com/app/bitwarden/id1352778147",
};
//*/

@Component({
  templateUrl: "about-page.component.html",
  standalone: true,
  imports: [CommonModule, JslibModule, RouterModule, PopOutComponent],
})
export class AboutPageComponent {
  constructor(
    private dialogService: DialogService,
    private environmentService: EnvironmentService,
    private platformUtilsService: PlatformUtilsService,
    private cozyClientService: CozyClientService,
  ) {}

  about() {
    this.dialogService.open(AboutDialogComponent);
  }

  async launchHelp() {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "continueToHelpCenter" },
      content: { key: "continueToHelpCenterDesc" },
      type: "info",
      acceptButtonText: { key: "continue" },
    });
    if (confirmed) {
      await BrowserApi.createNewTab("https://bitwarden.com/help/");
    }
  }

  launchHelpCozy() {
    BrowserApi.createNewTab("https://cozy.io/fr/support/");
  }

  launchHelpCozyPass() {
    BrowserApi.createNewTab("https://help.cozy.io/category/395-password-manager#");
  }

  launchForums() {
    BrowserApi.createNewTab("https://forum.cozy.io/");
  }

  launchContactForm() {
    BrowserApi.createNewTab("mailto:claude@cozycloud.cc");
  }

  async openPremiumPage() {
    const link = await this.cozyClientService.getPremiumLink();
    if (link) {
      BrowserApi.createNewTab(link);
    } else {
      BrowserApi.createNewTab("https://cozy.io/fr/pricing/");
    }
  }

  async openWebVault() {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "continueToWebApp" },
      content: { key: "continueToWebAppDesc" },
      type: "info",
      acceptButtonText: { key: "continue" },
    });
    if (confirmed) {
      const env = await firstValueFrom(this.environmentService.environment$);
      const url = env.getWebVaultUrl();
      await BrowserApi.createNewTab(url);
    }
  }

  async rate() {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "continueToBrowserExtensionStore" },
      content: { key: "continueToBrowserExtensionStoreDesc" },
      type: "info",
      acceptButtonText: { key: "continue" },
    });
    if (confirmed) {
      const deviceType = this.platformUtilsService.getDevice();
      await BrowserApi.createNewTab((RateUrls as any)[deviceType]);
    }
  }
}
