import {
    IdentityTokenResponse as BaseIdentityTokenResponse,
} from 'jslib/models/response/identityTokenResponse';

/**
 * We need to extend the jslib's IdentityTokenResponse to add the clientId and
 * the registrationAccessToken properties returned by the stack. These
 * properties are used to delete oauth client created by the stack on logout
 */
export class IdentityTokenResponse extends BaseIdentityTokenResponse {
    clientId: string;
    registrationAccessToken: string;

    constructor(response: any) {
        super(response);
        this.clientId = response.client_id;
        this.registrationAccessToken = response.registration_access_token;
    }
}
