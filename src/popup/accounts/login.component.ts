import { Component, Input, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { EnvironmentService as EnvironmentServiceAbstraction } from 'jslib-common/abstractions';
import { ApiService } from 'jslib-common/abstractions/api.service';
import { AuthService } from 'jslib-common/abstractions/auth.service';
import { CryptoFunctionService } from 'jslib-common/abstractions/cryptoFunction.service';
import { EnvironmentService } from 'jslib-common/abstractions/environment.service';
import { I18nService } from 'jslib-common/abstractions/i18n.service';
import { PasswordGenerationService } from 'jslib-common/abstractions/passwordGeneration.service';
import { PlatformUtilsService } from 'jslib-common/abstractions/platformUtils.service';
import { StateService } from 'jslib-common/abstractions/state.service';
import { StorageService } from 'jslib-common/abstractions/storage.service';
import { SyncService } from 'jslib-common/abstractions/sync.service';
// import { UserService } from 'jslib-common/abstractions/user.service'; TODO BJA : DELETE
import { Utils } from 'jslib-common/misc/utils';
import { AuthResult } from 'jslib-common/models/domain/authResult';
import { PreloginRequest } from 'jslib-common/models/request/preloginRequest';
import { PreloginResponse } from 'jslib-common/models/response/preloginResponse';
import { ConstantsService } from 'jslib-common/services/constants.service';

import BrowserMessagingService from '../../services/browserMessaging.service';

/* start Cozy imports */
import { generateWebLink, Q } from 'cozy-client';

import { CozyClientService } from '../services/cozyClient.service';
import { CozySanitizeUrlService } from "../services/cozySanitizeUrl.service";
/* end Cozy imports */

type CozyConfiguration = {
    HasCiphers?: boolean
    OIDC?: boolean
    FlatSubdomains?: boolean
}

const messagingService = new BrowserMessagingService();

const Keys = {
    rememberedCozyUrl: 'rememberedCozyUrl',
    rememberCozyUrl: 'rememberCozyUrl',
};

const getCozyPassWebURL = (cozyUrl: string, cozyConfiguration: CozyConfiguration) => {
    const link = generateWebLink({
        cozyUrl: cozyUrl,
        searchParams: [],
        pathname: '',
        hash: '',
        slug: 'passwords',
        subDomainType: cozyConfiguration.FlatSubdomains ? 'flat' : 'nested'
    });

    return link;
};


const shouldRedirectToOIDCPasswordPage = (cozyConfiguration: CozyConfiguration) => {
    const shouldRedirect = cozyConfiguration.OIDC && !cozyConfiguration.HasCiphers;

    return shouldRedirect
};

@Component({
    selector: 'app-login',
    templateUrl: 'login.component.html',
})
/**
 *    This class is a mix of the LoginComponent from jslib and the one from the repo.
 *      jslib/src/angular/components/login.component.ts
 *
 *    We extended the component to avoid to have to modify jslib, as the private storageService
 *    prevented us to just override methods.
 *    See the original component:
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
    onSuccessfulLoginTwoFactorNavigate: () => Promise<any>;

    protected twoFactorRoute = '2fa';
    protected successRoute = '/tabs/vault';

    constructor(protected authService: AuthService, protected router: Router,
        protected platformUtilsService: PlatformUtilsService, protected i18nService: I18nService,
        protected syncService: SyncService, private storageService: StorageService,
        protected stateService: StorageService, protected environmentService: EnvironmentService,
        protected cozySanitizeUrlService: CozySanitizeUrlService, private apiService: ApiService) {

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

    sanitizeUrlInput(inputUrl: string): string {
        // Prevent empty url
        if (!inputUrl) {
            throw new Error('cozyUrlRequired');
        }
        // Prevent email input
        if (inputUrl.includes('@')) {
            throw new Error('noEmailAsCozyUrl');
        }
        
        if (this.cozySanitizeUrlService.hasMispelledCozy(inputUrl)){
            throw new Error('hasMispelledCozy');
        }
        
        return this.cozySanitizeUrlService.normalizeURL(inputUrl, this.cozySanitizeUrlService.cozyDomain);
    }

    async submit() {
        try {
            const loginUrl = this.sanitizeUrlInput(this.cozyUrl);

            if (this.masterPassword == null || this.masterPassword === '') {
                this.platformUtilsService.showToast('error', this.i18nService.t('errorOccurred'),
                    this.i18nService.t('masterPassRequired'));
                return;
            }

            // This adds the scheme if missing
            await this.environmentService.setUrls({
                base: loginUrl + '/bitwarden',
            });
            // The email is based on the URL and necessary for login
            const hostname = Utils.getHostname(loginUrl);
            this.email = 'me@' + hostname;

            this.formPromise = this.authService.logIn(this.email, this.masterPassword).catch( e => {
                if (e.response && e.response.error && e.response.error === 'invalid password') {
                    this.platformUtilsService.showToast('error',  this.i18nService.t('errorOccurred'),
                        this.i18nService.t('invalidMasterPassword'));
                    // Returning null here so that the validation service in jslib
                    // does not consider the result of the call as an error, otherwise
                    // we would have a double toast
                    return null;
        super.onSuccessfulLogin = async () => {
            await syncService.fullSync(true).then(async () => {
                if (await this.userService.getForcePasswordReset()) {
                    this.router.navigate(['update-temp-password']);
                }
                throw e;
            });
            const response = await this.formPromise;
            if (!response) {
                return;
            }

            // Save the URL for next time
            await this.storageService.save(Keys.rememberCozyUrl, this.rememberCozyUrl);
            if (this.rememberCozyUrl) {
                await this.storageService.save(Keys.rememberedCozyUrl, loginUrl);
            } else {
                await this.storageService.remove(Keys.rememberedCozyUrl);
            }
            if (response.twoFactor) {
                if (this.onSuccessfulLoginTwoFactorNavigate != null) {
                    this.onSuccessfulLoginTwoFactorNavigate();
                } else {
                    this.router.navigate([this.twoFactorRoute]);
                }
            } else {
                messagingService.send('loggedIn');
                const disableFavicon = await this.storageService.get<boolean>(ConstantsService.disableFaviconKey);
                await this.stateService.save(ConstantsService.disableFaviconKey, !!disableFavicon);
                if (this.onSuccessfulLogin != null) {
                    this.onSuccessfulLogin();
                }
                if (this.onSuccessfulLoginNavigate != null) {
                    this.onSuccessfulLoginNavigate();
                } else {
                    this.router.navigate([this.successRoute], { queryParams: {activatedPanel : 'currentPageCiphers'},
                    });
                }
            }
        } catch (e) {
            const translatableMessages = [
                'cozyUrlRequired',
                'noEmailAsCozyUrl',
                'hasMispelledCozy'
            ]
            
            if (translatableMessages.includes(e.message)) {
                this.platformUtilsService.showToast('error', this.i18nService.t('errorOccurred'),
                    this.i18nService.t(e.message));
            } else {
                this.platformUtilsService.showToast('error', this.i18nService.t('errorOccurred'), '');
            }
        }
    }

    togglePassword() {
        this.showPassword = !this.showPassword;
        document.getElementById('masterPassword').focus();
    }

    async forgotPassword() {
        if (!this.cozyUrl) {
            this.platformUtilsService.showToast('error', this.i18nService.t('errorOccurred'),
                this.i18nService.t('cozyUrlRequired'));
            return;
        }

        const loginUrl = this.sanitizeUrlInput(this.cozyUrl);

        await this.initializeEnvForCozy(loginUrl);

        let cozyConfiguration: CozyConfiguration = {};
        try {
            cozyConfiguration = await this.getCozyConfiguration();
        } catch (e) {
            this.platformUtilsService.showToast('error', this.i18nService.t('errorOccurred'),
                this.i18nService.t('invalidCozyUrl'));
            return;
        }
        
        const shouldRedirectToOidc = shouldRedirectToOIDCPasswordPage(cozyConfiguration);

        const url = shouldRedirectToOidc
            ? getCozyPassWebURL(loginUrl, cozyConfiguration)
            : getPassphraseResetURL(loginUrl);

        const browser = window.browser || window.chrome;
        await browser.tabs.create({
            active: true,
            url: url,
        });

        // Close popup
        const popupWindows = browser.extension.getViews({ type: 'popup' });
        if (popupWindows.find((w: Window) => w === window)) {
          window.close();
        }
    }

    private getCozyConfiguration = async (): Promise<CozyConfiguration> => {
        const preloginResponse = await this.apiService.postPrelogin(new PreloginRequest(this.cozyUrl));

        const { HasCiphers, OIDC, FlatSubdomains } = (preloginResponse as any).response;

        return { HasCiphers, OIDC, FlatSubdomains }
    }

    /**
     * Initialize EnvironmentService with cozyUrl input so it can be used by ApiService
     * Also save cozyUrl input in storageService so it will be pre-filled on next popup opening
     * @param cozyUrl - The Cozy address
     */
    private initializeEnvForCozy = async (cozyUrl: string) => {
        await this.environmentService.setUrls({
            base: cozyUrl + '/bitwarden',
        });
        this.storageService.save(Keys.rememberedCozyUrl, cozyUrl);
    }
}
