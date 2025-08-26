import { ClientType } from "../../../../enums";
import { Utils } from "../../../../platform/misc/utils";
import { CaptchaProtectedRequest } from "../captcha-protected.request";

import { DeviceRequest } from "./device.request";
import { TokenTwoFactorRequest } from "./token-two-factor.request";
import { TokenRequest } from "./token.request";

export class PasswordTokenRequest extends TokenRequest implements CaptchaProtectedRequest {
  // Cozy customization
  protected code?: string;
  // Cozy customization end

  constructor(
    public email: string,
    public masterPasswordHash: string,
    public captchaResponse: string,
    protected twoFactor: TokenTwoFactorRequest,
    device?: DeviceRequest,
    // Cozy customization
    code?: string,
    // Cozy customization end
  ) {
    super(twoFactor, device);

    // Cozy customization
    this.code = code;
    // Cozy customization end
  }

  toIdentityToken(clientId: ClientType) {
    const obj = super.toIdentityToken(clientId);

    obj.grant_type = "password";
    obj.username = this.email;
    obj.password = this.masterPasswordHash;

    // Cozy customization
    obj.code = this.code;
    // Cozy customization end

    if (this.captchaResponse != null) {
      obj.captchaResponse = this.captchaResponse;
    }

    return obj;
  }

  alterIdentityTokenHeaders(headers: Headers) {
    headers.set("Auth-Email", Utils.fromUtf8ToUrlB64(this.email));
  }

  static fromJSON(json: any) {
    return Object.assign(Object.create(PasswordTokenRequest.prototype), json, {
      device: json.device ? DeviceRequest.fromJSON(json.device) : undefined,
      twoFactor: json.twoFactor
        ? Object.assign(new TokenTwoFactorRequest(), json.twoFactor)
        : undefined,
    });
  }

  // Cozy customization
  isOidcRequest() {
    return !!this.code;
  }
  // Cozy customization end
}
