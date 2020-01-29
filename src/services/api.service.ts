import { PlatformUtilsService } from 'jslib/abstractions/platformUtils.service';
import { TokenService } from 'jslib/abstractions/token.service';
import { DeviceType } from 'jslib/enums/deviceType';
import { TokenRequest } from 'jslib/models/request/tokenRequest';
import { ErrorResponse } from 'jslib/models/response/errorResponse';
import { IdentityTwoFactorResponse } from 'jslib/models/response/identityTwoFactorResponse';
import { ApiService as BaseApiService } from 'jslib/services/api.service';

import { IdentityTokenResponse } from '../models/response/identityTokenResponse';

function getDeviceName(deviceType: DeviceType): string {
    switch (deviceType) {
        case DeviceType.ChromeExtension:
            return 'Chrome';

        case DeviceType.FirefoxExtension:
            return 'Firefox';

        default:
            return '';
    }
}

/**
 * We extend the jslib's ApiService and override the `postIdentityToken` method
 * to pass the client name to the stack, so in cozy-settings we can show
 * "Cozy Password (browser name)" in the connected devices list.
 * We also had to copy/paste some private methods because we can't access it
 * from child class.
 */
export class ApiService extends BaseApiService {
    /* tslint:disable-next-line */
    private _device: DeviceType;
    /* tslint:disable-next-line */
    private _deviceType: string;
    /* tslint:disable-next-line */
    private _isWebClient = false;
    /* tslint:disable-next-line */
    private _isDesktopClient = false;
    /* tslint:disable-next-line */
    private _usingBaseUrl = false;

    constructor(
        /* tslint:disable-next-line */
        private _tokenService: TokenService,
        /* tslint:disable-next-line */
        private _platformUtilsService: PlatformUtilsService,
        /* tslint:disable-next-line */
        private _logoutCallback: (expired: boolean) => Promise<void>,
        /* tslint:disable-next-line */
        private _customUserAgent: string = null
    ) {
        super(
            _tokenService,
            _platformUtilsService,
            _logoutCallback,
            _customUserAgent,
        );

        this._device = _platformUtilsService.getDevice();
        this._deviceType = this._device.toString();
        this._isWebClient = this._device === DeviceType.IEBrowser || this._device === DeviceType.ChromeBrowser ||
            this._device === DeviceType.EdgeBrowser || this._device === DeviceType.FirefoxBrowser ||
            this._device === DeviceType.OperaBrowser || this._device === DeviceType.SafariBrowser ||
            this._device === DeviceType.UnknownBrowser || this._device === DeviceType.VivaldiBrowser;
    }

    async postIdentityToken(request: TokenRequest): Promise<IdentityTokenResponse | IdentityTwoFactorResponse> {
        const headers = new Headers({
            'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
            'Accept': 'application/json',
            'Device-Type': this._deviceType,
        });
        if (this._customUserAgent != null) {
            headers.set('User-Agent', this._customUserAgent);
        }

        const bodyData = {
            ...request.toIdentityToken(this._platformUtilsService.identityClientId),
            clientName: `Cozy Passwords (${getDeviceName(this._device)})`,
        };
        const body = this._qsStringify(bodyData);
        const response = await this.fetch(new Request(this.identityBaseUrl + '/connect/token', {
            body: body,
            credentials: this._getCredentials(),
            cache: 'no-cache',
            headers: headers,
            method: 'POST',
        }));

        let responseJson: any = null;
        if (this._isJsonResponse(response)) {
            responseJson = await response.json();
        }

        if (responseJson != null) {
            if (response.status === 200) {
                return new IdentityTokenResponse(responseJson);
            } else if (response.status === 400 && responseJson.TwoFactorProviders2 &&
                Object.keys(responseJson.TwoFactorProviders2).length) {
                await this._tokenService.clearTwoFactorToken(request.email);
                return new IdentityTwoFactorResponse(responseJson);
            }
        }

        return Promise.reject(new ErrorResponse(responseJson, response.status, true));
    }

    private _isJsonResponse(response: Response): boolean {
        const typeHeader = response.headers.get('content-type');
        return typeHeader != null && typeHeader.indexOf('application/json') > -1;
    }

    private _getCredentials(): RequestCredentials {
        if (this._device !== DeviceType.SafariExtension && (!this._isWebClient || this._usingBaseUrl)) {
            return 'include';
        }
        return undefined;
    }

    private _qsStringify(params: any): string {
        return Object.keys(params).map((key) => {
            return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
        }).join('&');
    }
}
