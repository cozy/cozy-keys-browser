import { BehaviorSubject } from "rxjs";

// import { GlobalState } from "@bitwarden/common/models/domain/global-state";
import { StorageOptions } from "@bitwarden/common/models/domain/storage-options";
import { StateService as BaseStateService } from "@bitwarden/common/services/state.service";

import { browserSession, sessionSync } from "../decorators/session-sync-observable";
import { Account } from "../models/account";
import { BrowserComponentState } from "../models/browserComponentState";
import { BrowserGroupingsComponentState } from "../models/browserGroupingsComponentState";
import { BrowserSendComponentState } from "../models/browserSendComponentState";
import { KonnectorsOrg } from "../models/konnectorsOrganization";

import { BrowserStateService as StateServiceAbstraction } from "./abstractions/browser-state.service";

// Cozy Imports
/* eslint-disable */
import { GlobalState } from "../models/globalState";
/* eslint-enable */
// End Cozy imports

@browserSession
export class BrowserStateService
  extends BaseStateService<GlobalState, Account>
  implements StateServiceAbstraction
{
  @sessionSync({
    initializer: Account.fromJSON as any, // TODO: Remove this any when all any types are removed from Account
    initializeAs: "record",
  })
  protected accountsSubject: BehaviorSubject<{ [userId: string]: Account }>;
  @sessionSync({ initializer: (s: string) => s })
  protected activeAccountSubject: BehaviorSubject<string>;
  @sessionSync({ initializer: (b: boolean) => b })
  protected activeAccountUnlockedSubject: BehaviorSubject<boolean>;
  @sessionSync({
    initializer: Account.fromJSON as any, // TODO: Remove this any when all any types are removed from Account
    initializeAs: "record",
  })
  protected accountDiskCache: BehaviorSubject<Record<string, Account>>;

  protected accountDeserializer = Account.fromJSON;

  async addAccount(account: Account) {
    // Apply browser overrides to default account values
    account = new Account(account);
    await super.addAccount(account);
  }

  async getIsAuthenticated(options?: StorageOptions): Promise<boolean> {
    // Firefox Private Mode can clash with non-Private Mode because they both read from the same onDiskOptions
    // Check that there is an account in memory before considering the user authenticated
    return (
      (await super.getIsAuthenticated(options)) &&
      (await this.getAccount(await this.defaultInMemoryOptions())) != null
    );
  }

  async getBrowserGroupingComponentState(
    options?: StorageOptions
  ): Promise<BrowserGroupingsComponentState> {
    return (
      await this.getAccount(this.reconcileOptions(options, await this.defaultInMemoryOptions()))
    )?.groupings;
  }

  async setBrowserGroupingComponentState(
    value: BrowserGroupingsComponentState,
    options?: StorageOptions
  ): Promise<void> {
    const account = await this.getAccount(
      this.reconcileOptions(options, await this.defaultInMemoryOptions())
    );
    account.groupings = value;
    await this.saveAccount(
      account,
      this.reconcileOptions(options, await this.defaultInMemoryOptions())
    );
  }

  async getBrowserVaultItemsComponentState(
    options?: StorageOptions
  ): Promise<BrowserComponentState> {
    return (
      await this.getAccount(this.reconcileOptions(options, await this.defaultInMemoryOptions()))
    )?.ciphers;
  }

  async setBrowserVaultItemsComponentState(
    value: BrowserComponentState,
    options?: StorageOptions
  ): Promise<void> {
    const account = await this.getAccount(
      this.reconcileOptions(options, await this.defaultInMemoryOptions())
    );
    account.ciphers = value;
    await this.saveAccount(
      account,
      this.reconcileOptions(options, await this.defaultInMemoryOptions())
    );
  }

  async getBrowserSendComponentState(options?: StorageOptions): Promise<BrowserSendComponentState> {
    return (
      await this.getAccount(this.reconcileOptions(options, await this.defaultInMemoryOptions()))
    )?.send;
  }

  async setBrowserSendComponentState(
    value: BrowserSendComponentState,
    options?: StorageOptions
  ): Promise<void> {
    const account = await this.getAccount(
      this.reconcileOptions(options, await this.defaultInMemoryOptions())
    );
    account.send = value;
    await this.saveAccount(
      account,
      this.reconcileOptions(options, await this.defaultInMemoryOptions())
    );
  }

  async getBrowserSendTypeComponentState(options?: StorageOptions): Promise<BrowserComponentState> {
    return (
      await this.getAccount(this.reconcileOptions(options, await this.defaultInMemoryOptions()))
    )?.sendType;
  }

  async setBrowserSendTypeComponentState(
    value: BrowserComponentState,
    options?: StorageOptions
  ): Promise<void> {
    const account = await this.getAccount(
      this.reconcileOptions(options, await this.defaultInMemoryOptions())
    );
    account.sendType = value;
    await this.saveAccount(
      account,
      this.reconcileOptions(options, await this.defaultInMemoryOptions())
    );
  }

  /* Cozy custo */
  async getEnableInPageMenu(options?: StorageOptions): Promise<boolean> {
    return (
      (
        await this.getGlobals(
          this.reconcileOptions(options, await this.defaultOnDiskLocalOptions())
        )
      )?.enableInPageMenu ?? true // defaults to true
    );
  }

  async setEnableInPageMenu(value: boolean, options?: StorageOptions): Promise<void> {
    const globals = await this.getGlobals(
      this.reconcileOptions(options, await this.defaultOnDiskLocalOptions())
    );
    globals.enableInPageMenu = value;
    await this.saveGlobals(
      globals,
      this.reconcileOptions(options, await this.defaultOnDiskLocalOptions())
    );
  }

  async getDisableKonnectorsSuggestions(options?: StorageOptions): Promise<boolean> {
    return (
      (
        await this.getGlobals(
          this.reconcileOptions(options, await this.defaultOnDiskLocalOptions())
        )
      )?.disableKonnectorsSuggestions ?? false // defaults to false
    );
  }

  async setDisableKonnectorsSuggestions(value: boolean, options?: StorageOptions): Promise<void> {
    const globals = await this.getGlobals(
      this.reconcileOptions(options, await this.defaultOnDiskLocalOptions())
    );
    globals.disableKonnectorsSuggestions = value;
    await this.saveGlobals(
      globals,
      this.reconcileOptions(options, await this.defaultOnDiskLocalOptions())
    );
  }

  async setHistoryState(value: string): Promise<void> {
    const account = await this.getAccount(await this.defaultInMemoryOptions());
    if (!account) {
      return;
    }
    account.history = value;
    await this.saveAccount(account, await this.defaultInMemoryOptions());
  }

  async getHistoryState(): Promise<string> {
    return (await this.getAccount(await this.defaultInMemoryOptions()))?.history;
  }

  async getKonnectorsOrganization(): Promise<KonnectorsOrg> {
    const organizationString = (await this.getAccount(await this.defaultInMemoryOptions()))
      ?.konnectorsOrganization;

    return organizationString ? JSON.parse(organizationString) : null;
  }

  async setKonnectorsOrganization(value: KonnectorsOrg): Promise<void> {
    const account = await this.getAccount(await this.defaultInMemoryOptions());
    if (!account) {
      return;
    }
    account.konnectorsOrganization = JSON.stringify(value);
    await this.saveAccount(account, await this.defaultInMemoryOptions());
  }

  async setBannerClosedByUser(value: boolean) {
    const account = await this.getAccount(await this.defaultInMemoryOptions());
    if (!account) {
      return;
    }
    account.bannerClosedByUser = value;
    await this.saveAccount(account, await this.defaultInMemoryOptions());
  }

  async getBannerClosedByUser() {
    return (await this.getAccount(await this.defaultInMemoryOptions()))?.bannerClosedByUser;
  }

  async getOauthTokens(): Promise<{ clientId: string; registrationAccessToken: string }> {
    const account = await this.getAccount(await this.defaultOnDiskLocalOptions());
    if (!account) {
      return;
    }
    const { clientId, registrationAccessToken } = account.tokens;
    return { clientId, registrationAccessToken };
  }
  /* end custo */
}
