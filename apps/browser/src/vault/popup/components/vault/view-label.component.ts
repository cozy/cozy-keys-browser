import { Component, Input, OnInit } from "@angular/core";

import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { LabelData } from "@bitwarden/common/vault/models/data/label.data";

@Component({
  selector: "app-vault-view-label",
  templateUrl: "./view-label.component.html",
})
export class ViewLabelComponent implements OnInit {
  @Input() label: LabelData;
  stringifiedLabel: string;

  constructor(private i18nService: I18nService) {}

  ngOnInit(): void {
    if (this.label.type && !this.label.label) {
      const type = this.getTranslatedType(this.label.type);

      this.stringifiedLabel = type;
    } else if (!this.label.type && this.label.label) {
      const label = this.getTranslatedLabel(this.label.label);

      this.stringifiedLabel = label;
    } else if (this.label.type && this.label.label) {
      const type = this.getTranslatedType(this.label.type);
      const label = this.getTranslatedLabel(this.label.label);

      this.stringifiedLabel = `${type} (${label.toLowerCase()})`;
    }
  }

  getTranslatedType(type: string) {
    return ["cell", "voice", "fax"].includes(type) ? this.i18nService.translate(type) : type;
  }

  getTranslatedLabel(label: string) {
    return this.i18nService.translate(label);
  }
}
