// Cozy customization
import { PaperType } from "../../../enums/paperType";
import Domain from "../../../models/domain/domain-base";
import { SymmetricCryptoKey } from "../../../models/domain/symmetric-crypto-key";
import { PaperData } from "../data/paper.data";
import { PaperView } from "../view/paper.view";

export class Paper extends Domain {
  type: PaperType = null;
  ownerName: string;
  illustrationThumbnailUrl: string;
  illustrationUrl: string;
  noteContent: string;

  constructor(obj?: PaperData) {
    super();
    if (obj == null) {
      return;
    }

    this.type = obj.type;
    this.ownerName = obj.ownerName;
    this.illustrationThumbnailUrl = obj.illustrationThumbnailUrl;
    this.illustrationUrl = obj.illustrationUrl;
    this.noteContent = obj.noteContent;
  }

  decrypt(orgId: string, encKey?: SymmetricCryptoKey): Promise<PaperView> {
    return Promise.resolve(new PaperView(this));
  }
}
// Cozy customization end
