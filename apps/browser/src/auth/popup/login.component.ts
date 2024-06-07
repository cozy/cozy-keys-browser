/* Cozy custo
import { Component, NgZone } from "@angular/core";
*/
import { Component, NgZone, Input, OnInit } from "@angular/core";
/* end custo */
import { FormBuilder } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { LoginComponent as BaseLoginComponent } from "@bitwarden/angular/auth/components/login.component";
import { FormValidationErrorsService } from "@bitwarden/angular/platform/abstractions/form-validation-errors.service";
import {
  LoginStrategyServiceAbstraction,
  LoginEmailServiceAbstraction,
  PasswordLoginCredentials,
} from "@bitwarden/auth/common";
import { DevicesApiServiceAbstraction } from "@bitwarden/common/auth/abstractions/devices-api.service.abstraction";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { WebAuthnLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/webauthn/webauthn-login.service.abstraction";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { EnvironmentService, Region } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/common/tools/generator/password";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";

import { flagEnabled } from "../../platform/flags";

/* start Cozy imports */
/* eslint-disable */
import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { PreloginRequest } from "@bitwarden/common/models/request/prelogin.request";
import { generateWebLink, Q } from "cozy-client";
import { CozySanitizeUrlService } from "../../popup/services/cozySanitizeUrl.service";
import { CozyClientService } from "../../popup/services/cozyClient.service";
import { KonnectorsService } from "../../popup/services/konnectors.service";
import { sanitizeUrlInput } from "./login.component.functions";
import { AbstractThemingService } from "@bitwarden/angular/platform/services/theming/theming.service.abstraction";
import { ThemeType } from "@bitwarden/common/platform/enums/theme-type.enum";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
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
  return `${cozyUrl}/auth/passphrase_reset`;
};

const shouldRedirectToOIDCPasswordPage = (cozyConfiguration: CozyConfiguration) => {
  const shouldRedirect = cozyConfiguration.OIDC && !cozyConfiguration.HasCiphers;

  return shouldRedirect;
};
/* end custo */

@Component({
  selector: "app-login",
  templateUrl: "login.component.html",
})
/**
 *    This class is a mix of the LoginComponent from jslib and the one from the repo.
 *      jslib/src/angular/components/login.component.ts
 *
 *    We extended the component to avoid to have to modify jslib, as the private storageService
 *    prevented us to just override methods.
 *    See the original component:
 *    https://github.com/bitwarden/browser/blob/
 *    af8274247b2242fe93ad2f7ca4c13f9f7ecf2860/src/popup/accounts/login.component.ts
 */
export class LoginComponent extends BaseLoginComponent implements OnInit {
  showPasswordless = false;
  /* Cozy custo */
  @Input() cozyUrl = "";
  @Input() rememberCozyUrl = true;

  email = "";
  masterPassword = "";
  showPassword = false;
  formPromise: Promise<AuthResult>;
  onSuccessfulLogin: () => Promise<any>;
  onSuccessfulLoginNavigate: () => Promise<any>;
  onSuccessfulLoginTwoFactorNavigate: () => Promise<any>;
  onSuccessfulLoginForceResetNavigate: () => Promise<any>;

  protected twoFactorRoute = "2fa";
  protected successRoute = "/tabs/vault";
  protected forcePasswordResetRoute = "update-temp-password";
  /* end custo */
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
    protected cozySanitizeUrlService: CozySanitizeUrlService,
    private cozyClientService: CozyClientService,
    private konnectorsService: KonnectorsService,
    private themeStateService: ThemeStateService,
    private apiService: ApiService,
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
    );
    super.onSuccessfulLogin = async () => {
      /* Cozy custo
      await syncService.fullSync(true);
      */
     console.log('onSuccessfulLogin')
      const syncPromise = syncService.fullSync(true).then(() => {
        this.cozyClientService.saveCozyCredentials(
          sanitizeUrlInput(this.formGroup.value.email, this.cozySanitizeUrlService),
          this.formGroup.value.masterPassword
        );
      });
      this.konnectorsService.getKonnectorsOrganization();
      return syncPromise;
      /* end custo */
    };
    super.successRoute = "/tabs/vault";
    this.showPasswordless = flagEnabled("showPasswordless");

    if (this.showPasswordless) {
      this.formGroup.controls.email.setValue(this.loginEmailService.getEmail());
      this.formGroup.controls.rememberEmail.setValue(this.loginEmailService.getRememberEmail());
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.validateEmail();
    }
  }

  settings() {
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.router.navigate(["environment"]);
  }

  /** Commented by Cozy
  async launchSsoBrowser() {
    // Save off email for SSO
    await this.ssoLoginService.setSsoEmail(this.formGroup.value.email);
    await this.loginEmailService.saveEmailSettings();
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
  end comment */

  /* Cozy custo */
  async submit() {
    const data = this.formGroup.value;

    // await this.setupCaptcha();

    this.formGroup.markAllAsTouched();

    try {
      const cozyUrl = sanitizeUrlInput(data.email, this.cozySanitizeUrlService);

      if (data.masterPassword == null || data.masterPassword === "") {
        this.platformUtilsService.showToast(
          "error",
          this.i18nService.t("errorOccurred"),
          this.i18nService.t("masterPassRequired")
        );
        return;
      }

      // This adds the scheme if missing
      await this.environmentService.setEnvironment(Region.SelfHosted, {
        base: cozyUrl + "/bitwarden",
      });
      // The email is based on the URL and necessary for login
      const hostname = Utils.getHostname(cozyUrl);
      // this.email = "me@" + hostname;

      const credentials = new PasswordLoginCredentials(
        "me@" + hostname,
        data.masterPassword,
        null,
        null
      );
      this.formPromise = this.loginStrategyService.logIn(credentials);
      const response = await this.formPromise;

      this.setLoginEmailValues();
      await this.loginEmailService.saveEmailSettings();
      if (this.handleCaptchaRequired(response)) {
        return;
      } else if (response.requiresTwoFactor) {
        if (this.onSuccessfulLoginTwoFactorNavigate != null) {
          this.onSuccessfulLoginTwoFactorNavigate();
        } else {
          this.router.navigate([this.twoFactorRoute]);
        }
      } else if (response.forcePasswordReset) {
        if (this.onSuccessfulLoginForceResetNavigate != null) {
          this.onSuccessfulLoginForceResetNavigate();
        } else {
          this.router.navigate([this.forcePasswordResetRoute]);
        }
      } else {
        // WHATISIT
        // const disableFavicon = await this.stateService.getDisableFavicon();
        // await this.stateService.setDisableFavicon(!!disableFavicon);
        // Cozy customization, set correct theme based on cozy's context
        //*
        await this.configureTheme();
        //*/
        if (this.onSuccessfulLogin != null) {
          this.onSuccessfulLogin();
        }
        if (this.onSuccessfulLoginNavigate != null) {
          this.onSuccessfulLoginNavigate();
        } else {
          this.router.navigate([this.successRoute]);
        }
      }
    } catch (e) {
      this.logService.error(e);
    }
  }

  // Cozy customization, set correct theme based on cozy's context
  //*
  async configureTheme() {
    const useContrastedThemeByDefault = await this.cozyClientService.getFlagValue(
      "passwords.theme.default-contrasted"
    );

    const isUserSetTheme = await this.stateService.getIsUserSetTheme();

    if (useContrastedThemeByDefault) {
      await this.themeStateService.setSelectedTheme(ThemeType.LightContrasted);
      await this.stateService.setIsUserSetTheme(false);
    } else if (!isUserSetTheme) {
      await this.themeStateService.setSelectedTheme(ThemeType.System);
    }
  }
  //*/

  togglePassword() {
    this.showPassword = !this.showPassword;
    document.getElementById("masterPassword").focus();
  }

  async forgotPassword() {
    const cozyUrl = sanitizeUrlInput(this.formGroup.value.email, this.cozySanitizeUrlService);
    if (!cozyUrl) {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("cozyUrlRequired")
      );
      return;
    }

    await this.initializeEnvForCozy(cozyUrl);

    let cozyConfiguration: CozyConfiguration = {};
    try {
      cozyConfiguration = await this.getCozyConfiguration();
    } catch (e) {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("invalidCozyUrl")
      );
      return;
    }

    const shouldRedirectToOidc = shouldRedirectToOIDCPasswordPage(cozyConfiguration);

    const url = shouldRedirectToOidc
      ? getCozyPassWebURL(cozyUrl, cozyConfiguration)
      : getPassphraseResetURL(cozyUrl);

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
    const cozyUrl = sanitizeUrlInput(this.formGroup.value.email, this.cozySanitizeUrlService);
    const preloginResponse = await this.apiService.postPrelogin(new PreloginRequest(cozyUrl));

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

    this.loginEmailService.setEmail(cozyUrl);
    this.loginEmailService.setRememberEmail(true);
    await this.loginEmailService.saveEmailSettings();
  };
  /* end custo */
}
