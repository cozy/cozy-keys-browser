import { BaseResponse } from "@bitwarden/common/models/response/base.response";

export class ProjectResponse extends BaseResponse {
  id: string;
  organizationId: string;
  name: string;
  creationDate: string;
  revisionDate: string;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.organizationId = this.getResponseProperty("OrganizationId");
    this.name = this.getResponseProperty("Name");
    this.creationDate = this.getResponseProperty("CreationDate");
    this.revisionDate = this.getResponseProperty("RevisionDate");
  }
}

export class ProjectPermissionDetailsResponse extends ProjectResponse {
  read: boolean;
  write: boolean;

  constructor(response: any) {
    super(response);
    this.read = this.getResponseProperty("Read");
    this.write = this.getResponseProperty("Write");
  }
}
