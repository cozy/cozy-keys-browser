import { Location } from "@angular/common";
import { Component } from "@angular/core";

import { PasswordGeneratorHistoryComponent as BasePasswordGeneratorHistoryComponent } from "@bitwarden/angular/tools/generator/components/password-generator-history.component";
import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/abstractions/platformUtils.service";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/common/tools/generator/password";

/* Cozy imports */
import { HistoryService } from "../../../popup/services/history.service";
/* END */

@Component({
  selector: "app-password-generator-history",
  templateUrl: "password-generator-history.component.html",
})
export class PasswordGeneratorHistoryComponent extends BasePasswordGeneratorHistoryComponent {
  constructor(
    passwordGenerationService: PasswordGenerationServiceAbstraction,
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
