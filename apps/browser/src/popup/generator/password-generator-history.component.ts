import { Location } from "@angular/common";
import { Component } from "@angular/core";

import { PasswordGeneratorHistoryComponent as BasePasswordGeneratorHistoryComponent } from "jslib-angular/components/password-generator-history.component";
import { I18nService } from "jslib-common/abstractions/i18n.service";
import { PasswordGenerationService } from "jslib-common/abstractions/passwordGeneration.service";
import { PlatformUtilsService } from "jslib-common/abstractions/platformUtils.service";

/* Cozy imports */
import { HistoryService } from "../services/history.service";
/* END */

@Component({
  selector: "app-password-generator-history",
  templateUrl: "password-generator-history.component.html",
})
export class PasswordGeneratorHistoryComponent extends BasePasswordGeneratorHistoryComponent {
  constructor(
    passwordGenerationService: PasswordGenerationService,
    platformUtilsService: PlatformUtilsService,
    i18nService: I18nService,
    private location: Location,
    private historyService: HistoryService
  ) {
    super(passwordGenerationService, platformUtilsService, i18nService, window);
  }

  close() {
    // this.location.back();
    this.historyService.gotoPreviousUrl();
  }
}
