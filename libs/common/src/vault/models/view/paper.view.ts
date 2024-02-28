// Cozy customization
import { Jsonify } from "type-fest";

import { Paper } from "../domain/paper";

import { ItemView } from "./item.view";

export class PaperView extends ItemView {
  ownerName: string = null;
  illustrationThumbnailUrl: string = null;

  constructor(p?: Paper) {
    super();
    if (!p) {
      return;
    }

    this.ownerName = p.ownerName;
    this.illustrationThumbnailUrl = p.illustrationThumbnailUrl;
  }

  get subTitle(): string {
    return this.ownerName;
  }

  static fromJSON(obj: Partial<Jsonify<PaperView>>): PaperView {
    return Object.assign(new PaperView(), obj);
  }
}
// Cozy customization end
