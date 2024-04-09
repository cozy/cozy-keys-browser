import { FieldSubType } from "../../enums/fieldSubType";
import { FieldType } from "../../enums/fieldType";
import { LinkedIdType } from "../../enums/linkedIdType";
import { ExpirationDateData } from "../../vault/models/data/expiration-date.data";
import { LabelData } from "../../vault/models/data/label.data";
import { BaseResponse } from "../response/base.response";

export class FieldApi extends BaseResponse {
  name: string;
  value: string;
  type: FieldType;
  // Cozy customization
  subtype: FieldSubType;
  expirationData: ExpirationDateData;
  label: LabelData;
  // Cozy customization end
  linkedId: LinkedIdType;

  constructor(data: any = null) {
    super(data);
    if (data == null) {
      return;
    }
    this.type = this.getResponseProperty("Type");
    // Cozy customization
    this.subtype = this.getResponseProperty("Subtype");
    this.expirationData = this.getResponseProperty("ExpirationData");
    this.label = this.getResponseProperty("Label");
    // Cozy customization end
    this.name = this.getResponseProperty("Name");
    this.value = this.getResponseProperty("Value");
    this.linkedId = this.getResponseProperty("linkedId");
  }
}
