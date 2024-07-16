import { Component, OnInit } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";

import { CozyClientService } from "../../../popup/services/cozyClient.service";

const TOOLTIP_EXPLAIN_ENCRYPTION_DISMISSED = "tooltip_explain_encryption_dismissed";

@Component({
  selector: "app-encrypted-info",
  templateUrl: "encrypted-info.component.html",
})
export class EncryptedInfoComponent implements OnInit {
  tooltipDismissed = true;

  constructor(
    protected cipherService: CipherService,
    protected i18nService: I18nService,
    protected stateService: StateService,
    protected cozyClientService: CozyClientService,
  ) {}

  async ngOnInit() {
    const client = await this.cozyClientService.getClientInstance();
    const settings = await client.getSettings("passwords", [TOOLTIP_EXPLAIN_ENCRYPTION_DISMISSED]);
    this.tooltipDismissed = settings.tooltip_explain_encryption_dismissed;
  }

  async moreInfo() {
    const infoUrl =
      "https://support.cozy.io/394-comment-puis-je-parametrer-mon-gestionnaire-de-mot-de-passe/";
    // eslint-disable-next-line no-restricted-globals
    window.open(infoUrl);
  }

  async dismiss() {
    const client = await this.cozyClientService.getClientInstance();
    await client.saveAfterFetchSettings("passwords", {
      tooltip_explain_encryption_dismissed: true,
    });

    this.tooltipDismissed = true;
  }
}
