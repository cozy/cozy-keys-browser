// Cozy customization
import { PaperType } from "../../../enums/paperType";
import { PaperApi } from "../../../models/api/paper.api";

export class PaperData {
  type: PaperType;
  ownerName: string;
  illustrationThumbnailUrl: string;
  illustrationUrl: string;
  noteContent: string;

  constructor(data?: PaperApi) {
    if (data == null) {
      return;
    }

    this.type = data.type;
    this.ownerName = data.ownerName;
    this.illustrationThumbnailUrl = data.illustrationThumbnailUrl;
    this.illustrationUrl = data.illustrationUrl;
    this.noteContent = data.noteContent;
  }
}
// Cozy customization end
