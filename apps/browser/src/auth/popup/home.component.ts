import { Component, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { Subject, firstValueFrom, takeUntil } from "rxjs";

import { EnvironmentSelectorComponent } from "@bitwarden/angular/auth/components/environment-selector.component";
import { LoginEmailServiceAbstraction } from "@bitwarden/auth/common";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { AccountSwitcherService } from "./account-switching/services/account-switcher.service";

/* start Cozy imports */
/* eslint-disable */
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/common/tools/generator/abstractions/password-generation.service.abstraction";
import { BrowserApi } from "../../platform/browser/browser-api";
/* eslint-enable */
/* end Cozy imports */

@Component({
  selector: "app-home",
  templateUrl: "home.component.html",
})
export class HomeComponent implements OnInit, OnDestroy {
  @ViewChild(EnvironmentSelectorComponent, { static: true })
  environmentSelector!: EnvironmentSelectorComponent;
  private destroyed$: Subject<void> = new Subject();

  loginInitiated = false;
  formGroup = this.formBuilder.group({
    /** Cozy custo
    email: ["", [Validators.required, Validators.email]],
     */
    email: [""],
    /** end custo */
    rememberEmail: [false],
  });

  constructor(
    protected platformUtilsService: PlatformUtilsService,
    private formBuilder: FormBuilder,
    private router: Router,
    private i18nService: I18nService,
    private environmentService: EnvironmentService,
    private loginEmailService: LoginEmailServiceAbstraction,
    private accountSwitcherService: AccountSwitcherService,
    private cryptoFunctionService: CryptoFunctionService,
    private passwordGenerationService: PasswordGenerationServiceAbstraction,
    private stateService: StateService,
  ) {}

  async ngOnInit(): Promise<void> {
    const email = this.loginEmailService.getEmail();
    const rememberEmail = this.loginEmailService.getRememberEmail();

    if (email != null) {
      this.formGroup.patchValue({ email, rememberEmail });
    } else {
      const storedEmail = await firstValueFrom(this.loginEmailService.storedEmail$);

      if (storedEmail != null) {
        this.formGroup.patchValue({ email: storedEmail, rememberEmail: true });
      }
    }

    // Cozy customization
    /*
    this.environmentSelector.onOpenSelfHostedSettings
      .pipe(takeUntil(this.destroyed$))
      .subscribe(() => {
        this.setLoginEmailValues();
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.router.navigate(["environment"]);
      });
    */
  }

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  get availableAccounts$() {
    return this.accountSwitcherService.availableAccounts$;
  }

  async submit() {
    this.formGroup.markAllAsTouched();

    if (this.formGroup.invalid) {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccured"),
        this.i18nService.t("invalidEmail"),
      );
      return;
    }

    this.setLoginEmailValues();

    await this.router.navigate(["login"], { queryParams: { email: this.formGroup.value.email } });
  }

  setLoginEmailValues() {
    this.loginEmailService.setEmail(this.formGroup.value.email);
    this.loginEmailService.setRememberEmail(this.formGroup.value.rememberEmail);
  }

  /* Cozy custo */
  openCozyWebsite() {
    BrowserApi.createNewTab("https://manager.cozycloud.cc/cozy/create");
  }
  /* end custo */
}
