import { StateFactory } from "@bitwarden/common/factories/stateFactory";
import { GlobalState } from "@bitwarden/common/models/domain/global-state";

import {
  environmentServiceFactory,
  EnvironmentServiceInitOptions,
} from "../background/service_factories/environment-service.factory";
import { BrowserApi } from "../browser/browserApi";
import { Account } from "../models/account";

export async function onInstallListener(details: chrome.runtime.InstalledDetails) {
  const cache = {};
  const opts: EnvironmentServiceInitOptions = {
    encryptServiceOptions: {
      logMacFailures: false,
    },
    cryptoFunctionServiceOptions: {
      win: self,
    },
    logServiceOptions: {
      isDev: false,
    },
    stateServiceOptions: {
      stateFactory: new StateFactory(GlobalState, Account),
    },
    stateMigrationServiceOptions: {
      stateFactory: new StateFactory(GlobalState, Account),
    },
  };
  const environmentService = await environmentServiceFactory(cache, opts);

  setTimeout(async () => {
    if (details.reason != null && details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
      BrowserApi.createNewTab("https://bitwarden.com/browser-start/");

      if (await environmentService.hasManagedEnvironment()) {
        await environmentService.setUrlsToManagedEnvironment();
      }
    }
  }, 100);
}
