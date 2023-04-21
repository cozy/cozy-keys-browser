import { Location } from "@angular/common";
import { Component } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { first } from "rxjs/operators";

import { CollectionsComponent as BaseCollectionsComponent } from "jslib-angular/components/collections.component";
import { CipherService } from "jslib-common/abstractions/cipher.service";
import { CollectionService } from "jslib-common/abstractions/collection.service";
import { I18nService } from "jslib-common/abstractions/i18n.service";
import { LogService } from "jslib-common/abstractions/log.service";
import { PlatformUtilsService } from "jslib-common/abstractions/platformUtils.service";

/** Start Cozy imports */
import { HistoryService } from "../services/history.service";
/** End Cozy imports */

@Component({
  selector: "app-vault-collections",
  templateUrl: "collections.component.html",
})
export class CollectionsComponent extends BaseCollectionsComponent {
  constructor(
    collectionService: CollectionService,
    platformUtilsService: PlatformUtilsService,
    i18nService: I18nService,
    cipherService: CipherService,
    private route: ActivatedRoute,
    private location: Location,
    logService: LogService,
    private historyService: HistoryService
  ) {
    super(collectionService, platformUtilsService, i18nService, cipherService, logService);
  }

  async ngOnInit() {
    this.onSavedCollections.subscribe(() => {
      this.back();
    });
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
