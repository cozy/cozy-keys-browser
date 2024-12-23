import { Location } from "@angular/common";
/* Cozy custo
import { Component, NgZone, OnInit } from "@angular/core";
*/
import { Component, NgZone, OnInit, ElementRef, ViewChild } from "@angular/core";
/* end custo */
import { ActivatedRoute } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { GeneratorComponent as BaseGeneratorComponent } from "@bitwarden/angular/tools/generator/components/generator.component";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { AddEditCipherInfo } from "@bitwarden/common/vault/types/add-edit-cipher-info";
import { ToastService } from "@bitwarden/components";
import {
  PasswordGenerationServiceAbstraction,
  UsernameGenerationServiceAbstraction,
} from "@bitwarden/generator-legacy";

/* Cozy imports */
/* eslint-disable */
import { CozyClientService } from "../../../popup/services/cozyClient.service";
/* eslint-enable */
/* END */

@Component({
  selector: "app-generator",
  templateUrl: "generator.component.html",
})
export class GeneratorComponent extends BaseGeneratorComponent implements OnInit {
  private addEditCipherInfo: AddEditCipherInfo;
  private cipherState: CipherView;

  @ViewChild("emailInput") emailInputElement: ElementRef;
  private cipherService: CipherService;

  constructor(
    passwordGenerationService: PasswordGenerationServiceAbstraction,
    usernameGenerationService: UsernameGenerationServiceAbstraction,
    platformUtilsService: PlatformUtilsService,
    i18nService: I18nService,
    accountService: AccountService,
    cipherService: CipherService,
    route: ActivatedRoute,
    logService: LogService,
    ngZone: NgZone,
    private location: Location,
    protected cozyClientService: CozyClientService,
    toastService: ToastService,
  ) {
    super(
      passwordGenerationService,
      usernameGenerationService,
      platformUtilsService,
      accountService,
      i18nService,
      logService,
      route,
      ngZone,
      window,
      cozyClientService,
      toastService,
    );
    this.cipherService = cipherService;
  }

  async ngOnInit() {
    this.addEditCipherInfo = await firstValueFrom(this.cipherService.addEditCipherInfo$);
    if (this.addEditCipherInfo != null) {
      this.cipherState = this.addEditCipherInfo.cipher;
    }
    this.comingFromAddEdit = this.cipherState != null;
    if (this.cipherState?.login?.hasUris) {
      this.usernameWebsite = this.cipherState.login.uris[0].hostname;
    }

    await super.ngOnInit();
  }

  select() {
    super.select();
    if (this.type === "password") {
      this.cipherState.login.password = this.password;
    } else if (this.type === "username") {
      this.cipherState.login.username = this.username;
    }
    this.addEditCipherInfo.cipher = this.cipherState;
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.cipherService.setAddEditCipherInfo(this.addEditCipherInfo);
    // Cozy customization; copy generated password to clipboard directly
    this.copy();
    // Cozy customization end
    this.close();
  }

  close() {
    this.location.back();
  }

  emailHasFocus = false;

  focusEmail() {
    if (this.emailHasFocus) {
      this.emailHasFocus = false;
    } else {
      this.emailInputElement.nativeElement.focus();
    }
  }
  unFocusEmail() {
    setTimeout(() => {
      this.emailHasFocus = false;
    }, 300);
  }
}
