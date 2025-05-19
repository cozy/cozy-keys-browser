/* Cozy custo
import { Component, EventEmitter, Input, Output } from "@angular/core";
*/
import { Component, EventEmitter, Input, Output, OnChanges } from "@angular/core";
/* end custo */

import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
/** Start Cozy imports */
/* eslint-disable */
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { zeroPadLeftUntilTwoChars } from "../../../tools/strings";
import { KonnectorsService } from "../../../popup/services/konnectors.service";
import { DomSanitizer } from "@angular/platform-browser";
/* eslint-enable */
/** End Cozy imports */

@Component({
  selector: "app-cipher-row",
  templateUrl: "cipher-row.component.html",
})
export class CipherRowComponent implements OnChanges {
  @Output() onSelected = new EventEmitter<CipherView>();
  @Output() launchEvent = new EventEmitter<CipherView>();
  @Output() onView = new EventEmitter<CipherView>();
  @Input() cipher: CipherView;
  @Input() last: boolean;
  @Input() showView = false;
  @Input() title: string;
  isKonnector: boolean;
  constructor(
    protected konnectorService: KonnectorsService,
    private syncService: SyncService,
    private sanitizer: DomSanitizer,
  ) {}
  /* Cozy custo */
  @Output() onAutofill = new EventEmitter<CipherView>();
  cipherType = CipherType;
  /* end custo */

  selectCipher(c: CipherView) {
    this.onSelected.emit(c);
  }

  launchCipher(c: CipherView) {
    this.launchEvent.emit(c);
  }

  viewCipher(c: CipherView) {
    this.onView.emit(c);
  }

  /* Cozy custo */
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
    }

    return c.subTitle;
  }

  // Cozy customization, differentiate shared Ciphers from ciphers in "Cozy Connectors" organization
  async ngOnChanges() {
    if (this.cipher.organizationId) {
      this.isKonnector = await this.konnectorService.isKonnectorsOrganization(
        this.cipher.organizationId,
      );
    } else {
      this.isKonnector = false;
    }
  }
  /* end custo */

  // Cozy customization
  sanitize(url: string) {
    return this.sanitizer.bypassSecurityTrustUrl(url);
  }
  // Cozy customization end
}
