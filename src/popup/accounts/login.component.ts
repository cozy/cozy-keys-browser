import { Input, NgZone, OnInit , Component } from "@angular/core";
import { Router } from "@angular/router";

import { LoginComponent as BaseLoginComponent } from "jslib-angular/components/login.component";
import { AuthService } from "jslib-common/abstractions/auth.service";
import { CryptoFunctionService } from "jslib-common/abstractions/cryptoFunction.service";
import { EnvironmentService } from "jslib-common/abstractions/environment.service";
import { I18nService } from "jslib-common/abstractions/i18n.service";
import { LogService } from "jslib-common/abstractions/log.service";
import { PasswordGenerationService } from "jslib-common/abstractions/passwordGeneration.service";
import { PlatformUtilsService } from "jslib-common/abstractions/platformUtils.service";
import { StateService } from "jslib-common/abstractions/state.service";
/* start Cozy imports */
/* eslint-disable */
import { Utils } from "jslib-common/misc/utils";
import { AuthResult } from "jslib-common/models/domain/authResult";
import { PasswordLogInCredentials } from "jslib-common/models/domain/logInCredentials";
import { SyncService } from "jslib-common/abstractions/sync.service";
import { PreloginRequest } from "jslib-common/models/request/preloginRequest";
import { generateWebLink, Q } from "cozy-client";
import { ApiService } from "jslib-common/abstractions/api.service";
import { CozySanitizeUrlService } from "../services/cozySanitizeUrl.service";
/* eslint-enable */
/* end Cozy imports */

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
  protected alwaysRememberCozyUrl = false;

  constructor(
    protected authService: AuthService,
    protected router: Router,
    protected platformUtilsService: PlatformUtilsService,
    protected i18nService: I18nService,
    protected stateService: StateService,
    protected environmentService: EnvironmentService,
    protected passwordGenerationService: PasswordGenerationService,
    protected cryptoFunctionService: CryptoFunctionService,
    protected logService: LogService,
    protected ngZone: NgZone,
    protected cozySanitizeUrlService: CozySanitizeUrlService,
    protected syncService: SyncService,
    private apiService: ApiService
  ) {
    super(
      authService,
      router,
      platformUtilsService,
      i18nService,
      stateService,
      environmentService,
      passwordGenerationService,
      cryptoFunctionService,
      logService,
      ngZone
    );
    this.onSuccessfulLogin = () => {
      return syncService.fullSync(true);
    };
  }

  async ngOnInit() {
    if (this.cozyUrl == null || this.cozyUrl === "") {
      this.email = await this.stateService.getRememberedEmail();
      this.cozyUrl = this.email.slice(3);
      if (this.cozyUrl == null) {
        this.cozyUrl = "";
      }
    }
    if (!this.alwaysRememberCozyUrl) {
      this.rememberCozyUrl = (await this.stateService.getRememberedEmail()) != null;
    }
    if (Utils.isBrowser) {
      document
        .getElementById(this.cozyUrl == null || this.cozyUrl === "" ? "cozyUrl" : "masterPassword")
        .focus();
    }
  }

  async submit() {
    try {
      const loginUrl = this.sanitizeUrlInput(this.cozyUrl);

      if (this.masterPassword == null || this.masterPassword === "") {
        this.platformUtilsService.showToast(
          "error",
          this.i18nService.t("errorOccurred"),
          this.i18nService.t("masterPassRequired")
        );
        return;
      }

      // This adds the scheme if missing
      await this.environmentService.setUrls({
        base: loginUrl + "/bitwarden",
      });
      // The email is based on the URL and necessary for login
      const hostname = Utils.getHostname(loginUrl);
      this.email = "me@" + hostname;

      const credentials = new PasswordLogInCredentials(this.email, this.masterPassword, null, null);
      this.formPromise = this.authService.logIn(credentials);
      const response = await this.formPromise;
      if (this.rememberCozyUrl || this.alwaysRememberCozyUrl) {
        await this.stateService.setRememberedEmail(this.email);
      } else {
        await this.stateService.setRememberedEmail(null);
      }
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

  togglePassword() {
    this.showPassword = !this.showPassword;
    document.getElementById("masterPassword").focus();
  }
  /** Commented by Cozy
    async launchSsoBrowser(clientId: string, ssoRedirectUri: string) {
        // Generate necessary sso params
        const passwordOptions: any = {
            type: 'password',
            length: 64,
            uppercase: true,
            lowercase: true,
            numbers: true,
            special: false,
        };
        const state = await this.passwordGenerationService.generatePassword(passwordOptions);
        const ssoCodeVerifier = await this.passwordGenerationService.generatePassword(passwordOptions);
        const codeVerifierHash = await this.cryptoFunctionService.hash(ssoCodeVerifier, 'sha256');
        const codeChallenge = Utils.fromBufferToUrlB64(codeVerifierHash);

        // Save sso params
        await this.storageService.save(ConstantsService.ssoStateKey, state);
        await this.storageService.save(ConstantsService.ssoCodeVerifierKey, ssoCodeVerifier);

        // Build URI
        const webUrl = this.environmentService.getWebVaultUrl();

        // Launch browser
        this.platformUtilsService.launchUri(webUrl + '/#/sso?clientId=' + clientId +
            '&redirectUri=' + encodeURIComponent(ssoRedirectUri) +
            '&state=' + state + '&codeChallenge=' + codeChallenge);
    }

    protected focusInput() {
        document.getElementById(this.email == null || this.email === '' ? 'email' : 'masterPassword').focus();
    }
    END */

  async forgotPassword() {
    if (!this.cozyUrl) {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("cozyUrlRequired")
      );
      return;
    }

    const loginUrl = this.sanitizeUrlInput(this.cozyUrl);

    await this.initializeEnvForCozy(loginUrl);

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
      ? getCozyPassWebURL(loginUrl, cozyConfiguration)
      : getPassphraseResetURL(loginUrl);

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
    await this.environmentService.setUrls({
      base: cozyUrl + "/bitwarden",
    });
    this.stateService.setRememberedEmail(cozyUrl);
  };

  sanitizeUrlInput(inputUrl: string): string {
    // Prevent empty url
    if (!inputUrl) {
      throw new Error("cozyUrlRequired");
    }
    // Prevent email input
    if (inputUrl.includes("@")) {
      throw new Error("noEmailAsCozyUrl");
    }

    if (this.cozySanitizeUrlService.hasMispelledCozy(inputUrl)) {
      throw new Error("hasMispelledCozy");
    }

    return this.cozySanitizeUrlService.normalizeURL(
      inputUrl,
      this.cozySanitizeUrlService.cozyDomain
    );
  }
}
