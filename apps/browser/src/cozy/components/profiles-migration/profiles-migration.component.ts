import { Component, Input, OnInit } from "@angular/core";
/* eslint-disable import/no-duplicates */
import addDays from "date-fns/addDays";
import formatDistanceToNowStrict from "date-fns/formatDistanceToNowStrict";
import fr from "date-fns/locale/fr";

import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { StateService } from "@bitwarden/common/abstractions/state.service";

const DELAY_IN_DAYS = 15;

@Component({
  selector: "app-profiles-migration",
  templateUrl: "profiles-migration.component.html",
})
export class ProfilesMigrationComponent implements OnInit {
  @Input() profilesCount: number;
  remaining: string;
  deadline: string;
  ready = false;
  constructor(
    protected i18nService: I18nService,
    protected stateService: StateService
  ) {}

  async ngOnInit() {
    let cleanDeadline = await this.stateService.getProfilesCleanDeadline();

    if (!cleanDeadline) {
      cleanDeadline = addDays(new Date(), DELAY_IN_DAYS);
      this.stateService.setProfilesCleanDeadline(cleanDeadline);
    }

    this.deadline = cleanDeadline.toLocaleDateString();
    this.remaining = formatDistanceToNowStrict(cleanDeadline, {
      // @ts-expect-error I did not succeed in getting i18nService.translationLocale so I fallback to a private property
      locale: this.i18nService.systemLanguage === "fr" ? fr : undefined,
      unit: "day",
    });

    this.ready = true;
  }

  moreInfo() {}
}
