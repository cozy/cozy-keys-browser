import { Component, Input, OnInit } from "@angular/core";
import { models } from "cozy-client";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { FieldView } from "@bitwarden/common/vault/models/view/field.view";

const { makeExpiredMessage, makeExpiresInMessage } = models.paper;

@Component({
  selector: "app-vault-view-expiration-date",
  templateUrl: "./view-expiration-date.component.html",
})
export class ViewExpirationDateComponent implements OnInit {
  @Input() field: FieldView;
  message: string;

  constructor(private i18nService: I18nService) {}

  ngOnInit() {
    if (this.field.expirationData.isExpired) {
      this.message = this.getExpiredMessage();
    } else if (this.field.expirationData.isExpiringSoon) {
      this.message = this.getExpiresInMessage();
    }
  }

  private getExpiredMessage(): string {
    return makeExpiredMessage(
      this.field.expirationData.expirationDate,
      // @ts-expect-error I did not succeed in getting i18nService.translationLocale so I fallback to a private property
      { lang: this.i18nService.systemLanguage },
    );
  }

  private getExpiresInMessage(): string {
    return makeExpiresInMessage(
      this.field.expirationData.expirationDate,
      // @ts-expect-error I did not succeed in getting i18nService.translationLocale so I fallback to a private property
      { lang: this.i18nService.systemLanguage },
    );
  }
}
