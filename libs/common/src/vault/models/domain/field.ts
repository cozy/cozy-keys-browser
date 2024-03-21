import { Jsonify } from "type-fest";

import { FieldSubType } from "../../../enums/fieldSubType";
import { FieldType } from "../../../enums/fieldType";
import { LinkedIdType } from "../../../enums/linkedIdType";
import Domain from "../../../models/domain/domain-base";
import { EncString } from "../../../models/domain/enc-string";
import { SymmetricCryptoKey } from "../../../models/domain/symmetric-crypto-key";
import { ExpirationDateData } from "../data/expiration-date.data";
import { FieldData } from "../data/field.data";
import { FieldView } from "../view/field.view";

export class Field extends Domain {
  name: EncString;
  value: EncString;
  type: FieldType;
  linkedId: LinkedIdType;
  // Cozy customization
  subtype: FieldSubType;
  expirationData: ExpirationDateData;
  // Cozy customization end

  constructor(obj?: FieldData) {
    super();
    if (obj == null) {
      return;
    }

    this.type = obj.type;
    // Cozy customization
    this.subtype = obj.subtype;
    this.expirationData = obj.expirationData;
    // Cozy customization end
    this.linkedId = obj.linkedId;
    this.buildDomainModel(
      this,
      obj,
      {
        name: null,
        value: null,
      },
      []
    );
  }

  decrypt(orgId: string, encKey?: SymmetricCryptoKey): Promise<FieldView> {
    return this.decryptObj(
      new FieldView(this),
      {
        name: null,
        value: null,
      },
      orgId,
      encKey
    );
  }

  toFieldData(): FieldData {
    const f = new FieldData();
    this.buildDataModel(
      this,
      f,
      {
        name: null,
        value: null,
        type: null,
        linkedId: null,
      },
      ["type", "linkedId"]
    );
    return f;
  }

  static fromJSON(obj: Partial<Jsonify<Field>>): Field {
    if (obj == null) {
      return null;
    }

    const name = EncString.fromJSON(obj.name);
    const value = EncString.fromJSON(obj.value);

    return Object.assign(new Field(), obj, {
      name,
      value,
    });
  }
}
