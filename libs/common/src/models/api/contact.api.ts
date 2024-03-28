// Cozy customization
import { BaseResponse } from "../response/base.response";

export class ContactApi extends BaseResponse {
  displayName: string;
  primaryEmail: string;

  constructor(data: any = null) {
    super(data);
    if (data == null) {
      return;
    }

    this.displayName = this.getResponseProperty("DisplayName");
    this.primaryEmail = this.getResponseProperty("PrimaryEmail");
  }
}
// Cozy customization end
