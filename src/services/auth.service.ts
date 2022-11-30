import { HashPurpose } from 'jslib-common/enums/hashPurpose';
import { KdfType } from 'jslib-common/enums/kdfType';
import { TwoFactorProviderType } from 'jslib-common/enums/twoFactorProviderType';

import { AuthResult } from 'jslib-common/models/domain/authResult';
import { SymmetricCryptoKey } from 'jslib-common/models/domain/symmetricCryptoKey';
import { DeviceRequest } from 'jslib-common/models/request/deviceRequest';
import { KeysRequest } from 'jslib-common/models/request/keysRequest';
import { PreloginRequest } from 'jslib-common/models/request/preloginRequest';
import { TokenRequest } from 'jslib-common/models/request/tokenRequest';
import { IdentityTwoFactorResponse } from 'jslib-common/models/response/identityTwoFactorResponse';

import { ApiService } from 'jslib-common/abstractions/api.service';
import { AppIdService } from 'jslib-common/abstractions/appId.service';
import { CryptoService } from 'jslib-common/abstractions/crypto.service';
import { I18nService } from 'jslib-common/abstractions/i18n.service';
import { LogService } from 'jslib-common/abstractions/log.service';
import { MessagingService } from 'jslib-common/abstractions/messaging.service';
import { PlatformUtilsService } from 'jslib-common/abstractions/platformUtils.service';
import { TokenService } from 'jslib-common/abstractions/token.service';
import { UserService } from 'jslib-common/abstractions/user.service';
import { VaultTimeoutService } from 'jslib-common/abstractions/vaultTimeout.service';

import { AuthService as BaseAuthService } from 'jslib-common/services/auth.service';

import { IdentityTokenResponse } from '../models/response/identityTokenResponse';

import { CozyClientService } from '../popup/services/cozyClient.service';

/**
 * @override by Cozy :
 * We extend the jslib's AuthService and override some methods (particularly
 * the logInHelper) to store the clientId and registrationAccessToken returned
 * by the stack on login. We also add a clear method that pass these infos
 * to delete the created oauth client on logout.
 */
export class AuthService extends BaseAuthService {
    email: string;
    masterPasswordHash: string;
    localMasterPasswordHash: string;
    twoFactorProvidersData: Map<TwoFactorProviderType, { [key: string]: string; }>;
    selectedTwoFactorProviderType: TwoFactorProviderType = null;
    clientId: string;
    registrationAccessToken: string;

    /* tslint:disable-next-line */
    private _key: SymmetricCryptoKey;
    /* tslint:disable-next-line */
    private _kdf: KdfType;
    /* tslint:disable-next-line */
    private _kdfIterations: number;

    constructor(
        /* tslint:disable-next-line */
        private   _cryptoService: CryptoService,
        /* tslint:disable-next-line */
        protected _apiService: ApiService,
        /* tslint:disable-next-line */
        private   _userService: UserService,
        /* tslint:disable-next-line */
        protected _tokenService: TokenService,
        /* tslint:disable-next-line */
        protected _appIdService: AppIdService,
        /* tslint:disable-next-line */
        private   _i18nService: I18nService,
        /* tslint:disable-next-line */
        protected _platformUtilsService: PlatformUtilsService,
        /* tslint:disable-next-line */
        private   _messagingService: MessagingService,
        /* tslint:disable-next-line */
        private   _vaultTimeoutService: VaultTimeoutService,
        /* tslint:disable-next-line */
        private   _logService: LogService,
        /* tslint:disable-next-line */
        private   _setCryptoKeys = true,
        /* tslint:disable-next-line */
        private   _cozyClientService: CozyClientService,
    ) {
        super(
            _cryptoService,
            _apiService,
            _userService,
            _tokenService,
            _appIdService,
            _i18nService,
            _platformUtilsService,
            _messagingService,
            _vaultTimeoutService,
            _logService,
            _setCryptoKeys,
        );
    }

    clear(): Promise<void> {
        return this._cozyClientService.deleteOAuthClient(
            this.clientId,
            this.registrationAccessToken,
        );
    }

    async logIn(email: string, masterPassword: string): Promise<AuthResult> {
        this.selectedTwoFactorProviderType = null;
        const key = await this._makePreloginKey(masterPassword, email);
        const hashedPassword = await this._cryptoService.hashPassword(masterPassword, key);
        const localHashedPassword = await this._cryptoService.hashPassword(masterPassword, key,
            HashPurpose.LocalAuthorization);
        return await this._logInHelper(email, hashedPassword, localHashedPassword, null, null, null, null, null,
            key, null, null, null);
    }

    async logInTwoFactor(twoFactorProvider: TwoFactorProviderType, twoFactorToken: string,
        remember?: boolean): Promise<AuthResult> {
        return await this._logInHelper(this.email, this.masterPasswordHash, this.localMasterPasswordHash, this.code,
            this.codeVerifier, this.ssoRedirectUrl, this.clientId, this.clientSecret, this._key, twoFactorProvider,
            twoFactorToken, remember);
    }

    async _makePreloginKey(masterPassword: string, email: string): Promise<SymmetricCryptoKey> {
        email = email.trim().toLowerCase();
        this._kdf = null;
        this._kdfIterations = null;
        try {
            const preloginResponse = await this._apiService.postPrelogin(new PreloginRequest(email));
            if (preloginResponse != null) {
                this._kdf = preloginResponse.kdf;
                this._kdfIterations = preloginResponse.kdfIterations;
            }
        } catch (e) {
            if (e == null || e.statusCode !== 404) {
                throw e;
            }
        }
        return this._cryptoService.makeKey(masterPassword, email, this._kdf, this._kdfIterations);
    }

    private async _logInHelper(email: string, hashedPassword: string, localHashedPassword: string, code: string,
        codeVerifier: string, redirectUrl: string, clientId: string, clientSecret: string, key: SymmetricCryptoKey,
        twoFactorProvider?: TwoFactorProviderType, twoFactorToken?: string, remember?: boolean, captchaToken?: string): Promise<AuthResult> {
        const storedTwoFactorToken = await this.tokenService.getTwoFactorToken(email);
        const appId = await this.appIdService.getAppId();
        const deviceRequest = new DeviceRequest(appId, this.platformUtilsService);

        let emailPassword: string[] = [];
        let codeCodeVerifier: string[] = [];
        let clientIdClientSecret: [string, string] = [null, null];

        if (email != null && hashedPassword != null) {
            emailPassword = [email, hashedPassword];
        } else {
            emailPassword = null;
        }
        if (code != null && codeVerifier != null && redirectUrl != null) {
            codeCodeVerifier = [code, codeVerifier, redirectUrl];
        } else {
            codeCodeVerifier = null;
        }
        if (clientId != null && clientSecret != null) {
            clientIdClientSecret = [clientId, clientSecret];
        } else {
            clientIdClientSecret = null;
        }

        let request: TokenRequest;
        if (twoFactorToken != null && twoFactorProvider != null) {
            request = new TokenRequest(emailPassword, codeCodeVerifier, clientIdClientSecret, twoFactorProvider,
                twoFactorToken, remember, captchaToken, deviceRequest);
        } else if (storedTwoFactorToken != null) {
            request = new TokenRequest(emailPassword, codeCodeVerifier, clientIdClientSecret, TwoFactorProviderType.Remember,
                storedTwoFactorToken, false, captchaToken, deviceRequest);
        } else {
            request = new TokenRequest(emailPassword, codeCodeVerifier, clientIdClientSecret, null,
                null, false, captchaToken, deviceRequest);
        }

        const response = await this.apiService.postIdentityToken(request);

        this._clearState();
        const result = new AuthResult();
        result.twoFactor = !(response as any).accessToken;

        if (result.twoFactor) {
            // two factor required
            const twoFactorResponse = response as IdentityTwoFactorResponse;
            this.email = email;
            this.masterPasswordHash = hashedPassword;
            this.localMasterPasswordHash = localHashedPassword;
            this.code = code;
            this.codeVerifier = codeVerifier;
            this.ssoRedirectUrl = redirectUrl;
            this.clientId = clientId;
            this.clientSecret = clientSecret;
            this._key = this._setCryptoKeys ? key : null;
            this.twoFactorProvidersData = twoFactorResponse.twoFactorProviders2;
            result.twoFactorProviders = twoFactorResponse.twoFactorProviders2;
            return result;
        }

        const tokenResponse = response as IdentityTokenResponse;
        result.resetMasterPassword = tokenResponse.resetMasterPassword;
        if (tokenResponse.twoFactorToken != null) {
            await this.tokenService.setTwoFactorToken(tokenResponse.twoFactorToken, email);
        }

        await this.tokenService.setTokens(tokenResponse.accessToken, tokenResponse.refreshToken, clientIdClientSecret);
        await this._userService.setInformation(this.tokenService.getUserId(), this.tokenService.getEmail(),
            tokenResponse.kdf, tokenResponse.kdfIterations);
        if (this._setCryptoKeys) {
            if (key != null) {
                await this._cryptoService.setKey(key);
            }
            if (hashedPassword != null) {
                await this._cryptoService.setKeyHash(hashedPassword);
            }

            // Skip this step during SSO new user flow. No key is returned from server.
            if (code == null || tokenResponse.key != null) {
                await this._cryptoService.setEncKey(tokenResponse.key);

                // User doesn't have a key pair yet (old account), let's generate one for them
                if (tokenResponse.privateKey == null) {
                    try {
                        const keyPair = await this._cryptoService.makeKeyPair();
                        await this.apiService.postAccountKeys(new KeysRequest(keyPair[0], keyPair[1].encryptedString));
                        tokenResponse.privateKey = keyPair[1].encryptedString;
                    } catch (e) {
                        // tslint:disable-next-line
                        this._logService.error(e);
                    }
                }

                await this._cryptoService.setEncPrivateKey(tokenResponse.privateKey);
            }
        }

        if (this._vaultTimeoutService != null) {
            this._vaultTimeoutService.biometricLocked = false;
        }
        this._messagingService.send('loggedIn');
        return result;
    }

    private _clearState(): void {
        this._key = null;
        this.email = null;
        this.masterPasswordHash = null;
        this.code = null;
        this.codeVerifier = null;
        this.ssoRedirectUrl = null;
        this.clientId = null;
        this.clientSecret = null;
        this.twoFactorProvidersData = null;
        this.selectedTwoFactorProviderType = null;
        this.clear();
    }
}
