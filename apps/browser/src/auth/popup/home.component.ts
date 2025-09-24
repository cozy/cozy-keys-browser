import { Component, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { FormBuilder } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { Subject, firstValueFrom, first, takeUntil } from "rxjs";

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
import { getLoginSuccessPageUri, extractDomain } from "../../../src/cozy/sso/helpers";
/* eslint-enable */
/* end Cozy imports */

const DEV_STACK_OAUTHCALLBACK_URI = "https://oauthcallback.cozy.wtf";
const INT_STACK_OAUTHCALLBACK_URI = "https://oauthcallback.cozy.works";
const PROD_STACK_OAUTHCALLBACK_URI = "https://oauthcallback.mycozy.cloud";

@Component({
  selector: "app-home",
  templateUrl: "home.component.html",
})
export class HomeComponent implements OnInit, OnDestroy {
  @ViewChild(EnvironmentSelectorComponent, { static: true })
  environmentSelector!: EnvironmentSelectorComponent;
  private destroyed$: Subject<void> = new Subject();

  loginInitiated = false;
  loginMode = "DEFAULT";
  formGroup = this.formBuilder.group({
    /** Cozy custo
    email: ["", [Validators.required, Validators.email]],
     */
    email: [""],
    companyEmail: [""],
    /** end custo */
    rememberEmail: [false],
  });

  // Cozy customization; to change stack URI
  logoClickCount = 0;
  baseUri = PROD_STACK_OAUTHCALLBACK_URI;
  // Cozy customization

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
    private route: ActivatedRoute,
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

    // Cozy customization; avoid redirection if coming after a "Cancel" from login view
    this.route.queryParams.pipe(first(), takeUntil(this.destroyed$)).subscribe((params) => {
      if (!params.noRedirect) {
        this.redirectIfSSOLoginSuccessTab();
      }
    });
    // Cozy customization

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

  /* Cozy custo */
  openTwakeLogin() {
    const extensionUri = this.platformUtilsService.getExtensionUri();
    const redirectUri = getLoginSuccessPageUri(extensionUri);

    BrowserApi.createNewTab(`${this.baseUri}/oidc/bitwarden/twake?redirect_uri=${redirectUri}`);
  }
  /* end custo */

  /* Cozy custo */
  setDefaultMode() {
    this.loginMode = "DEFAULT";
  }

  setCompanyMode() {
    this.loginMode = "COMPANY";
  }

  setUrlMode() {
    this.loginMode = "URL";
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

  async getLoginUri(companyEmail: string): Promise<URL | null> {
    try {
      const domain = extractDomain(companyEmail);

      if (!domain) {
        throw new Error();
      }

      const extensionUri = this.platformUtilsService.getExtensionUri();
      const redirectUri = getLoginSuccessPageUri(extensionUri);

      const uriFromWellKnown = await this.fetchLoginUriWithWellKnown(domain);

      if (uriFromWellKnown) {
        uriFromWellKnown.searchParams.append("redirect_uri", redirectUri);
        return uriFromWellKnown;
      }

      return null;
    } catch {
      return null;
    }
  }

  private async fetchLoginUriWithWellKnown(domain: string): Promise<URL | null> {
    const url = `https://${domain}/.well-known/twake-configuration`;

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      if (response.ok) {
        const twakeConfiguration = await response.json();

        return new URL(twakeConfiguration["twake-pass-login-uri"]) || null;
      } else {
        return null;
      }
    } catch {
      return null;
    }
  }

  async openCompanyLogin() {
    const companyEmail = this.formGroup.value.companyEmail;

    if (!companyEmail) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccured"),
        message: this.i18nService.t("emailRequired"),
      });
      return;
    }

    const loginUri = await this.getLoginUri(companyEmail);

    if (loginUri) {
      BrowserApi.createNewTab(loginUri.toString());
    } else {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccured"),
        message: this.i18nService.t("companyServerError"),
      });
    }
  }

  // Cozy customization
  async redirectIfSSOLoginSuccessTab() {
    chrome.tabs.query({}, (tabs) => {
      const extensionUri = this.platformUtilsService.getExtensionUri();
      const redirectUri = getLoginSuccessPageUri(extensionUri);

      const SSOLoginSuccessTab = tabs.find(
        (tab) => tab.status === "complete" && tab.url.startsWith(redirectUri),
      );

      if (SSOLoginSuccessTab) {
        const url = new URL(SSOLoginSuccessTab.url);
        const instance = url.searchParams.get("instance");
        const code = url.searchParams.get("code");

        const cozyUrl = this.cozySanitizeUrlService.sanitizeUrlInput(instance);

        this.router.navigate(["login"], {
          queryParams: { email: cozyUrl, cozyUrl: cozyUrl, code },
        });
      }
    });
  }
  // Cozy customization end

  // Cozy customization
  async logoClicked() {
    this.logoClickCount++;

    if (this.logoClickCount >= 6) {
      const rest = this.logoClickCount % 3;

      if (rest === 0) {
        this.baseUri = DEV_STACK_OAUTHCALLBACK_URI;
      } else if (rest === 1) {
        this.baseUri = INT_STACK_OAUTHCALLBACK_URI;
      } else if (rest === 2) {
        this.baseUri = PROD_STACK_OAUTHCALLBACK_URI;
      }

      this.toastService.showToast({
        variant: "info",
        title: "New base URI",
        message: this.baseUri,
      });
    }
  }
  // Cozy customization end
}
