import { Location } from "@angular/common";
import { Component } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { first } from "rxjs/operators";

import { AttachmentsComponent as BaseAttachmentsComponent } from "jslib-angular/components/attachments.component";
import { ApiService } from "jslib-common/abstractions/api.service";
import { CipherService } from "jslib-common/abstractions/cipher.service";
import { CryptoService } from "jslib-common/abstractions/crypto.service";
import { I18nService } from "jslib-common/abstractions/i18n.service";
import { LogService } from "jslib-common/abstractions/log.service";
import { PlatformUtilsService } from "jslib-common/abstractions/platformUtils.service";
import { StateService } from "jslib-common/abstractions/state.service";

/* Cozy imports */
import { HistoryService } from "../services/history.service";
/* END */

@Component({
  selector: "app-vault-attachments",
  templateUrl: "attachments.component.html",
})
export class AttachmentsComponent extends BaseAttachmentsComponent {
  openedAttachmentsInPopup: boolean;

  constructor(
    cipherService: CipherService,
    i18nService: I18nService,
    cryptoService: CryptoService,
    platformUtilsService: PlatformUtilsService,
    apiService: ApiService,
    private location: Location,
    private route: ActivatedRoute,
    stateService: StateService,
    logService: LogService,
    private historyService: HistoryService
  ) {
    super(
      cipherService,
      i18nService,
      cryptoService,
      platformUtilsService,
      apiService,
      window,
      logService,
      stateService
    );
  }

  async ngOnInit() {
    this.route.queryParams.pipe(first()).subscribe(async (params) => {
      this.cipherId = params.cipherId;
      await this.init();
    });

    this.openedAttachmentsInPopup = history.length === 1;
  }

  back() {
    // note Cozy : attachements are not displayed in Cozy Pass Addon, but we modify nevertheless
    // this back in case one day we decide to use this component
    // this.location.back();
    this.historyService.gotoPreviousUrl();
  }

  close() {
    window.close();
  }
}
