import { Jsonify } from "type-fest";

import { FieldSubType } from "@bitwarden/common/enums/fieldSubType";

import { View } from "../../../models/view/view";
import { FieldType, LinkedIdType } from "../../enums";
import { ExpirationDateData } from "../data/expiration-date.data";
import { LabelData } from "../data/label.data";
import { Field } from "../domain/field";

export class FieldView implements View {
  name: string = null;
  value: string = null;
  type: FieldType = null;
  // Cozy customization
  id?: string = null;
  parentId?: string = null;
  subtype: FieldSubType = null;
  cozyType: string = null;
  expirationData?: ExpirationDateData = null;
  label?: LabelData = null;
  // Cozy customization end
  newField = false; // Marks if the field is new and hasn't been saved
  showValue = false;
  showCount = false;
  linkedId: LinkedIdType = null;

  constructor(f?: Field) {
    if (!f) {
      return;
    }

    this.type = f.type;
    // Cozy customization
    this.id = f.id;
    this.parentId = f.parentId;
    this.subtype = f.subtype;
    this.cozyType = f.cozyType;
    this.expirationData = f.expirationData;
    this.label = f.label;
    // Cozy customization end
    this.linkedId = f.linkedId;
  }

  get maskedValue(): string {
    return this.value != null ? "••••••••" : null;
  }

  static fromJSON(obj: Partial<Jsonify<FieldView>>): FieldView {
    return Object.assign(new FieldView(), obj);
  }
}
