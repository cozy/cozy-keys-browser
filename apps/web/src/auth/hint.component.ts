import { Component } from "@angular/core";
import { Router } from "@angular/router";

import { HintComponent as BaseHintComponent } from "@bitwarden/angular/auth/components/hint.component";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/abstractions/platformUtils.service";
import { LoginService } from "@bitwarden/common/auth/abstractions/login.service";

@Component({
  selector: "app-hint",
  templateUrl: "hint.component.html",
})
export class HintComponent extends BaseHintComponent {
  constructor(
    router: Router,
    i18nService: I18nService,
    apiService: ApiService,
    platformUtilsService: PlatformUtilsService,
    logService: LogService,
    loginService: LoginService
  ) {
    super(router, i18nService, apiService, platformUtilsService, logService, loginService);
  }
}
