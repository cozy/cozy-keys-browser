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
    // These route is used mainly to get server configuration and feature flags
    //*
    return new ServerConfigResponse(null);
    /*/
    const authed: boolean =
      userId == null ? false : (await this.tokenService.getAccessToken(userId)) != null;

    const r = await this.apiService.send("GET", "/config", null, authed, true);
    return new ServerConfigResponse(r);
    //*/
  }
}
