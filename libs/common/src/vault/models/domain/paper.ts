// Cozy customization
import Domain from "../../../models/domain/domain-base";
import { SymmetricCryptoKey } from "../../../models/domain/symmetric-crypto-key";
import { PaperData } from "../data/paper.data";
import { PaperView } from "../view/paper.view";

export class Paper extends Domain {
  ownerName: string;
  illustrationThumbnailUrl: string;

  constructor(obj?: PaperData) {
    super();
    if (obj == null) {
      return;
    }

    this.ownerName = obj.ownerName;
    this.illustrationThumbnailUrl = obj.illustrationThumbnailUrl;
  }

  decrypt(orgId: string, encKey?: SymmetricCryptoKey): Promise<PaperView> {
    return Promise.resolve(new PaperView(this));
  }
}
// Cozy customization end
