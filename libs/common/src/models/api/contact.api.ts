// Cozy customization
import { BaseResponse } from "../response/base.response";

export class ContactApi extends BaseResponse {
  constructor(data: any = null) {
    super(data);
    if (data == null) {
      return;
    }
  }
}
// Cozy customization end
