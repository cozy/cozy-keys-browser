// Cozy customization
import { BaseResponse } from "../response/base.response";

export class PaperApi extends BaseResponse {
  ownerName: string;
  illustrationThumbnailUrl: string;

  constructor(data: any = null) {
    super(data);
    if (data == null) {
      return;
    }
    this.ownerName = this.getResponseProperty("OwnerName");
    this.illustrationThumbnailUrl = this.getResponseProperty("IllustrationThumbnailUrl");
  }
}
// Cozy customization end
