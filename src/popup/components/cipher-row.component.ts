import { Component, EventEmitter, Input, Output } from "@angular/core";

import { CipherView } from "jslib-common/models/view/cipherView";
import { zeroPadLeftUntilTwoChars } from "../../tools/strings";
import { CipherType } from "jslib-common/enums/cipherType";

@Component({
  selector: "app-cipher-row",
  templateUrl: "cipher-row.component.html",
})
export class CipherRowComponent {
  @Output() onSelected = new EventEmitter<CipherView>();
  @Output() launchEvent = new EventEmitter<CipherView>();
  @Output() onView = new EventEmitter<CipherView>();
  @Output() onAutofill = new EventEmitter<CipherView>();
  @Input() cipher: CipherView;
  @Input() showGlobe = false;
  @Input() title: string;

  cipherType = CipherType;

  selectCipher(c: CipherView) {
    this.onSelected.emit(c);
  }

  launchCipher(c: CipherView) {
    this.launchEvent.emit(c);
  }

  viewCipher(c: CipherView) {
    this.onView.emit(c);
  }

  autofill(c: CipherView) {
    this.onAutofill.emit(c);
  }

  getSubtitle(c: CipherView) {
    if (c.type === CipherType.Card) {
      const subTitleParts = [];

      if (c.subTitle) {
        subTitleParts.push(c.subTitle);
      }

      const isMonthFormatOk = !!c.card.expMonth;
      const isYearFormatOk = c.card.expYear?.match(/^(?:\d{2}){1,2}$/g);

      if (isMonthFormatOk || isYearFormatOk) {
        const month = isMonthFormatOk ? zeroPadLeftUntilTwoChars(c.card.expMonth) : "__";
        const year = isYearFormatOk ? zeroPadLeftUntilTwoChars(c.card.expYear) : "__";

        subTitleParts.push(`${month}/${year}`);
      }

      return subTitleParts.join(", ");

    return c.subTitle;
  }
}
