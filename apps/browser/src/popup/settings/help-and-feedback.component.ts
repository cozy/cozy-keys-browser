import { Component } from "@angular/core";

import { BrowserApi } from "../../platform/browser/browser-api";
import { CozyClientService } from "../services/cozyClient.service";

@Component({
  selector: "app-help-and-feedback",
  templateUrl: "help-and-feedback.component.html",
})
export class HelpAndFeedbackComponent {
  constructor(private cozyClientService: CozyClientService) {}

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
}
