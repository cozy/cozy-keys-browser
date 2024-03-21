import { FieldSubType } from "../../../enums/fieldSubType";
import { FieldType } from "../../../enums/fieldType";
import { LinkedIdType } from "../../../enums/linkedIdType";
import { FieldApi } from "../../../models/api/field.api";

import { ExpirationDateData } from "./expiration-date.data";

export class FieldData {
  type: FieldType;
  // Cozy customization
  subtype: FieldSubType;
  expirationData: ExpirationDateData;
  // Cozy customization end
  name: string;
  value: string;
  linkedId: LinkedIdType;

  constructor(response?: FieldApi) {
    if (response == null) {
      return;
    }
    this.type = response.type;
    // Cozy customization
    this.subtype = response.subtype;
    this.expirationData = response.expirationData;
    // Cozy customization end
    this.name = response.name;
    this.value = response.value;
    this.linkedId = response.linkedId;
  }
}
