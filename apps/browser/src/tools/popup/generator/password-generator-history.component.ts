import { Location } from "@angular/common";
import { Component } from "@angular/core";

import { PasswordGeneratorHistoryComponent as BasePasswordGeneratorHistoryComponent } from "@bitwarden/angular/tools/generator/components/password-generator-history.component";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ToastService } from "@bitwarden/components";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";

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
    private historyService: HistoryService,
    toastService: ToastService,
  ) {
    super(passwordGenerationService, platformUtilsService, i18nService, window, toastService);
  }

  close() {
    // this.location.back();
    this.historyService.gotoPreviousUrl();
  }
}
