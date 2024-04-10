import { FieldSubType } from "../../../enums/fieldSubType";
import { FieldType } from "../../../enums/fieldType";
import { LinkedIdType } from "../../../enums/linkedIdType";
import { FieldApi } from "../../../models/api/field.api";

import { ExpirationDateData } from "./expiration-date.data";
import { LabelData } from "./label.data";

export class FieldData {
  type: FieldType;
  // Cozy customization
  id: string;
  parentId: string;
  subtype: FieldSubType;
  expirationData: ExpirationDateData;
  label: LabelData;
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
    this.id = response.id;
    this.parentId = response.parentId;
    this.subtype = response.subtype;
    this.expirationData = response.expirationData;
    this.label = response.label;
    // Cozy customization end
    this.name = response.name;
    this.value = response.value;
    this.linkedId = response.linkedId;
  }
}
