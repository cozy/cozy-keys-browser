import { CryptoService } from 'jslib-common/abstractions/crypto.service';
import { StorageService } from 'jslib-common/abstractions/storage.service';
import { TokenService } from 'jslib-common/abstractions/token.service';
import { OrganizationData } from 'jslib-common/models/data/organizationData';
import { Organization } from 'jslib-common/models/domain/organization';
import { ProfileOrganizationResponse } from 'jslib-common/models/response/profileOrganizationResponse';

import { UserService as UserServiceBase } from 'jslib-common/services/user.service';

const Keys = {
    organizationsPrefix: 'organizations_',
};

export class UserService extends UserServiceBase {
    constructor(
        tokenService: TokenService,
        private localStorageService: StorageService) {
        super(tokenService, localStorageService);
    }

    async upsertOrganization(organization: ProfileOrganizationResponse) {
        const userId = await this.getUserId();
        const organizations = await this.getAllOrganizations();
        organizations.push(
            new Organization(
                new OrganizationData(organization)
            )
        );
        const organizationsData: { [id: string]: OrganizationData; } = {};
        organizations.forEach(o => {
            organizationsData[o.id] = o as OrganizationData;
        });
        await this.localStorageService.save(Keys.organizationsPrefix + userId, organizationsData);
    }
}
