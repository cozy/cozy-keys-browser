import { VaultTimeoutService as BaseVaultTimeoutService } from "@bitwarden/common/services/vaultTimeout/vaultTimeout.service";

import { SafariApp } from "../../browser/safariApp";
import { BrowserStateService } from "../browser-state.service";

export default class VaultTimeoutService extends BaseVaultTimeoutService {
  protected stateService: BrowserStateService;

  startCheck() {
    this.checkVaultTimeout();
    if (this.platformUtilsService.isSafari()) {
      this.checkSafari();
    } else {
      setInterval(() => this.checkVaultTimeout(), 10 * 1000); // check every 10 seconds
    }
  }

  // This is a work-around to safari adding an arbitary delay to setTimeout and
  //  setIntervals. It works by calling the native extension which sleeps for 10s,
  //  efficiently replicating setInterval.
  async checkSafari() {
    // eslint-disable-next-line
    while (true) {
      try {
        await SafariApp.sendMessageToApp("sleep");
        this.checkVaultTimeout();
      } catch (e) {
        // eslint-disable-next-line
        console.log("Exception Safari VaultTimeout", e);
      }
    }
  }

  /* Cozy custo overided just in order to reset history */
  async lock(userId?: string): Promise<void> {
    await this.stateService.setHistoryState(null);
    super.lock(userId);
  }
  /* end custo */
}
