/* Cozy custo
import { Component, NgZone } from "@angular/core";
*/
import { Component, NgZone, Input, OnInit } from "@angular/core";
/* end custo */
import { FormBuilder } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";

import { LoginComponent as BaseLoginComponent } from "@bitwarden/angular/auth/components/login.component";
import { AbstractThemingService } from "@bitwarden/angular/services/theming/theming.service.abstraction";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AppIdService } from "@bitwarden/common/abstractions/appId.service";
import { CryptoFunctionService } from "@bitwarden/common/abstractions/cryptoFunction.service";
import { EnvironmentService } from "@bitwarden/common/abstractions/environment.service";
import { FormValidationErrorsService } from "@bitwarden/common/abstractions/formValidationErrors.service";
import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/abstractions/platformUtils.service";
import { StateService } from "@bitwarden/common/abstractions/state.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { LoginService } from "@bitwarden/common/auth/abstractions/login.service";
import { Utils } from "@bitwarden/common/misc/utils";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/common/tools/generator/password";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";

import { flagEnabled } from "../../flags";

/* start Cozy imports */
/* eslint-disable */
import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { PasswordLogInCredentials } from "@bitwarden/common/auth/models/domain/log-in-credentials";
import { PreloginRequest } from "@bitwarden/common/models/request/prelogin.request";
import { generateWebLink, Q } from "cozy-client";
import { CozySanitizeUrlService } from "../../popup/services/cozySanitizeUrl.service";
import { CozyClientService } from "../../popup/services/cozyClient.service";
import { KonnectorsService } from "../../popup/services/konnectors.service";
import { sanitizeUrlInput } from "./login.component.functions";
import { ThemeType } from "@bitwarden/common/enums/themeType";
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
    apiService: ApiService,
    appIdService: AppIdService,
    authService: AuthService,
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
    loginService: LoginService,
    protected cozySanitizeUrlService: CozySanitizeUrlService,
    private cozyClientService: CozyClientService,
    private konnectorsService: KonnectorsService,
    private themingService: AbstractThemingService
  ) {
    super(
      apiService,
      appIdService,
      authService,
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
      loginService
    );
    super.onSuccessfulLogin = async () => {
      /* Cozy custo
      await syncService.fullSync(true);
      */
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
      this.formGroup.controls.email.setValue(this.loginService.getEmail());
      this.formGroup.controls.rememberEmail.setValue(this.loginService.getRememberEmail());
      this.validateEmail();
    }
  }

  settings() {
    this.router.navigate(["environment"]);
  }

  /** Commented by Cozy
  async launchSsoBrowser() {
    await this.loginService.saveEmailSettings();
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

    await this.stateService.setSsoCodeVerifier(codeVerifier);
    await this.stateService.setSsoState(state);

    let url = this.environmentService.getWebVaultUrl();
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
        encodeURIComponent(this.formGroup.controls.email.value)
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
      await this.environmentService.setUrls({
        base: cozyUrl + "/bitwarden",
      });
      // The email is based on the URL and necessary for login
      const hostname = Utils.getHostname(cozyUrl);
      // this.email = "me@" + hostname;

      const credentials = new PasswordLogInCredentials(
        "me@" + hostname,
        data.masterPassword,
        null,
        null
      );
      this.formPromise = this.authService.logIn(credentials);
      const response = await this.formPromise;
      this.setFormValues();
      await this.loginService.saveEmailSettings();
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
        const disableFavicon = await this.stateService.getDisableFavicon();
        await this.stateService.setDisableFavicon(!!disableFavicon);
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
      await this.themingService.updateConfiguredTheme(ThemeType.LightContrasted);
      await this.stateService.setIsUserSetTheme(false);
    } else if (!isUserSetTheme) {
      await this.themingService.updateConfiguredTheme(ThemeType.System);
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
    await this.environmentService.setUrls({
      base: cozyUrl + "/bitwarden",
    });
    this.stateService.setRememberedEmail(cozyUrl);
  };
  /* end custo */
}
