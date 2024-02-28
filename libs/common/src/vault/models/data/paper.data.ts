// Cozy customization
import { PaperApi } from "../../../models/api/paper.api";

export class PaperData {
  ownerName: string;
  illustrationThumbnailUrl: string;

  constructor(data?: PaperApi) {
    if (data == null) {
      return;
    }

    this.ownerName = data.ownerName;
    this.illustrationThumbnailUrl = data.illustrationThumbnailUrl;
  }
}
// Cozy customization end
