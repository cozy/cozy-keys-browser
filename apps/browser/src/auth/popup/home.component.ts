import { Component, OnInit } from "@angular/core";
/** Cozy custo
 import { FormBuilder, Validators } from "@angular/forms";
*/
import { FormBuilder } from "@angular/forms";
/** end custo */
import { ActivatedRoute, Router } from "@angular/router";

import { EnvironmentService } from "@bitwarden/common/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/abstractions/platformUtils.service";
import { StateService } from "@bitwarden/common/abstractions/state.service";
import { LoginService } from "@bitwarden/common/auth/abstractions/login.service";
/* start Cozy imports */
/* eslint-disable */
import { CryptoFunctionService } from "@bitwarden/common/abstractions/cryptoFunction.service";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/common/tools/generator/password/password-generation.service.abstraction";
import { Utils } from "@bitwarden/common/misc/utils";
import { BrowserApi } from "../../browser/browserApi";
/* eslint-enable */
/* end Cozy imports */

@Component({
  selector: "app-home",
  templateUrl: "home.component.html",
})
export class HomeComponent implements OnInit {
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
    private stateService: StateService,
    private formBuilder: FormBuilder,
    private router: Router,
    private i18nService: I18nService,
    private environmentService: EnvironmentService,
    private route: ActivatedRoute,
    private loginService: LoginService,
    private cryptoFunctionService: CryptoFunctionService,
    private passwordGenerationService: PasswordGenerationServiceAbstraction
  ) {}
  async ngOnInit(): Promise<void> {
    let savedEmail = this.loginService.getEmail();
    const rememberEmail = this.loginService.getRememberEmail();

    if (savedEmail != null) {
      this.formGroup.patchValue({
        email: savedEmail,
        rememberEmail: rememberEmail,
      });
    } else {
      savedEmail = await this.stateService.getRememberedEmail();
      if (savedEmail != null) {
        this.formGroup.patchValue({
          email: savedEmail,
          rememberEmail: true,
        });
      }
    }
  }

  submit() {
    this.formGroup.markAllAsTouched();
    if (this.formGroup.invalid) {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccured"),
        this.i18nService.t("invalidEmail")
      );
      return;
    }

    this.loginService.setEmail(this.formGroup.value.email);
    this.loginService.setRememberEmail(this.formGroup.value.rememberEmail);
    this.router.navigate(["login"], { queryParams: { email: this.formGroup.value.email } });
  }

  get selfHostedDomain() {
    return this.environmentService.hasBaseUrl() ? this.environmentService.getWebVaultUrl() : null;
  }

  setFormValues() {
    this.loginService.setEmail(this.formGroup.value.email);
    this.loginService.setRememberEmail(this.formGroup.value.rememberEmail);
  }

  /* Cozy custo */
  async launchSsoBrowser() {
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
        codeChallenge
    );
  }

  openCozyWebsite() {
    BrowserApi.createNewTab("https://manager.cozycloud.cc/cozy/create");
  }
  /* end custo */
}
