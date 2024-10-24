import { Component, OnInit } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { CozyClientService } from "../../../popup/services/cozyClient.service";

const AUTOFILL_TOOLTIP_DISMISSED = "autofill_tooltip_dismissed";

@Component({
  selector: "app-autofill-tooltip",
  templateUrl: "autofill-tooltip.component.html",
})
export class AutofillTooltipComponent implements OnInit {
  tooltipDismissed = true;

  constructor(
    protected i18nService: I18nService,
    protected cozyClientService: CozyClientService,
  ) {}

  async ngOnInit() {
    const client = await this.cozyClientService.getClientInstance();
    const settings = await client.getSettings("passwords", [AUTOFILL_TOOLTIP_DISMISSED]);
    this.tooltipDismissed = settings.autofill_tooltip_dismissed;
  }

  async dismiss() {
    const client = await this.cozyClientService.getClientInstance();
    await client.saveAfterFetchSettings("passwords", {
      autofill_tooltip_dismissed: true,
    });
    this.tooltipDismissed = true;
  }
}
