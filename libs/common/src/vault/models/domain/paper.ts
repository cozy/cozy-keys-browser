// Cozy customization
import { PaperType } from "../../../enums/paperType";
import Domain from "../../../models/domain/domain-base";
import { EncString } from "../../../models/domain/enc-string";
import { SymmetricCryptoKey } from "../../../models/domain/symmetric-crypto-key";
import { PaperData } from "../data/paper.data";
import { PaperView } from "../view/paper.view";

export class Paper extends Domain {
  type: PaperType = null;
  ownerName: EncString;
  illustrationThumbnailUrl: EncString;
  illustrationUrl: EncString;
  qualificationLabel: EncString;
  noteContent: EncString;

  constructor(obj?: PaperData) {
    super();
    if (obj == null) {
      return;
    }

    this.type = obj.type;
    this.buildDomainModel(
      this,
      obj,
      {
        ownerName: null,
        illustrationThumbnailUrl: null,
        illustrationUrl: null,
        qualificationLabel: null,
        noteContent: null,
      },
      []
    );
  }

  decrypt(orgId: string, encKey?: SymmetricCryptoKey): Promise<PaperView> {
    return this.decryptObj(
      new PaperView(this),
      {
        ownerName: null,
        illustrationThumbnailUrl: null,
        illustrationUrl: null,
        qualificationLabel: null,
        noteContent: null,
      },
      orgId,
      encKey
    );
  }
}
// Cozy customization end
