/* eslint-disable import/no-duplicates */
import { Component, Input } from "@angular/core";
import formatDistanceToNowStrict from "date-fns/formatDistanceToNowStrict";
import fr from "date-fns/locale/fr";

import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { FieldView } from "@bitwarden/common/vault/models/view/field.view";

@Component({
  selector: "app-vault-view-expiration-date",
  templateUrl: "./view-expiration-date.component.html",
})
export class ViewExpirationDateComponent {
  @Input() field: FieldView;

  constructor(private i18nService: I18nService) {}

  getExpirationDistance(): string {
    return formatDistanceToNowStrict(
      new Date(this.field.expirationData.expirationDate),
      // @ts-expect-error I did not succeed in getting i18nService.translationLocale so I fallback to a private property
      { locale: this.i18nService.systemLanguage === "fr" ? fr : undefined }
    );
  }
}
