import CozyClient from 'cozy-client';
import { EnvironmentService } from 'jslib/abstractions/environment.service';
import { TokenService } from 'jslib/abstractions/token.service';

export class CozyClientService {

    constructor(protected environmentService: EnvironmentService,
        private tokenService: TokenService) {
        this.environmentService = environmentService;
        this.tokenService = tokenService;
    }

    async createClient() {
        const vaultUrl = this.environmentService.getWebVaultUrl();
        const uri = new URL(vaultUrl).origin; // Remove the /bitwarden part
        const token = await this.tokenService.getToken();
        return new CozyClient({ uri: uri, token: token });
    }
}
