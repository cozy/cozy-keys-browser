import { Injectable } from '@angular/core';
import {
    ActivatedRouteSnapshot,
    CanActivate,
    Router,
} from '@angular/router';

import { UserService } from 'jslib-common/abstractions/user.service';
import { VaultTimeoutService } from 'jslib-common/abstractions/vaultTimeout.service';

/*
@override by Cozy
We had to duplicate src\popup\services\unauth-guard.service.ts
since we could not override `canActivate()` where we needed to modify the default route with a queryParam.
*/

@Injectable()
export class UnauthGuardService implements CanActivate {

    protected homepage = 'tabs/vault';
    constructor(private vaultTimeoutService: VaultTimeoutService, private userService: UserService,
        private router: Router) { }

    async canActivate() {
        const isAuthed = await this.userService.isAuthenticated();
        if (isAuthed) {
            const locked = await this.vaultTimeoutService.isLocked();
            if (locked) {
                this.router.navigate(['lock']);
            } else {
                this.router.navigate([this.homepage], { queryParams: { activatedPanel: 'currentPageCiphers' } });
            }
            return false;
        }

        return true;
    }
}
