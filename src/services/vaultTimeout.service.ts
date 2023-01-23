import { VaultTimeoutService as BaseVaultTimeoutService } from "jslib-common/services/vaultTimeout.service";

import { SafariApp } from "../browser/safariApp";

import { CipherService } from "jslib-common/abstractions/cipher.service";
import { CollectionService } from "jslib-common/abstractions/collection.service";
import { CryptoService } from "jslib-common/abstractions/crypto.service";
import { FolderService } from "jslib-common/abstractions/folder.service";
import { KeyConnectorService } from "jslib-common/abstractions/keyConnector.service";
import { MessagingService } from "jslib-common/abstractions/messaging.service";
import { PlatformUtilsService } from "jslib-common/abstractions/platformUtils.service";
import { PolicyService } from "jslib-common/abstractions/policy.service";
import { SearchService } from "jslib-common/abstractions/search.service";
import { StateService } from "./state.service";
import { TokenService } from "jslib-common/abstractions/token.service";

export default class VaultTimeoutService extends BaseVaultTimeoutService {
  constructor(
    protected _cipherService: CipherService,
    protected _folderService: FolderService,
    protected _collectionService: CollectionService,
    protected _cryptoService: CryptoService,
    protected _platformUtilsService: PlatformUtilsService,
    protected _messagingService: MessagingService,
    protected _searchService: SearchService,
    protected _tokenService: TokenService,
    protected _policyService: PolicyService,
    protected _keyConnectorService: KeyConnectorService,
    protected _stateService: StateService,
    protected _lockedCallback: (userId?: string) => Promise<void> = null,
    protected _loggedOutCallback: (userId?: string) => Promise<void> = null
  ) {
    super(
      _cipherService,
      _folderService,
      _collectionService,
      _cryptoService,
      _platformUtilsService,
      _messagingService,
      _searchService,
      _tokenService,
      _policyService,
      _keyConnectorService,
      _stateService,
      _lockedCallback,
      _loggedOutCallback
    );
  }

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

  // overided just in order to reset history
  async lock(allowSoftLock = false, userId?: string): Promise<void> {
    await this._stateService.setHistoryState(null);
    super.lock(allowSoftLock, userId);
  }
}
