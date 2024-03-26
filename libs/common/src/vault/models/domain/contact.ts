// Cozy customization
import Domain from "../../../models/domain/domain-base";
import { SymmetricCryptoKey } from "../../../models/domain/symmetric-crypto-key";
import { ContactData } from "../data/contact.data";
import { ContactView } from "../view/contact.view";

export class Contact extends Domain {
  constructor(obj?: ContactData) {
    super();
    if (obj == null) {
      return;
    }
  }

  decrypt(orgId: string, encKey?: SymmetricCryptoKey): Promise<ContactView> {
    return Promise.resolve(new ContactView(this));
  }
}
// Cozy customization end
