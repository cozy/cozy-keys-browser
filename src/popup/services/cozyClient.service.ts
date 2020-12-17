import CozyClient from 'cozy-client';
import { ApiService } from 'jslib/abstractions/api.service';
import { EnvironmentService } from 'jslib/abstractions/environment.service';
import { TokenService } from 'jslib/abstractions/token.service';

interface ICozyStackClient {
    fetchJSON: (method: string, path: string) => Promise<any>;
    fetch: (method: string, path: string, body: any, options: any) => Promise<any>;
}

interface ICozyClient {
    getStackClient: () => ICozyStackClient;
    getAppURL: () => string;
    options: any;
}

/**
 * CozyClient service, used to communicate with a Cozy stack on specific Cozy's routes.
 *
 * The token used to create a cozy-client instance is the bearer token retrieved from jslib.
 */
export class CozyClientService {
    protected instance: ICozyClient;

    constructor(protected environmentService: EnvironmentService,
        protected apiService: ApiService) {
    }

    getCozyURL(): string {
        const vaultUrl = this.environmentService.getWebVaultUrl();
        if (!vaultUrl) {
            return null
        }
        return new URL(vaultUrl).origin // Remove the /bitwarden part
    }

    async getClientInstance () {
        if (this.instance) {
            const token = await this.apiService.getActiveBearerToken();
            // If the instance's token differ from the active bearer, a refresh is needed.
            if (token === this.instance.options.token) {
                return this.instance;
            }
        }
        this.instance = await this.createClient();
        return this.instance;
    }

    async createClient() {
        const uri = this.getCozyURL();
        const token = await this.apiService.getActiveBearerToken();
        this.instance = new CozyClient({ uri: uri, token: token });
        return this.instance;
    }

    async updateSynchronizedAt() {
        try {
            const client = await this.getClientInstance();
            await client.getStackClient().fetchJSON('POST', '/settings/synchronized');
        } catch (err) {
            /* tslint:disable-next-line */
            console.error('Error while updating cozy client\'s synchronized_at');
            /* tslint:disable-next-line */
            console.error(err);
        }
    }

    async deleteOAuthClient(clientId: string, registrationAccessToken: string) {
        if (!clientId || !registrationAccessToken) {
            return
        }

        try {
            const client = await this.getClientInstance();
            await client.getStackClient().fetch(
                'DELETE',
                '/auth/register/' + clientId,
                undefined,
                {
                    headers: {
                        Authorization: 'Bearer ' + registrationAccessToken,
                    },
                },
            );
        } catch (err) {
            /* tslint:disable-next-line */
            console.error('Error while deleting oauth client');
            /* tslint:disable-next-line */
            console.error(err);
        }
    }

    getAppURL(appName: string, hash: string) {
        if (!appName) {
            return (new URL(this.getCozyURL())).toString();
        }
        const url = new URL(this.getCozyURL());
        const hostParts = url.host.split('.');
        url.host = [
            `${hostParts[0]}-${appName}`,
            ...hostParts.slice(1),
        ].join('.');
        if (hash) {
            url.hash = hash;
        }
        return url.toString();
    }
}
