import { Injectable } from "@angular/core";
import { CanActivate, Router } from "@angular/router";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";

@Injectable()
export class UnauthGuard implements CanActivate {
  protected homepage = "vault";
  /* Cozy custo : move properties to protected
  constructor(private authService: AuthService, private router: Router) {}
  */
  constructor(protected authService: AuthService, protected router: Router) {}
  /* end custo */

  async canActivate() {
    const authStatus = await this.authService.getAuthStatus();

    if (authStatus === AuthenticationStatus.LoggedOut) {
      return true;
    }

    if (authStatus === AuthenticationStatus.Locked) {
      return this.router.createUrlTree(["lock"]);
    }

    return this.router.createUrlTree([this.homepage]);
  }
}
