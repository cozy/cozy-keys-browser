// Cozy customization
import { Jsonify } from "type-fest";

import { Contact } from "../domain/contact";

import { ItemView } from "./item.view";

export class ContactView extends ItemView {
  constructor(p?: Contact) {
    super();
    if (!p) {
      return;
    }
  }

  get subTitle(): string {
    return "";
  }

  static fromJSON(obj: Partial<Jsonify<ContactView>>): ContactView {
    return Object.assign(new ContactView(), obj);
  }
}
// Cozy customization end
