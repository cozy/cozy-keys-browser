import {
    ChangeDetectorRef,
    Component,
    NgZone,
} from '@angular/core';

import {
    ActivatedRoute,
    Router,
} from '@angular/router';

import { TwoFactorProviderType } from 'jslib/enums/twoFactorProviderType';

import { ApiService } from 'jslib/abstractions/api.service';
import { AuthService } from 'jslib/abstractions/auth.service';
import { EnvironmentService } from 'jslib/abstractions/environment.service';
import { I18nService } from 'jslib/abstractions/i18n.service';
import { MessagingService } from 'jslib/abstractions/messaging.service';
import { PlatformUtilsService } from 'jslib/abstractions/platformUtils.service';
import { StateService } from 'jslib/abstractions/state.service';
import { StorageService } from 'jslib/abstractions/storage.service';
import { SyncService } from 'jslib/abstractions/sync.service';

import { BroadcasterService } from 'jslib/angular/services/broadcaster.service';

import { TwoFactorComponent as BaseTwoFactorComponent } from 'jslib/angular/components/two-factor.component';

import { PopupUtilsService } from '../services/popup-utils.service';

import { UserService } from 'jslib/abstractions/user.service';

const BroadcasterSubscriptionId = 'TwoFactorComponent';

@Component({
    selector: 'app-two-factor',
    templateUrl: 'two-factor.component.html',
})
export class TwoFactorComponent extends BaseTwoFactorComponent {
    showNewWindowMessage = false;

    constructor(authService: AuthService, router: Router,
        i18nService: I18nService, apiService: ApiService,
        platformUtilsService: PlatformUtilsService, syncService: SyncService,
        environmentService: EnvironmentService, private ngZone: NgZone,
        private broadcasterService: BroadcasterService, private changeDetectorRef: ChangeDetectorRef,
        private popupUtilsService: PopupUtilsService, stateService: StateService,
        storageService: StorageService, route: ActivatedRoute,
        private userService: UserService, protected messagingService: MessagingService) {
        super(authService, router, i18nService, apiService, platformUtilsService, window, environmentService,
            stateService, storageService, route);
        super.onSuccessfulLogin = () => {
            return syncService.fullSync(true);
        };
        super.successRoute = '/tabs/vault';
    }

    async ngOnInit() {
        const isFirefox = this.platformUtilsService.isFirefox();
        if (this.popupUtilsService.inPopup(window) && isFirefox &&
            this.win.navigator.userAgent.indexOf('Windows NT 10.0;') > -1) {
            // ref: https://bugzilla.mozilla.org/show_bug.cgi?id=1562620
            this.initU2f = false;
        }
        const isSafari = this.platformUtilsService.isSafari();
        await super.ngOnInit();
        if (this.selectedProviderType == null) {
            return;
        }

        if (!isSafari && this.selectedProviderType === TwoFactorProviderType.Email &&
            this.popupUtilsService.inPopup(window)) {
            // in case of 2FA and not in Safari, open popout where the user will type its 2FA Code.
            this.popupUtilsService.popOut(window);
        }

        if (!this.initU2f && this.selectedProviderType === TwoFactorProviderType.U2f &&
            this.popupUtilsService.inPopup(window)) {
            const confirmed = await this.platformUtilsService.showDialog(this.i18nService.t('popupU2fCloseMessage'),
                null, this.i18nService.t('yes'), this.i18nService.t('no'));
            if (confirmed) {
                this.popupUtilsService.popOut(window);
            }
        }
    }

    ngOnDestroy() {
        this.broadcasterService.unsubscribe(BroadcasterSubscriptionId);
        super.ngOnDestroy();
    }

    anotherMethod() {
        this.router.navigate(['2fa-options']);
    }

    async submit() {
        await super.submit();
        const isAuthed = await this.userService.isAuthenticated();
        if (!isAuthed) {
            // TODO BJA : prompt a message in case 2FA failed, explaining a new code is sent.
        } else {
            this.messagingService.send('loggedIn');
        }
    }
}
