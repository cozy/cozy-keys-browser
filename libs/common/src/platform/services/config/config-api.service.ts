import { ApiService } from "../../../abstractions/api.service";
import { TokenService } from "../../../auth/abstractions/token.service";
import { UserId } from "../../../types/guid";
import { ConfigApiServiceAbstraction } from "../../abstractions/config/config-api.service.abstraction";
import { ServerConfigResponse } from "../../models/response/server-config.response";

export class ConfigApiService implements ConfigApiServiceAbstraction {
  constructor(
    private apiService: ApiService,
    private tokenService: TokenService,
  ) {}

  async get(userId: UserId | undefined): Promise<ServerConfigResponse> {
    // Authentication adds extra context to config responses, if the user has an access token, we want to use it
    // We don't particularly care about ensuring the token is valid and not expired, just that it exists

    // Cozy customization, mock ConfigApi server response
    // cozy-stack does not implement /api/config route
    // Everything is fake but "looks good"
    // These route is used mainly to get server configuration and feature flags
    //*
    return new ServerConfigResponse({
      Version: "2020.0.0", // Arbitrary, must be lower than 2024.2.0, the only check by checkServerMeetsVersionRequirement
      GitHash: "c670da43",
      Server: null,
      Environment: {
        CloudRegion: "EU",
        Vault: "https://cozy.io",
        Api: "https://cozy.io",
        Identity: "https://cozy.io",
        Notifications: "https://cozy.io",
        Sso: "https://cozy.io",
      },
      FeatureStates: {},
      object: "config",
    });
    /*/
    const authed: boolean =
      userId == null ? false : (await this.tokenService.getAccessToken(userId)) != null;

    const r = await this.apiService.send("GET", "/config", null, authed, true);
    return new ServerConfigResponse(r);
    //*/
  }
}
