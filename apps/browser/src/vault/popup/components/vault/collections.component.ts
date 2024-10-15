import { Location } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { first } from "rxjs/operators";

import { CollectionsComponent as BaseCollectionsComponent } from "@bitwarden/angular/admin-console/components/collections.component";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CollectionService } from "@bitwarden/common/vault/abstractions/collection.service";
import { ToastService } from "@bitwarden/components";

/** Start Cozy imports */
import { HistoryService } from "../../../../popup/services/history.service";
/** End Cozy imports */

@Component({
  selector: "app-vault-collections",
  templateUrl: "collections.component.html",
})
// eslint-disable-next-line rxjs-angular/prefer-takeuntil
export class CollectionsComponent extends BaseCollectionsComponent implements OnInit {
  constructor(
    collectionService: CollectionService,
    platformUtilsService: PlatformUtilsService,
    i18nService: I18nService,
    cipherService: CipherService,
    organizationService: OrganizationService,
    private route: ActivatedRoute,
    private historyService: HistoryService,
    private location: Location,
    logService: LogService,
    configService: ConfigService,
    accountService: AccountService,
    toastService: ToastService,
  ) {
    super(
      collectionService,
      platformUtilsService,
      i18nService,
      cipherService,
      organizationService,
      logService,
      configService,
      accountService,
      toastService,
    );
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
