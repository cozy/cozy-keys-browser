import { Jsonify } from "type-fest";

import { FieldSubType } from "../../../enums/fieldSubType";
import { FieldType } from "../../../enums/fieldType";
import { LinkedIdType } from "../../../enums/linkedIdType";
import Domain from "../../../models/domain/domain-base";
import { EncString } from "../../../models/domain/enc-string";
import { SymmetricCryptoKey } from "../../../models/domain/symmetric-crypto-key";
import { ExpirationDateData } from "../data/expiration-date.data";
import { FieldData } from "../data/field.data";
import { LabelData } from "../data/label.data";
import { FieldView } from "../view/field.view";

export class Field extends Domain {
  name: EncString;
  value: EncString;
  type: FieldType;
  linkedId: LinkedIdType;
  // Cozy customization
  id: string;
  parentId: string; // If a field has a parentId, we will display it on the view page only if the parentId is selected
  subtype: FieldSubType;
  cozyType: string; // Type of the data on Cozy side, like 'givenName', 'country', 'company'
  expirationData: ExpirationDateData;
  label: LabelData;
  // Cozy customization end

  constructor(obj?: FieldData) {
    super();
    if (obj == null) {
      return;
    }

    this.type = obj.type;
    // Cozy customization
    this.id = obj.id;
    this.parentId = obj.parentId;
    this.subtype = obj.subtype;
    this.cozyType = obj.cozyType;
    this.expirationData = obj.expirationData;
    this.label = obj.label;
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
    f.id = this.id;
    f.parentId = this.parentId;
    f.subtype = this.subtype;
    f.cozyType = this.cozyType;
    f.expirationData = this.expirationData;
    f.label = this.label;
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
