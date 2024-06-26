import { StateService as BaseStateServiceAbstraction } from "@bitwarden/common/abstractions/state.service";
import { StorageOptions } from "@bitwarden/common/models/domain/storage-options";

import { Account } from "../../models/account";
import { BrowserComponentState } from "../../models/browserComponentState";
import { BrowserGroupingsComponentState } from "../../models/browserGroupingsComponentState";
import { BrowserSendComponentState } from "../../models/browserSendComponentState";
import { KonnectorsOrg } from "../../models/konnectorsOrganization";

export abstract class BrowserStateService extends BaseStateServiceAbstraction<Account> {
  getBrowserGroupingComponentState: (
    options?: StorageOptions
  ) => Promise<BrowserGroupingsComponentState>;
  setBrowserGroupingComponentState: (
    value: BrowserGroupingsComponentState,
    options?: StorageOptions
  ) => Promise<void>;
  getBrowserVaultItemsComponentState: (options?: StorageOptions) => Promise<BrowserComponentState>;
  setBrowserVaultItemsComponentState: (
    value: BrowserComponentState,
    options?: StorageOptions
  ) => Promise<void>;
  getBrowserSendComponentState: (options?: StorageOptions) => Promise<BrowserSendComponentState>;
  setBrowserSendComponentState: (
    value: BrowserSendComponentState,
    options?: StorageOptions
  ) => Promise<void>;
  getBrowserSendTypeComponentState: (options?: StorageOptions) => Promise<BrowserComponentState>;
  setBrowserSendTypeComponentState: (
    value: BrowserComponentState,
    options?: StorageOptions
  ) => Promise<void>;

  // Cozy customization
  //*
  getEnableInPageMenu: (options?: StorageOptions) => Promise<boolean>;

  setEnableInPageMenu: (value: boolean, options?: StorageOptions) => Promise<void>;

  getDisableKonnectorsSuggestions: (options?: StorageOptions) => Promise<boolean>;

  setDisableKonnectorsSuggestions: (value: boolean, options?: StorageOptions) => Promise<void>;

  setHistoryState: (value: string) => Promise<void>;

  getHistoryState: () => Promise<string>;

  setKonnectorsOrganization: (value: KonnectorsOrg) => Promise<void>;

  getKonnectorsOrganization: () => Promise<KonnectorsOrg>;

  setBannerClosedByUser: (value: boolean) => Promise<void>;

  getBannerClosedByUser: () => Promise<boolean>;

  getOauthTokens: () => Promise<{ clientId: string; registrationAccessToken: string }>;
  //*/
}
