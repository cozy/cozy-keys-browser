// Cozy customization
import { Jsonify } from "type-fest";

import Domain from "../../../platform/models/domain/domain-base";
import { EncString } from "../../../platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { ContactData } from "../data/contact.data";
import { ContactView } from "../view/contact.view";

export class Contact extends Domain {
  displayName: EncString;
  initials: EncString;
  primaryEmail: EncString;
  primaryPhone: EncString;
  me: boolean;

  constructor(obj?: ContactData) {
    super();
    if (obj == null) {
      return;
    }

    this.me = obj.me;
    this.buildDomainModel(
      this,
      obj,
      {
        displayName: null,
        initials: null,
        primaryEmail: null,
        primaryPhone: null,
      },
      [],
    );
  }

  decrypt(orgId: string, encKey?: SymmetricCryptoKey): Promise<ContactView> {
    return this.decryptObj(
      new ContactView(this),
      {
        displayName: null,
        initials: null,
        primaryEmail: null,
        primaryPhone: null,
      },
      orgId,
      encKey,
    );
  }

  toContactData(): ContactData {
    const c = new ContactData();
    c.me = this.me;
    this.buildDataModel(
      this,
      c,
      {
        displayName: null,
        initials: null,
        primaryEmail: null,
        primaryPhone: null,
      },
      [],
    );

    return c;
  }

  static fromJSON(obj: Partial<Jsonify<Contact>>): Contact {
    if (obj == null) {
      return null;
    }

    const displayName = EncString.fromJSON(obj.displayName);
    const initials = EncString.fromJSON(obj.initials);
    const primaryEmail = EncString.fromJSON(obj.primaryEmail);
    const primaryPhone = EncString.fromJSON(obj.primaryPhone);
    const me = obj.me;

    return Object.assign(new Contact(), obj, {
      displayName,
      initials,
      primaryEmail,
      primaryPhone,
      me,
    });
  }
}
// Cozy customization end
