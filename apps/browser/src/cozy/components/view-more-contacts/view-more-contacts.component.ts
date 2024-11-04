import { Location } from "@angular/common";
import { Component } from "@angular/core";

import { BrowserApi } from "../../../platform/browser/browser-api";
import { CozyClientService } from "../../../popup/services/cozyClient.service";

@Component({
  selector: "app-vault-view-more-contacts",
  templateUrl: "view-more-contacts.component.html",
})
export class ViewMoreContactsComponent {
  constructor(
    private cozyClientService: CozyClientService,
    private location: Location,
  ) {}

  back() {
    this.location.back();
  }

  protected async openContacts() {
    await BrowserApi.createNewTab(this.cozyClientService.getAppURL("contacts", ""));
  }
}
