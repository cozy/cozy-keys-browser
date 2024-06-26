import { Location } from "@angular/common";
/* Cozy custo
import { Component } from "@angular/core";
*/
import { Component, ElementRef, ViewChild, OnDestroy } from "@angular/core";
/* end custo */
import { ActivatedRoute } from "@angular/router";

import { GeneratorComponent as BaseGeneratorComponent } from "@bitwarden/angular/tools/generator/components/generator.component";
import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/abstractions/platformUtils.service";
import { StateService } from "@bitwarden/common/abstractions/state.service";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/common/tools/generator/password";
import { UsernameGenerationServiceAbstraction } from "@bitwarden/common/tools/generator/username";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { AddEditCipherInfo } from "@bitwarden/common/vault/types/add-edit-cipher-info";

/* Cozy imports */
/* eslint-disable */
import { HistoryService } from "../../../popup/services/history.service";
import { CozyClientService } from "../../../popup/services/cozyClient.service";
import { first } from "rxjs/operators";
import { Subject } from "rxjs";
/* eslint-enable */
/* END */

@Component({
  selector: "app-generator",
  templateUrl: "generator.component.html",
})
export class GeneratorComponent extends BaseGeneratorComponent implements OnDestroy {
  private addEditCipherInfo: AddEditCipherInfo;
  private cipherState: CipherView;
  protected destroy$ = new Subject<void>();

  @ViewChild("emailInput") emailInputElement: ElementRef;

  constructor(
    passwordGenerationService: PasswordGenerationServiceAbstraction,
    usernameGenerationService: UsernameGenerationServiceAbstraction,
    platformUtilsService: PlatformUtilsService,
    i18nService: I18nService,
    stateService: StateService,
    route: ActivatedRoute,
    logService: LogService,
    private location: Location,
    private historyService: HistoryService,
    protected cozyClientService: CozyClientService
  ) {
    super(
      passwordGenerationService,
      usernameGenerationService,
      platformUtilsService,
      stateService,
      i18nService,
      logService,
      route,
      window,
      cozyClientService
    );
  }

  async ngOnInit() {
    this.addEditCipherInfo = await this.stateService.getAddEditCipherInfo();
    if (this.addEditCipherInfo != null) {
      this.cipherState = this.addEditCipherInfo.cipher;
    }
    this.comingFromAddEdit = this.cipherState != null;
    if (this.cipherState?.login?.hasUris) {
      this.usernameWebsite = this.cipherState.login.uris[0].hostname;
    }
    // Cozy customization
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.queryParams.pipe(first()).subscribe(async (qParams) => {
      if (qParams.tempCipher) {
        // a cipher is in edition, retrive cipher data form url
        this.comingFromAddEdit = true;
        const jsonCipher = JSON.parse(qParams.tempCipher);
        this.cipherState = CipherView.fromJSON(jsonCipher);
        if (this.cipherState?.login?.hasUris) {
          this.usernameWebsite = this.cipherState.login.uris[0].hostname;
        }
      }
    });
    // end custo */

    await super.ngOnInit();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  select() {
    super.select();
    if (this.type === "password") {
      this.cipherState.login.password = this.password;
    } else if (this.type === "username") {
      this.cipherState.login.username = this.username;
    }
    /* Cozy custo
    this.addEditCipherInfo.cipher = this.cipherState;
    this.stateService.setAddEditCipherInfo(this.addEditCipherInfo);
    */
    this.historyService.updatePreviousAddEditCipher(this.cipherState);
    /* end custo */
    this.close();
  }

  close() {
    /* Cozy custo
    this.location.back();
    */
    this.historyService.gotoPreviousUrl();
    /* end custo */
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
