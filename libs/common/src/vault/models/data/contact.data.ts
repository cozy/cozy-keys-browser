// Cozy customization
import { ContactApi } from "../api/contact.api";

export class ContactData {
  displayName: string;
  initials: string;
  primaryEmail: string;
  primaryPhone: string;
  me: boolean;

  constructor(data?: ContactApi) {
    if (data == null) {
      return;
    }

    this.displayName = data.displayName;
    this.initials = data.initials;
    this.primaryEmail = data.primaryEmail;
    this.primaryPhone = data.primaryPhone;
    this.me = data.me;
  }
}
// Cozy customization end
