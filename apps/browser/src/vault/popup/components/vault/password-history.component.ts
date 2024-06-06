import { Location } from "@angular/common";
/*
import { Component } from "@angular/core";
*/
import { Component, HostListener } from "@angular/core";
/* end custo */
import { ActivatedRoute } from "@angular/router";
import { first } from "rxjs/operators";

import { PasswordHistoryComponent as BasePasswordHistoryComponent } from "@bitwarden/angular/vault/components/password-history.component";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";

/** Start Cozy imports */
/* eslint-disable */
import { HistoryService } from "../../../../popup/services/history.service";
/* eslint-enable */
/** End Cozy imports */

@Component({
  selector: "app-password-history",
  templateUrl: "password-history.component.html",
})
// eslint-disable-next-line rxjs-angular/prefer-takeuntil
export class PasswordHistoryComponent extends BasePasswordHistoryComponent {
  constructor(
    cipherService: CipherService,
    platformUtilsService: PlatformUtilsService,
    i18nService: I18nService,
    private location: Location,
    private route: ActivatedRoute,
    private historyService: HistoryService
  ) {
    super(cipherService, platformUtilsService, i18nService, window);
  }

  async ngOnInit() {
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.queryParams.pipe(first()).subscribe(async (params: any) => {
      if (params.cipherId) {
        this.cipherId = params.cipherId;
      } else {
        this.close();
      }
      await this.init();
    });
  }

  close() {
    /* Cozy custo
    this.location.back();
    */
    this.historyService.gotoPreviousUrl();
    // end custo
  }

  // Cozy custo
  @HostListener("window:keydown", ["$event"])
  closeOnEsc(e: KeyboardEvent) {
    if (e.key === "Escape") {
      this.close();
      e.preventDefault();
    }
  }
  // end custo
}
