// Cozy customization
import { PaperType } from "@bitwarden/common/enums/paperType";
import { BaseResponse } from "@bitwarden/common/models/response/base.response";

export class PaperApi extends BaseResponse {
  type: PaperType;
  ownerName: string;
  illustrationThumbnailUrl: string;
  illustrationUrl: string;
  qualificationLabel: string;
  noteContent: string;

  constructor(data: any = null) {
    super(data);
    if (data == null) {
      return;
    }
    this.type = this.getResponseProperty("Type");
    this.ownerName = this.getResponseProperty("OwnerName");
    this.illustrationThumbnailUrl = this.getResponseProperty("IllustrationThumbnailUrl");
    this.illustrationUrl = this.getResponseProperty("IllustrationUrl");
    this.qualificationLabel = this.getResponseProperty("QualificationLabel");
    this.noteContent = this.getResponseProperty("NoteContent");
  }
}
// Cozy customization end
