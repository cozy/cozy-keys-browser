import { Component, Input, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from 'jslib/abstractions/auth.service';
import { EnvironmentService } from 'jslib/abstractions/environment.service';
import { I18nService } from 'jslib/abstractions/i18n.service';
import { PlatformUtilsService } from 'jslib/abstractions/platformUtils.service';
import { StateService } from 'jslib/abstractions/state.service';
import { StorageService } from 'jslib/abstractions/storage.service';
import { SyncService } from 'jslib/abstractions/sync.service';
import { Utils } from 'jslib/misc/utils';
import { AuthResult } from 'jslib/models/domain/authResult';
import { ConstantsService } from 'jslib/services/constants.service';

const Keys = {
    rememberedCozyUrl: 'rememberedCozyUrl',
    rememberCozyUrl: 'rememberCozyUrl',
};

@Component({
    selector: 'app-login',
    templateUrl: 'login.component.html',
})

/**
 *    This class used to extend the LoginComponent from jslib. We copied the
 *    component here to avoid having to modify jslib, as the private storageService
 *    prevented us to just override methods.
 *    See the original component:
 *
 *    https://github.com/bitwarden/browser/blob/
 *    af8274247b2242fe93ad2f7ca4c13f9f7ecf2860/src/popup/accounts/login.component.ts
 */
export class LoginComponent implements OnInit {
    @Input() cozyUrl: string = '';
    @Input() rememberCozyUrl = true;

    email: string = '';
    masterPassword: string = '';
    showPassword: boolean = false;
    formPromise: Promise<AuthResult>;
    onSuccessfulLogin: () => Promise<any>;
    onSuccessfulLoginNavigate: () => Promise<any>;

    protected successRoute = '/tabs/vault';

    constructor(protected authService: AuthService, protected router: Router,
        protected platformUtilsService: PlatformUtilsService, protected i18nService: I18nService,
        protected syncService: SyncService, private storageService: StorageService,
        protected stateService: StorageService, protected environmentService: EnvironmentService) {

            this.authService = authService;
            this.router = router;
            this.platformUtilsService = platformUtilsService;
            this.i18nService = i18nService;
            this.storageService = storageService;
            this.stateService = stateService;
            this.environmentService = environmentService;
            this.onSuccessfulLogin = () => {
                return syncService.fullSync(true);
            };
        }

    async ngOnInit() {
        if (this.cozyUrl == null || this.cozyUrl === '') {
            this.cozyUrl = await this.storageService.get<string>(Keys.rememberedCozyUrl);
            if (this.cozyUrl == null) {
                this.cozyUrl = '';
            }
        }
        this.rememberCozyUrl = await this.storageService.get<boolean>(Keys.rememberCozyUrl);
        if (this.rememberCozyUrl == null) {
            this.rememberCozyUrl = true;
        }
        if (Utils.isBrowser) {
            document.getElementById(this.cozyUrl == null || this.cozyUrl === '' ? 'cozyUrl' : 'masterPassword').focus();
        }
    }

    async submit() {
        if (this.cozyUrl == null || this.cozyUrl === '') {
            this.platformUtilsService.showToast('error', this.i18nService.t('errorOccurred'),
                this.i18nService.t('cozyUrlRequired'));
            return;
        }
        if (this.cozyUrl.indexOf('@') > -1) {
            this.platformUtilsService.showToast('error', this.i18nService.t('errorOccurred'),
                this.i18nService.t('invalidCozyUrl'));
            return;
        }
        if (this.masterPassword == null || this.masterPassword === '') {
            this.platformUtilsService.showToast('error', this.i18nService.t('errorOccurred'),
                this.i18nService.t('masterPassRequired'));
            return;
        }
        if (this.cozyUrl.indexOf('.') === -1) {
            this.cozyUrl += '.mycozy.cloud';
        }

        try {
            // This adds the scheme if missing
            await this.environmentService.setUrls({
                base: this.cozyUrl + '/bitwarden',
            });
            // The email is based on the URL and necessary for login
            const splitScheme = this.cozyUrl.startsWith('http://')
                ? this.cozyUrl.split('http://')
                : this.cozyUrl.split('https://');

            const baseUrl = splitScheme.length < 2 ? splitScheme[0] : splitScheme[1];
            const baseUrlNoPort = baseUrl.split(':')[0]; // The stack does not use the optional port for salt
            this.email = 'me@' + baseUrlNoPort;
            this.formPromise = this.authService.logIn(this.email, this.masterPassword);
            const response = await this.formPromise;
            // Save the URL for next time
            await this.storageService.save(Keys.rememberCozyUrl, this.rememberCozyUrl);
            if (this.rememberCozyUrl) {
                await this.storageService.save(Keys.rememberedCozyUrl, this.cozyUrl);
            } else {
                await this.storageService.remove(Keys.rememberedCozyUrl);
            }
            const disableFavicon = await this.storageService.get<boolean>(ConstantsService.disableFaviconKey);
            await this.stateService.save(ConstantsService.disableFaviconKey, !!disableFavicon);
            if (this.onSuccessfulLogin != null) {
                this.onSuccessfulLogin();
            }
            this.platformUtilsService.eventTrack('Logged In');
            if (this.onSuccessfulLoginNavigate != null) {
                this.onSuccessfulLoginNavigate();
            } else {
                this.router.navigate([this.successRoute]);
            }
        } catch { }
    }

    togglePassword() {
        this.platformUtilsService.eventTrack('Toggled Master Password on Login');
        this.showPassword = !this.showPassword;
        document.getElementById('masterPassword').focus();
    }
}
