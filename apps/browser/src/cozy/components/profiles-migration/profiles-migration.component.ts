/* eslint-disable no-console */
import { Component, Input, OnInit } from "@angular/core";
/* eslint-disable import/no-duplicates */
import addDays from "date-fns/addDays";
import formatDistanceToNowStrict from "date-fns/formatDistanceToNowStrict";
import isAfter from "date-fns/isAfter";
import fr from "date-fns/locale/fr";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";

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
  profilesMigrationHidden = false;
  constructor(
    protected cipherService: CipherService,
    protected i18nService: I18nService,
    protected stateService: StateService,
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

    this.profilesMigrationHidden = await this.stateService.getProfilesMigrationHidden();

    const didClean = await this.handleDeadline(cleanDeadline);

    if (!didClean) {
      this.ready = true;
    }
  }

  protected async handleDeadline(deadline: Date) {
    if (!isAfter(new Date(), deadline)) {
      return false;
    }

    try {
      const allCiphers = await this.cipherService.getAllDecrypted();

      for (const cipher of allCiphers) {
        if (cipher.type === CipherType.Identity && !cipher.isDeleted) {
          await this.cipherService.softDeleteWithServer(cipher.id);
        }
      }
    } catch (err) {
      console.log("Error while trying to delete Profiles", err);
      return false;
    }

    return true;
  }

  protected async understood() {
    await this.stateService.setProfilesMigrationHidden(true);
    this.profilesMigrationHidden = true;
  }

  moreInfo() {
    const infoUrl =
      "https://support.cozy.io/394-comment-puis-je-parametrer-mon-gestionnaire-de-mot-de-passe/";
    // eslint-disable-next-line no-restricted-globals
    window.open(infoUrl);
  }
}
