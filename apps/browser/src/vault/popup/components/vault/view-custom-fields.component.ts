import { Component } from "@angular/core";

import { ViewCustomFieldsComponent as BaseViewCustomFieldsComponent } from "@bitwarden/angular/vault/components/view-custom-fields.component";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
/* Cozy customization */
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
/* Cozy customization end */

@Component({
  selector: "app-vault-view-custom-fields",
  templateUrl: "view-custom-fields.component.html",
})
export class ViewCustomFieldsComponent extends BaseViewCustomFieldsComponent {
  /* Cozy customization */
  cipherType = CipherType;
  /* Cozy customization end */

  constructor(eventCollectionService: EventCollectionService) {
    super(eventCollectionService);
  }
}
