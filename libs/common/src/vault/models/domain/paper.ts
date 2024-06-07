// Cozy customization
import { PaperType } from "../../../enums/paperType";
import Domain from "../../../platform/models/domain/domain-base";
import { EncString } from "../../../platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
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
      [],
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
      encKey,
    );
  }

  toPaperData(): PaperData {
    const p = new PaperData();
    p.type = this.type;
    this.buildDataModel(
      this,
      p,
      {
        ownerName: null,
        illustrationThumbnailUrl: null,
        illustrationUrl: null,
        qualificationLabel: null,
        noteContent: null,
      },
      [],
    );

    return p;
  }
}
// Cozy customization end
