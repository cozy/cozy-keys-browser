import { Component, HostListener, OnInit } from "@angular/core";
import { Router } from "@angular/router";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";

@Component({
  selector: "app-sync",
  templateUrl: "sync.component.html",
})
export class SyncComponent implements OnInit {
  lastSync = "--";
  syncPromise: Promise<any>;

  constructor(
    private syncService: SyncService,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private router: Router,
  ) {}

  @HostListener("window:keydown", ["$event"])
  handleKeyDown(event: KeyboardEvent) {
    this.router.navigate(["/tabs/settings"]);
    event.preventDefault();
  }

  async ngOnInit() {
    await this.setLastSync();
  }

  async sync() {
    this.syncPromise = this.syncService.fullSync(true);
    const success = await this.syncPromise;
    if (success) {
      await this.setLastSync();
      this.platformUtilsService.showToast("success", null, this.i18nService.t("syncingComplete"));
    } else {
      this.platformUtilsService.showToast("error", null, this.i18nService.t("syncingFailed"));
    }
  }

  async setLastSync() {
    const last = await this.syncService.getLastSync();
    if (last != null) {
      this.lastSync = last.toLocaleDateString() + " " + last.toLocaleTimeString();
    } else {
      this.lastSync = this.i18nService.t("never");
    }
  }
}
