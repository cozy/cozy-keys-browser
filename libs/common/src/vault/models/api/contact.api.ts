// Cozy customization
import { BaseResponse } from "../../../models/response/base.response";

export class ContactApi extends BaseResponse {
  displayName: string;
  initials: string;
  primaryEmail: string;
  primaryPhone: string;
  me: boolean;

  constructor(data: any = null) {
    super(data);
    if (data == null) {
      return;
    }

    this.displayName = this.getResponseProperty("DisplayName");
    this.initials = this.getResponseProperty("Initials");
    this.primaryEmail = this.getResponseProperty("PrimaryEmail");
    this.primaryPhone = this.getResponseProperty("PrimaryPhone");
    this.me = this.getResponseProperty("Me");
  }
}
// Cozy customization end
