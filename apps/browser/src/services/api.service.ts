import { AppIdService } from "@bitwarden/common/abstractions/appId.service";
import { EnvironmentService } from "@bitwarden/common/abstractions/environment.service";
import { PlatformUtilsService } from "@bitwarden/common/abstractions/platformUtils.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { PasswordTokenRequest } from "@bitwarden/common/auth/models/request/identity-token/password-token.request";
import { SsoTokenRequest } from "@bitwarden/common/auth/models/request/identity-token/sso-token.request";
import { UserApiTokenRequest } from "@bitwarden/common/auth/models/request/identity-token/user-api-token.request";
import { IdentityTwoFactorResponse } from "@bitwarden/common/auth/models/response/identity-two-factor.response";
import { DeviceType } from "@bitwarden/common/enums/deviceType";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { ApiService as BaseApiService } from "@bitwarden/common/services/api.service";

import { IdentityTokenResponse } from "../models/response/identityTokenResponse";

function getDeviceName(deviceType: DeviceType): string {
  switch (deviceType) {
    case DeviceType.ChromeExtension:
      return "Chrome";

    case DeviceType.FirefoxExtension:
      return "Firefox";

    case DeviceType.SafariExtension:
      return "Safari";

    default:
      return "";
  }
}

/**
 * This file is specific to Cozy.
 * We extend the jslib's ApiService and override the `postIdentityToken` method
 * to pass the client name to the stack, so in cozy-settings we can show
 * "Cozy Password (browser name)" in the connected devices list.
 * We also had to copy/paste some private methods because we can't access it
 * from child class.
 * Orignal file :
 *    https://github.com/bitwarden/jslib/blob/669f6ddf93bbfe8acd18a4834fff5e1c7f9c91ba/src/services/api.service.ts
 */
export class ApiService extends BaseApiService {
  /* tslint:disable-next-line */
  private _device: DeviceType;
  /* tslint:disable-next-line */
  private _deviceType: string;
  /* tslint:disable-next-line */
  private _isWebClient = false;
  /* tslint:disable-next-line */
  private _isDesktopClient = false;
  /* tslint:disable-next-line */
  private _usingBaseUrl = false;

  constructor(
    /* tslint:disable-next-line */
    private _tokenService: TokenService,
    /* tslint:disable-next-line */
    private _platformUtilsService: PlatformUtilsService,
    /* tslint:disable-next-line */
    private _environmentService: EnvironmentService,
    /* tslint:disable-next-line */
    private _appIdService: AppIdService,
    /* tslint:disable-next-line */
    private _logoutCallback: (expired: boolean) => Promise<void>,
    /* tslint:disable-next-line */
    private _customUserAgent: string = null
  ) {
    super(
      _tokenService,
      _platformUtilsService,
      _environmentService,
      _appIdService,
      _logoutCallback,
      _customUserAgent
    );

    this._device = _platformUtilsService.getDevice();
    this._deviceType = this._device.toString();
    this._isWebClient =
      this._device === DeviceType.IEBrowser ||
      this._device === DeviceType.ChromeBrowser ||
      this._device === DeviceType.EdgeBrowser ||
      this._device === DeviceType.FirefoxBrowser ||
      this._device === DeviceType.OperaBrowser ||
      this._device === DeviceType.SafariBrowser ||
      this._device === DeviceType.UnknownBrowser ||
      this._device === DeviceType.VivaldiBrowser;
  }

  // Auth APIs

  async postIdentityToken(
    request: UserApiTokenRequest | PasswordTokenRequest | SsoTokenRequest
  ): Promise<IdentityTokenResponse | IdentityTwoFactorResponse> {
    const headers = new Headers({
      "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
      Accept: "application/json",
      "Device-Type": this._deviceType,
    });
    if (this._customUserAgent != null) {
      headers.set("User-Agent", this._customUserAgent);
    }

    const identityToken =
      request instanceof UserApiTokenRequest
        ? request.toIdentityToken()
        : request.toIdentityToken(this._platformUtilsService.getClientType());
    const bodyData = {
      ...identityToken,
      clientName: `Cozy Pass (${getDeviceName(this._device)})`,
    };
    const response = await this.fetch(
      new Request(this._environmentService.getIdentityUrl() + "/connect/token", {
        body: this._qsStringify(bodyData),
        credentials: this._getCredentials(),
        cache: "no-store",
        headers: headers,
        method: "POST",
      })
    );

    let responseJson: any = null;
    if (this._isJsonResponse(response)) {
      responseJson = await response.json();
    }

    if (responseJson != null) {
      if (response.status === 200) {
        return new IdentityTokenResponse(responseJson);
      } else if (
        response.status === 400 &&
        responseJson.TwoFactorProviders2 &&
        Object.keys(responseJson.TwoFactorProviders2).length
      ) {
        await this._tokenService.clearTwoFactorToken();
        return new IdentityTwoFactorResponse(responseJson);
      }
    }

    return Promise.reject(new ErrorResponse(responseJson, response.status, true));
  }

  private _isJsonResponse(response: Response): boolean {
    const typeHeader = response.headers.get("content-type");
    return typeHeader != null && typeHeader.indexOf("application/json") > -1;
  }

  private _getCredentials(): RequestCredentials {
    if (!this._isWebClient || this._environmentService.hasBaseUrl()) {
      return "include";
    }
    return undefined;
  }

  private _qsStringify(params: any): string {
    return Object.keys(params)
      .map((key) => {
        return encodeURIComponent(key) + "=" + encodeURIComponent(params[key]);
      })
      .join("&");
  }
}
