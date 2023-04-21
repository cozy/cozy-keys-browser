import { StateService } from "jslib-common/abstractions/state.service";
import { OrganizationData } from "jslib-common/models/data/organizationData";
import { Organization } from "jslib-common/models/domain/organization";
import { ProfileOrganizationResponse } from "jslib-common/models/response/profileOrganizationResponse";
import { OrganizationService as OrganizationServiceBase } from "jslib-common/services/organization.service";

const Keys = {
  organizationsPrefix: "organizations_",
};

export class OrganizationService extends OrganizationServiceBase {
  constructor(stateService: StateService) {
    super(stateService);
  }

  async upsertOrganization(organization: ProfileOrganizationResponse) {
    const organizations = await this.getAll();
    organizations.push(new Organization(new OrganizationData(organization)));
    const organizationsData: { [id: string]: OrganizationData } = {};
    organizations.forEach((o) => {
      organizationsData[o.id] = o as OrganizationData;
    });
    await this.save(organizationsData);
  }
}
