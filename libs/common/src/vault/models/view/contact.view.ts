// Cozy customization
import { Jsonify } from "type-fest";

import { Contact } from "../domain/contact";

import { ItemView } from "./item.view";

export class ContactView extends ItemView {
  displayName: string = null;
  initials: string = null;
  primaryEmail: string = null;

  constructor(p?: Contact) {
    super();
    if (!p) {
      return;
    }
  }

  get subTitle(): string {
    return this.primaryEmail !== this.displayName ? this.primaryEmail : null;
  }

  static fromJSON(obj: Partial<Jsonify<ContactView>>): ContactView {
    return Object.assign(new ContactView(), obj);
  }
}
// Cozy customization end
