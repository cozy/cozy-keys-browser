// Cozy customization
import Domain from "../../../models/domain/domain-base";
import { EncString } from "../../../models/domain/enc-string";
import { SymmetricCryptoKey } from "../../../models/domain/symmetric-crypto-key";
import { ContactData } from "../data/contact.data";
import { ContactView } from "../view/contact.view";

export class Contact extends Domain {
  displayName: EncString;
  initials: EncString;
  primaryEmail: EncString;

  constructor(obj?: ContactData) {
    super();
    if (obj == null) {
      return;
    }

    this.buildDomainModel(
      this,
      obj,
      {
        displayName: null,
        initials: null,
        primaryEmail: null,
      },
      []
    );
  }

  decrypt(orgId: string, encKey?: SymmetricCryptoKey): Promise<ContactView> {
    return this.decryptObj(
      new ContactView(this),
      {
        displayName: null,
        initials: null,
        primaryEmail: null,
      },
      orgId,
      encKey
    );
  }
}
// Cozy customization end
