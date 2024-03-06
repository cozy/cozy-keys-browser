// Cozy customization
import { PaperType } from "../../enums/paperType";
import { BaseResponse } from "../response/base.response";

export class PaperApi extends BaseResponse {
  type: PaperType;
  ownerName: string;
  illustrationThumbnailUrl: string;
  noteContent: string;

  constructor(data: any = null) {
    super(data);
    if (data == null) {
      return;
    }
    this.type = this.getResponseProperty("Type");
    this.ownerName = this.getResponseProperty("OwnerName");
    this.illustrationThumbnailUrl = this.getResponseProperty("IllustrationThumbnailUrl");
    this.noteContent = this.getResponseProperty("NoteContent");
  }
}
// Cozy customization end
