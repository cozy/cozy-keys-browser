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
    private _authService: AuthService,
    private _router: Router,
    private historyService: HistoryService
  ) {
    super(_authService, _router);
  }

  // async canActivate() {
  //   const isAuthed = await this._stateService.getIsAuthenticated();
  //   if (isAuthed) {
  //     const locked = await this._vaultTimeoutService.isLocked();
  //     if (locked) {
  //       this._router.navigate(["lock"]);
  //     } else {
  //       // this.router.navigate([this.homepage]);
  //       this.historyService.gotoCurrentUrl();
  //     }
  //     return false;
  //   }
  //   return true;
  // }
  async canActivate() {
    const authStatus = await this._authService.getAuthStatus();

    if (authStatus === AuthenticationStatus.LoggedOut) {
      return true;
    }

    if (authStatus === AuthenticationStatus.Locked) {
      return this._router.createUrlTree(["lock"]);
    }

    // return this.router.createUrlTree([this.homepage]);
    this.historyService.gotoCurrentUrl();
  }
}
