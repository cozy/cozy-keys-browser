import CozyClient from 'cozy-client';
import { ApiService } from 'jslib/abstractions/api.service';
import { EnvironmentService } from 'jslib/abstractions/environment.service';
import { TokenService } from 'jslib/abstractions/token.service';

export class CozyClientService {

    constructor(protected environmentService: EnvironmentService,
        protected apiService: ApiService) {
    }

    async createClient() {
        const vaultUrl = this.environmentService.getWebVaultUrl();
        const uri = new URL(vaultUrl).origin; // Remove the /bitwarden part
        const token = await this.apiService.getActiveBearerToken();
        return new CozyClient({ uri: uri, token: token });
    }
}
