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
}

export class CozyClientService {
    protected instance: ICozyClient;

    constructor(protected environmentService: EnvironmentService,
        protected apiService: ApiService) {
    }

    async createClient() {
        if (this.instance) {
            return this.instance;
        }

        const vaultUrl = this.environmentService.getWebVaultUrl();
        const uri = new URL(vaultUrl).origin; // Remove the /bitwarden part
        const token = await this.apiService.getActiveBearerToken();
        this.instance = new CozyClient({ uri: uri, token: token });
        return this.instance;
    }

    async updateSynchronizedAt() {
        const client = await this.createClient();

        try {
            await client.getStackClient().fetchJSON('POST', '/settings/synchronized');
        } catch (err) {
            /* tslint:disable-next-line */
            console.error('Error while updating cozy client\'s synchronized_at');
            /* tslint:disable-next-line */
            console.error(err);
        }
    }

    async deleteOAuthClient(clientId: string, registrationAccessToken: string) {
        const client = await this.createClient();

        try {
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
}
