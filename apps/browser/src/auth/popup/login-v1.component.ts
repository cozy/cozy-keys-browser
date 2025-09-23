import { Component, NgZone, OnInit } from "@angular/core";
import { FormBuilder } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { LoginComponentV1 as BaseLoginComponent } from "@bitwarden/angular/auth/components/login-v1.component";
import { FormValidationErrorsService } from "@bitwarden/angular/platform/abstractions/form-validation-errors.service";
import {
  LoginStrategyServiceAbstraction,
  LoginEmailServiceAbstraction,
  PasswordLoginCredentials,
  RegisterRouteService,
} from "@bitwarden/auth/common";
import { DevicesApiServiceAbstraction } from "@bitwarden/common/auth/abstractions/devices-api.service.abstraction";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { WebAuthnLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/webauthn/webauthn-login.service.abstraction";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import {
  EnvironmentService,
  Region,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { ToastService } from "@bitwarden/components";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";

import { flagEnabled } from "../../platform/flags";

/* start Cozy imports */
/* eslint-disable */
import { generateWebLink } from "cozy-client";
import { CozyClientService } from "../../popup/services/cozyClient.service";
import { KonnectorsService } from "../../popup/services/konnectors.service";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { ThemeType } from "@bitwarden/common/platform/enums";
import { PreloginRequest } from "@bitwarden/common/models/request/prelogin.request";
/* eslint-enable */
/* end Cozy imports */

/* Cozy custo */
type CozyConfiguration = {
  HasCiphers?: boolean;
  OIDC?: boolean;
  FlatSubdomains?: boolean;
};

const getCozyPassWebURL = (cozyUrl: string, cozyConfiguration: CozyConfiguration) => {
  const link = generateWebLink({
    cozyUrl: cozyUrl,
    searchParams: [],
    pathname: "",
    hash: "",
    slug: "passwords",
    subDomainType: cozyConfiguration.FlatSubdomains ? "flat" : "nested",
  });

  return link;
};

const getPassphraseResetURL = (cozyUrl: string) => {
  return `https://${cozyUrl}/auth/passphrase_reset`;
};

const shouldRedirectToOIDCPasswordPage = (cozyConfiguration: CozyConfiguration) => {
  const shouldRedirect = cozyConfiguration.OIDC && !cozyConfiguration.HasCiphers;

  return shouldRedirect;
};
/* end custo */

@Component({
  selector: "app-login",
  templateUrl: "login-v1.component.html",
})
export class LoginComponentV1 extends BaseLoginComponent implements OnInit {
  showPasswordless = false;
  constructor(
    devicesApiService: DevicesApiServiceAbstraction,
    appIdService: AppIdService,
    loginStrategyService: LoginStrategyServiceAbstraction,
    router: Router,
    protected platformUtilsService: PlatformUtilsService,
    protected i18nService: I18nService,
    protected stateService: StateService,
    protected environmentService: EnvironmentService,
    protected passwordGenerationService: PasswordGenerationServiceAbstraction,
    protected cryptoFunctionService: CryptoFunctionService,
    syncService: SyncService,
    logService: LogService,
    ngZone: NgZone,
    formBuilder: FormBuilder,
    formValidationErrorService: FormValidationErrorsService,
    route: ActivatedRoute,
    loginEmailService: LoginEmailServiceAbstraction,
    ssoLoginService: SsoLoginServiceAbstraction,
    webAuthnLoginService: WebAuthnLoginServiceAbstraction,
    protected cozyClientService: CozyClientService,
    protected konnectorsService: KonnectorsService,
    protected themeStateService: ThemeStateService,
    protected apiService: ApiService,
    registerRouteService: RegisterRouteService,
    toastService: ToastService,
  ) {
    super(
      devicesApiService,
      appIdService,
      loginStrategyService,
      router,
      platformUtilsService,
      i18nService,
      stateService,
      environmentService,
      passwordGenerationService,
      cryptoFunctionService,
      logService,
      ngZone,
      formBuilder,
      formValidationErrorService,
      route,
      loginEmailService,
      ssoLoginService,
      webAuthnLoginService,
      registerRouteService,
      toastService,
    );
    this.onSuccessfulLogin = async () => {
      // Cozy customization
      //*
      const syncPromise = syncService.fullSync(true).then(() => {
        this.cozyClientService.saveCozyCredentials(
          this.cozyUrl,
          this.formGroup.value.masterPassword,
        );
      });
      this.konnectorsService.getKonnectorsOrganization();
      return syncPromise;
      /*/
      await syncService.fullSync(true);
      //*/
    };
    this.successRoute = "/tabs/vault";
    this.showPasswordless = flagEnabled("showPasswordless");
  }

  async ngOnInit(): Promise<void> {
    await super.ngOnInit();
    if (this.showPasswordless) {
      await this.validateEmail();
    }
  }

  settings() {
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.router.navigate(["environment"]);
  }

  async launchSsoBrowser() {
    // Save off email for SSO
    await this.ssoLoginService.setSsoEmail(this.formGroup.value.email);

    // Generate necessary sso params
    const passwordOptions: any = {
      type: "password",
      length: 64,
      uppercase: true,
      lowercase: true,
      numbers: true,
      special: false,
    };

    const state =
      (await this.passwordGenerationService.generatePassword(passwordOptions)) +
      ":clientId=browser";
    const codeVerifier = await this.passwordGenerationService.generatePassword(passwordOptions);
    const codeVerifierHash = await this.cryptoFunctionService.hash(codeVerifier, "sha256");
    const codeChallenge = Utils.fromBufferToUrlB64(codeVerifierHash);

    await this.ssoLoginService.setCodeVerifier(codeVerifier);
    await this.ssoLoginService.setSsoState(state);

    const env = await firstValueFrom(this.environmentService.environment$);
    let url = env.getWebVaultUrl();
    if (url == null) {
      url = "https://vault.bitwarden.com";
    }

    const redirectUri = url + "/sso-connector.html";

    // Launch browser
    this.platformUtilsService.launchUri(
      url +
        "/#/sso?clientId=browser" +
        "&redirectUri=" +
        encodeURIComponent(redirectUri) +
        "&state=" +
        state +
        "&codeChallenge=" +
        codeChallenge +
        "&email=" +
        encodeURIComponent(this.formGroup.controls.email.value),
    );
  }

  // Cozy customization
  async submit(showToast = true) {
    const data = this.formGroup.value;

    // await this.setupCaptcha();

    this.formGroup.markAllAsTouched();

    if (data.masterPassword == null || data.masterPassword === "") {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("masterPassRequired"),
      );
      return;
    }

    try {
      // This adds the scheme if missing
      await this.environmentService.setEnvironment(Region.SelfHosted, {
        base: this.cozyUrl + "/bitwarden",
        oidc: this.cozyUrl + "/oidc/bitwarden",
      });

      // The email is based on the URL and necessary for login
      const hostname = Utils.getHostname(this.cozyUrl);

      const credentials = new PasswordLoginCredentials(
        "me@" + hostname,
        data.masterPassword,
        null,
        null,
        this.code,
      );

      this.formPromise = this.loginStrategyService.logIn(credentials);
      const response = await this.formPromise;

      await this.saveEmailSettings();

      if (this.handleCaptchaRequired(response)) {
        return;
      } else if (await this.handleMigrateEncryptionKey(response)) {
        return;
      } else if (response.requiresTwoFactor) {
        if (this.onSuccessfulLoginTwoFactorNavigate != null) {
          // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          this.onSuccessfulLoginTwoFactorNavigate();
        } else {
          // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          this.router.navigate([this.twoFactorRoute]);
        }
      } else if (response.forcePasswordReset != ForceSetPasswordReason.None) {
        if (this.onSuccessfulLoginForceResetNavigate != null) {
          // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          this.onSuccessfulLoginForceResetNavigate();
        } else {
          // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          this.router.navigate([this.forcePasswordResetRoute]);
        }
      } else {
        if (this.onSuccessfulLogin != null) {
          // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          this.onSuccessfulLogin();
        }
        if (this.onSuccessfulLoginNavigate != null) {
          // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          this.onSuccessfulLoginNavigate(response.userId);
        } else {
          // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          this.router.navigate([this.successRoute]);
        }
      }
    } catch (e) {
      this.logService.error(e);
    }
  }

  // TODOCOZY
  // togglePassword() {
  //   this.showPassword = !this.showPassword;
  //   document.getElementById("masterPassword").focus();
  // }

  async forgotPassword() {
    if (!this.cozyUrl) {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("cozyUrlRequired"),
      );
      return;
    }

    await this.initializeEnvForCozy(this.cozyUrl);

    let cozyConfiguration: CozyConfiguration = {};
    try {
      cozyConfiguration = await this.getCozyConfiguration();
    } catch (e) {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("invalidCozyUrl"),
      );
      return;
    }

    const shouldRedirectToOidc = shouldRedirectToOIDCPasswordPage(cozyConfiguration);

    const url = shouldRedirectToOidc
      ? getCozyPassWebURL(this.cozyUrl, cozyConfiguration)
      : getPassphraseResetURL(this.cozyUrl);

    const browser = window.browser || window.chrome;
    await browser.tabs.create({
      active: true,
      url: url,
    });

    // Close popup
    const popupWindows = browser.extension.getViews({ type: "popup" });
    if (popupWindows.find((w: Window) => w === window)) {
      window.close();
    }
  }

  private getCozyConfiguration = async (): Promise<CozyConfiguration> => {
    const preloginResponse = await this.apiService.postPrelogin(new PreloginRequest(this.cozyUrl));

    const { HasCiphers, OIDC, FlatSubdomains } = (preloginResponse as any).response;

    return { HasCiphers, OIDC, FlatSubdomains };
  };

  /*
   * Initialize EnvironmentService with cozyUrl input so it can be used by ApiService
   * Also save cozyUrl input in storageService so it will be pre-filled on next popup opening
   */
  private initializeEnvForCozy = async (cozyUrl: string) => {
    await this.environmentService.setEnvironment(Region.SelfHosted, {
      base: cozyUrl + "/bitwarden",
    });

    this.loginEmailService.setLoginEmail(cozyUrl);
    this.loginEmailService.setRememberEmail(true);
    await this.loginEmailService.saveEmailSettings();
  };
  /* end custo */

  async saveEmailSettings() {
    // values should be saved on home component
    return;
  }
}
