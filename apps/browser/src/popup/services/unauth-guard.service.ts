import { Injectable } from "@angular/core";

import { UnauthGuard as BaseUnauthGuardService } from "jslib-angular/guards/unauth.guard";

/* COZY IMPORTS */
/* eslint-disable */
import { CanActivate, Router } from "@angular/router";
import { AuthenticationStatus } from "jslib-common/enums/authenticationStatus";
import { AuthService } from "jslib-common/abstractions/auth.service";
import { HistoryService } from "./history.service";
/* eslint-enable */
/* END COZY IMPORTS */

@Injectable()
export class UnauthGuardService extends BaseUnauthGuardService implements CanActivate {
  protected homepage = "tabs/current";
  constructor(
    authService: AuthService,
    router: Router,
    private historyService: HistoryService
  ) {
    super(authService, router);
  }

  async canActivate() {
    const authStatus = await this.authService.getAuthStatus();

    if (authStatus === AuthenticationStatus.LoggedOut) {
      return true;
    }

    if (authStatus === AuthenticationStatus.Locked) {
      return this.router.createUrlTree(["lock"]);
    }

    // return this.router.createUrlTree([this.homepage]);
    this.historyService.gotoCurrentUrl();
  }
}
