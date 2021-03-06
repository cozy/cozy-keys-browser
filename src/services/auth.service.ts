import { KdfType } from 'jslib/enums/kdfType';
import { TwoFactorProviderType } from 'jslib/enums/twoFactorProviderType';

import { AuthResult } from 'jslib/models/domain/authResult';
import { SymmetricCryptoKey } from 'jslib/models/domain/symmetricCryptoKey';
import { DeviceRequest } from 'jslib/models/request/deviceRequest';
import { KeysRequest } from 'jslib/models/request/keysRequest';
import { PreloginRequest } from 'jslib/models/request/preloginRequest';
import { TokenRequest } from 'jslib/models/request/tokenRequest';
import { IdentityTwoFactorResponse } from 'jslib/models/response/identityTwoFactorResponse';

import { ApiService } from 'jslib/abstractions/api.service';
import { AppIdService } from 'jslib/abstractions/appId.service';
import { CryptoService } from 'jslib/abstractions/crypto.service';
import { I18nService } from 'jslib/abstractions/i18n.service';
import { MessagingService } from 'jslib/abstractions/messaging.service';
import { PlatformUtilsService } from 'jslib/abstractions/platformUtils.service';
import { TokenService } from 'jslib/abstractions/token.service';
import { UserService } from 'jslib/abstractions/user.service';
import { VaultTimeoutService } from 'jslib/abstractions/vaultTimeout.service';

import { AuthService as BaseAuthService } from 'jslib/services/auth.service';

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
        private _cryptoService: CryptoService,
        /* tslint:disable-next-line */
        private _apiService: ApiService,
        /* tslint:disable-next-line */
        private _userService: UserService,
        /* tslint:disable-next-line */
        private _tokenService: TokenService,
        /* tslint:disable-next-line */
        private _appIdService: AppIdService,
        /* tslint:disable-next-line */
        private _i18nService: I18nService,
        /* tslint:disable-next-line */
        private _platformUtilsService: PlatformUtilsService,
        /* tslint:disable-next-line */
        private _messagingService: MessagingService,
        /* tslint:disable-next-line */
        private _vaultTimeoutService: VaultTimeoutService,
        /* tslint:disable-next-line */
        private _setCryptoKeys = true,
        /* tslint:disable-next-line */
        private _cozyClientService: CozyClientService,
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
            _setCryptoKeys,
        );
    }

    clear(): Promise<void> {
        return this._cozyClientService.deleteOAuthClient(
            this.clientId,
            this.registrationAccessToken,
        );
    }

    setMessagingService(messagingService: MessagingService) {
        this._messagingService = messagingService;
    }

    async logIn(email: string, masterPassword: string): Promise<AuthResult> {
        this.selectedTwoFactorProviderType = null;
        const key = await this._makePreloginKey(masterPassword, email);
        const hashedPassword = await this._cryptoService.hashPassword(masterPassword, key);
        return await this._logInHelper(email, hashedPassword, key);
    }

    async logInTwoFactor(twoFactorProvider: TwoFactorProviderType, twoFactorToken: string,
        remember?: boolean): Promise<AuthResult> {
        return await this._logInHelper(this.email, this.masterPasswordHash, this._key, twoFactorProvider,
            twoFactorToken, remember);
    }

    async logInComplete(email: string, masterPassword: string, twoFactorProvider: TwoFactorProviderType,
        twoFactorToken: string, remember?: boolean): Promise<AuthResult> {
        this.selectedTwoFactorProviderType = null;
        const key = await this._makePreloginKey(masterPassword, email);
        const hashedPassword = await this._cryptoService.hashPassword(masterPassword, key);
        return await this._logInHelper(email, hashedPassword, key, twoFactorProvider, twoFactorToken, remember);
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

    private async _logInHelper(email1: string, hashedPassword1: string, key: SymmetricCryptoKey,
        twoFactorProvider?: TwoFactorProviderType, twoFactorToken?: string, remember?: boolean): Promise<AuthResult> {
        const storedTwoFactorToken = await this._tokenService.getTwoFactorToken(email1);
        const appId = await this._appIdService.getAppId();
        const deviceRequest = new DeviceRequest(appId, this._platformUtilsService);
        const credentials: string[] = [email1, hashedPassword1];
        const codes: string[] = [hashedPassword1];

        let request: TokenRequest;
        if (twoFactorToken != null && twoFactorProvider != null) {
            request = new TokenRequest(credentials, codes, twoFactorProvider, twoFactorToken, remember,
                deviceRequest);
        } else if (storedTwoFactorToken != null) {
            request = new TokenRequest(credentials, codes, TwoFactorProviderType.Remember,
                storedTwoFactorToken, false, deviceRequest);
        } else {
            request = new TokenRequest(credentials, codes, null, null, false, deviceRequest);
        }

        const response = await this._apiService.postIdentityToken(request);

        this._clearState();
        const result = new AuthResult();
        result.twoFactor = !(response as any).accessToken;

        if (result.twoFactor) {
            // two factor required
            const twoFactorResponse = response as IdentityTwoFactorResponse;
            this.email = email1;
            this.masterPasswordHash = hashedPassword1;
            this._key = this._setCryptoKeys ? key : null;
            this.twoFactorProvidersData = twoFactorResponse.twoFactorProviders2;
            result.twoFactorProviders = twoFactorResponse.twoFactorProviders2;
            return result;
        }

        const tokenResponse = response as IdentityTokenResponse;

        this.clientId = tokenResponse.clientId;
        this.registrationAccessToken = tokenResponse.registrationAccessToken;

        if (tokenResponse.twoFactorToken != null) {
            await this._tokenService.setTwoFactorToken(tokenResponse.twoFactorToken, email1);
        }

        await this._tokenService.setTokens(tokenResponse.accessToken, tokenResponse.refreshToken);
        await this._userService.setInformation(this._tokenService.getUserId(), this._tokenService.getEmail(),
            this._kdf, this._kdfIterations);
        if (this._setCryptoKeys) {
            await this._cryptoService.setKey(key);
            await this._cryptoService.setKeyHash(hashedPassword1);
            await this._cryptoService.setEncKey(tokenResponse.key);

            // User doesn't have a key pair yet (old account), let's generate one for them
            if (tokenResponse.privateKey == null) {
                try {
                    const keyPair = await this._cryptoService.makeKeyPair();
                    await this._apiService.postAccountKeys(new KeysRequest(keyPair[0], keyPair[1].encryptedString));
                    tokenResponse.privateKey = keyPair[1].encryptedString;
                } catch (e) {
                    // tslint:disable-next-line
                    console.error(e);
                }
            }

            await this._cryptoService.setEncPrivateKey(tokenResponse.privateKey);
        }
        if (window.location.pathname !== '/background.html') {
            // when login is processed on background side, then your messages are not received by the background,
            // so you need to triger yourself "logedIn" actions
            this._messagingService.send('loggedIn');
        }
        return result;
    }

    private _clearState(): void {
        this.email = null;
        this.masterPasswordHash = null;
        this.twoFactorProvidersData = null;
        this.selectedTwoFactorProviderType = null;
    }
}
