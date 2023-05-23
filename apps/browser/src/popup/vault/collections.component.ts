import { Component } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { first } from "rxjs/operators";

import { CollectionsComponent as BaseCollectionsComponent } from "@bitwarden/angular/components/collections.component";
import { CollectionService } from "@bitwarden/common/abstractions/collection.service";
import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/abstractions/platformUtils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";

/** Start Cozy imports */
import { HistoryService } from "../services/history.service";
/** End Cozy imports */

@Component({
  selector: "app-vault-collections",
  templateUrl: "collections.component.html",
})
// eslint-disable-next-line rxjs-angular/prefer-takeuntil
export class CollectionsComponent extends BaseCollectionsComponent {
  constructor(
    collectionService: CollectionService,
    platformUtilsService: PlatformUtilsService,
    i18nService: I18nService,
    cipherService: CipherService,
    private route: ActivatedRoute,
    logService: LogService,
    private historyService: HistoryService
  ) {
    super(collectionService, platformUtilsService, i18nService, cipherService, logService);
  }

  async ngOnInit() {
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil
    this.onSavedCollections.subscribe(() => {
      this.back();
    });
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.queryParams.pipe(first()).subscribe(async (params) => {
      this.cipherId = params.cipherId;
      await this.load();
    });
  }

  back() {
    // note Cozy : collections are not displayed in Cozy Pass Addon, but we modify nevertheless
    // this back in case one day we decide to use this component
    // this.location.back();
    this.historyService.gotoPreviousUrl();
  }
}
