// Cozy customization
import { ContactApi } from "../../../models/api/contact.api";

export class ContactData {
  displayName: string;
  initials: string;
  primaryEmail: string;
  primaryPhone: string;

  constructor(data?: ContactApi) {
    if (data == null) {
      return;
    }

    this.displayName = data.displayName;
    this.initials = data.initials;
    this.primaryEmail = data.primaryEmail;
    this.primaryPhone = data.primaryPhone;
  }
}
// Cozy customization end
