import { UnauthGuard as BaseUnauthGuardService } from "@bitwarden/angular/auth/guards";

/* COZY IMPORTS */
/* eslint-disable */
import { Router } from "@angular/router";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { HistoryService } from "../../../popup/services/history.service";
/* eslint-enable */
/* END COZY IMPORTS */

export class UnauthGuardService extends BaseUnauthGuardService {
  protected homepage = "tabs/current";

  // Cozy custo
  constructor(
    authService: AuthService,
    router: Router,
    private historyService: HistoryService,
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

    // only Cozy specific line
    this.historyService.gotoCurrentUrl();
  }
  // end custo
}
