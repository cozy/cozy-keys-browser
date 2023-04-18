import { AuthService as BaseAuthService } from "jslib-common/services/auth.service";

/**
 * TODO REFACTO : re implement with the new auth.service when jslib will no longer be a gitmodule.
 * This file will then be no longer useful
 *
 * @override by Cozy :
 * We extend the jslib's AuthService and override some methods (particularly
 * the logInHelper) to store the clientId and registrationAccessToken returned
 * by the stack on login. We also add a clear method that pass these infos
 * to delete the created oauth client on logout.
 */
export class AuthService extends BaseAuthService {}
