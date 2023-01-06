import { Directive, Input, NgZone, OnInit } from "@angular/core";

import { Router } from "@angular/router";

import { take } from "rxjs/operators";

import { AuthResult } from "jslib-common/models/domain/authResult";
import { PasswordLogInCredentials } from "jslib-common/models/domain/logInCredentials";

import { AuthService } from "jslib-common/abstractions/auth.service";
import { CryptoFunctionService } from "jslib-common/abstractions/cryptoFunction.service";
import { EnvironmentService } from "jslib-common/abstractions/environment.service";
import { I18nService } from "jslib-common/abstractions/i18n.service";
import { LogService } from "jslib-common/abstractions/log.service";
import { PasswordGenerationService } from "jslib-common/abstractions/passwordGeneration.service";
import { PlatformUtilsService } from "jslib-common/abstractions/platformUtils.service";
import { StateService } from "jslib-common/abstractions/state.service";
import { StorageService } from "jslib-common/abstractions/storage.service";

import { Utils } from "jslib-common/misc/utils";

// import { CaptchaProtectedComponent } from "@bitwarden/jslib-angular/src/components/captchaProtected.component";
import { LoginComponent as BaseLoginComponent } from "jslib-angular/components/login.component";

/* start Cozy imports */
import BrowserMessagingService from "../../services/browserMessaging.service";
import { SyncService } from "jslib-common/abstractions/sync.service";
import { PreloginRequest } from "jslib-common/models/request/preloginRequest";
import { PreloginResponse } from "jslib-common/models/response/preloginResponse";
import { generateWebLink, Q } from "cozy-client";
import { ApiService } from "jslib-common/abstractions/api.service";
import { Component } from "@angular/core";
import { CozyClientService } from "../services/cozyClient.service";
import { CozySanitizeUrlService } from "../services/cozySanitizeUrl.service";
/* end Cozy imports */

type CozyConfiguration = {
  HasCiphers?: boolean;
  OIDC?: boolean;
  FlatSubdomains?: boolean;
};

const messagingService = new BrowserMessagingService();

const Keys = {
  rememberedCozyUrl: "rememberedCozyUrl",
  rememberCozyUrl: "rememberCozyUrl",
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
  @Input() cozyUrl: string = "";
  @Input() rememberCozyUrl = true;

  masterPassword: string = "";
  showPassword: boolean = false;
  formPromise: Promise<AuthResult>;
  onSuccessfulLogin: () => Promise<any>;
  onSuccessfulLoginNavigate: () => Promise<any>;
  onSuccessfulLoginTwoFactorNavigate: () => Promise<any>;
  onSuccessfulLoginForceResetNavigate: () => Promise<any>;

  protected twoFactorRoute = "2fa";
  protected successRoute = "/tabs/vault";
  protected forcePasswordResetRoute = "update-temp-password";
  protected alwaysRememberCozyUrl: boolean = false;

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
      this.cozyUrl = await this.stateService.getRememberedEmail();
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

  /*
  async ngOnInit_old() {
    if (this.cozyUrl == null || this.cozyUrl === "") {
      this.cozyUrl = await this.storageService.get<string>(Keys.rememberedCozyUrl);
      if (this.cozyUrl == null) {
        this.cozyUrl = "";
      }
    }
    this.rememberCozyUrl = await this.storageService.get<boolean>(Keys.rememberCozyUrl);
    if (this.rememberCozyUrl == null) {
      this.rememberCozyUrl = true;
    }
    if (Utils.isBrowser) {
      document
        .getElementById(this.cozyUrl == null || this.cozyUrl === "" ? "cozyUrl" : "masterPassword")
        .focus();
    }
  }
  */
  async submit() {
    console.log("submit login");

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
      this.cozyUrl = "me@" + hostname;

      const credentials = new PasswordLogInCredentials(
        this.cozyUrl,
        this.masterPassword,
        null,
        null
      );
      this.formPromise = this.authService.logIn(credentials);
      const response = await this.formPromise;
      if (this.rememberCozyUrl || this.alwaysRememberCozyUrl) {
        await this.stateService.setRememberedEmail(this.cozyUrl);
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

  /*
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

      this.formPromise = this.authService.logIn(this.email, this.masterPassword).catch((e) => {
        if (e.response && e.response.error && e.response.error === "invalid password") {
          this.platformUtilsService.showToast(
            "error",
            this.i18nService.t("errorOccurred"),
            this.i18nService.t("invalidMasterPassword")
          );
          // Returning null here so that the validation service in jslib
          // does not consider the result of the call as an error, otherwise
          // we would have a double toast
          return null;
        }
        throw e;
      });
      const response = await this.formPromise;
      if (!response) {
        return;
      }

      // Save the URL for next time
      await this.storageService.save(Keys.rememberCozyUrl, this.rememberCozyUrl);
      if (this.rememberCozyUrl) {
        await this.storageService.save(Keys.rememberedCozyUrl, loginUrl);
      } else {
        await this.storageService.remove(Keys.rememberedCozyUrl);
      }
      if (response.twoFactor) {
        if (this.onSuccessfulLoginTwoFactorNavigate != null) {
          this.onSuccessfulLoginTwoFactorNavigate();
        } else {
          this.router.navigate([this.twoFactorRoute]);
        }
      } else {
        messagingService.send("loggedIn");
        const disableFavicon = await this.storageService.get<boolean>(
          ConstantsService.disableFaviconKey
        );
        await this.stateService.save(ConstantsService.disableFaviconKey, !!disableFavicon);
        if (this.onSuccessfulLogin != null) {
          this.onSuccessfulLogin();
        }
        if (this.onSuccessfulLoginNavigate != null) {
          this.onSuccessfulLoginNavigate();
        } else {
          this.router.navigate([this.successRoute], {
            queryParams: { activatedPanel: "currentPageCiphers" },
          });
        }
      }
    } catch (e) {
      const translatableMessages = ["cozyUrlRequired", "noEmailAsCozyUrl", "hasMispelledCozy"];

      if (translatableMessages.includes(e.message)) {
        this.platformUtilsService.showToast(
          "error",
          this.i18nService.t("errorOccurred"),
          this.i18nService.t(e.message)
        );
      } else {
        this.platformUtilsService.showToast("error", this.i18nService.t("errorOccurred"), "");
      }
    }
  }
  */

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
