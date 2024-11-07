import { Component, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { FormBuilder } from "@angular/forms";
import { Router } from "@angular/router";
import { Subject, firstValueFrom } from "rxjs";

import { EnvironmentSelectorComponent } from "@bitwarden/angular/auth/components/environment-selector.component";
import { LoginEmailServiceAbstraction, RegisterRouteService } from "@bitwarden/auth/common";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ToastService } from "@bitwarden/components";

/* start Cozy imports */
/* eslint-disable */
import { BrowserApi } from "../../platform/browser/browser-api";
import { CozySanitizeUrlService } from "../../popup/services/cozySanitizeUrl.service";
import { AccountSwitcherService } from "./account-switching/services/account-switcher.service";
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

  // TODO: remove when email verification flag is removed
  registerRoute$ = this.registerRouteService.registerRoute$();

  constructor(
    protected cozySanitizeUrlService: CozySanitizeUrlService,
    protected platformUtilsService: PlatformUtilsService,
    private formBuilder: FormBuilder,
    private router: Router,
    private i18nService: I18nService,
    private loginEmailService: LoginEmailServiceAbstraction,
    private accountSwitcherService: AccountSwitcherService,
    private registerRouteService: RegisterRouteService,
    private toastService: ToastService,
  ) {}

  async ngOnInit(): Promise<void> {
    const email = await firstValueFrom(this.loginEmailService.loginEmail$);
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
      .pipe(
        switchMap(async () => {
          await this.setLoginEmailValues();
          await this.router.navigate(["environment"]);
        }),
        takeUntil(this.destroyed$),
      )
      .subscribe();
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
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccured"),
        message: this.i18nService.t("invalidEmail"),
      });
      return;
    }

    // Cozy customization; check if Cozy exists before navigating to login page
    const cozyUrl = this.cozySanitizeUrlService.sanitizeUrlInput(this.formGroup.value.email);
    const glUrl = this.cozySanitizeUrlService.sanitizeUrlInput(
      this.formGroup.value.email,
      ".cozygrandlyon.cloud",
    );
    let selectedUrl = null;

    const cozyExist = await this.cozyExist(cozyUrl);
    if (cozyExist) {
      selectedUrl = cozyUrl;
    } else {
      const glExist = await this.cozyExist(glUrl);
      if (glExist) {
        selectedUrl = glUrl;
      }
    }

    if (!selectedUrl) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccured"),
        message: this.i18nService.t("noCozyFound"),
      });
      return;
    }

    // Cozy customization end

    await this.setLoginEmailValues();
    await this.router.navigate(["login"], {
      queryParams: { email: this.formGroup.value.email, cozyUrl: selectedUrl },
    });
  }

  async setLoginEmailValues() {
    // Note: Browser saves email settings here instead of the login component
    this.loginEmailService.setRememberEmail(this.formGroup.value.rememberEmail);
    await this.loginEmailService.setLoginEmail(this.formGroup.value.email);
    await this.loginEmailService.saveEmailSettings();
  }

  /* Cozy custo */
  openCozyWebsite() {
    BrowserApi.createNewTab("https://manager.cozycloud.cc/cozy/create");
  }
  /* end custo */

  // Cozy customization; check if Cozy exists before navigating to login page
  async cozyExist(cozyUrl: string) {
    const preloginCozyUrl = new URL("/public/prelogin", cozyUrl).toString();

    try {
      const preloginCozyResponse = await fetch(preloginCozyUrl);

      return preloginCozyResponse.status === 200;
    } catch {
      // If the request fails, we assume the Cozy does not exist.
      // It happens if the user enter a valid URL but that does not answer.
      return false;
    }
  }
  // Cozy customization end
}
