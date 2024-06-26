// Cozy customization
import { Jsonify } from "type-fest";

import { PaperType } from "../../../enums/paperType";
import { Paper } from "../domain/paper";

import { ItemView } from "./item.view";

export class PaperView extends ItemView {
  type: PaperType = null;
  ownerName: string = null;
  illustrationThumbnailUrl: string = null;
  illustrationUrl: string = null;
  qualificationLabel: string = null;
  noteContent: string = null;

  constructor(p?: Paper) {
    super();
    if (!p) {
      return;
    }

    this.type = p.type;
  }

  get subTitle(): string {
    const subTitle =
      this.type === PaperType.Paper ? this.ownerName : this.noteContent?.split("\n")[0];
    return subTitle || "";
  }

  static fromJSON(obj: Partial<Jsonify<PaperView>>): PaperView {
    return Object.assign(new PaperView(), obj);
  }
}
// Cozy customization end
