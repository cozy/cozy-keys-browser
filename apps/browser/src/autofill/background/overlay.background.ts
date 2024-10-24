import {
  firstValueFrom,
  merge,
  ReplaySubject,
  Subject,
  throttleTime,
  switchMap,
  debounceTime,
  Observable,
  map,
} from "rxjs";
import { parse } from "tldts";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import {
  AutofillOverlayVisibility,
  SHOW_AUTOFILL_BUTTON,
} from "@bitwarden/common/autofill/constants";
import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { InlineMenuVisibilitySetting } from "@bitwarden/common/autofill/types";
import { NeverDomains } from "@bitwarden/common/models/domain/domain-service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import {
  Fido2ActiveRequestEvents,
  Fido2ActiveRequestManager,
} from "@bitwarden/common/platform/abstractions/fido2/fido2-active-request-manager.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { VaultSettingsService } from "@bitwarden/common/vault/abstractions/vault-settings/vault-settings.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { buildCipherIcon } from "@bitwarden/common/vault/icon/build-cipher-icon";
import { CardView } from "@bitwarden/common/vault/models/view/card.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { Fido2CredentialView } from "@bitwarden/common/vault/models/view/fido2-credential.view";
import { IdentityView } from "@bitwarden/common/vault/models/view/identity.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";

import { openUnlockPopout } from "../../auth/popup/utils/auth-popout-window";
import { BrowserApi } from "../../platform/browser/browser-api";
import {
  openAddEditVaultItemPopout,
  openViewVaultItemPopout,
} from "../../vault/popup/utils/vault-popout-window";
import {
  AutofillOverlayElement,
  AutofillOverlayPort,
  MAX_SUB_FRAME_DEPTH,
} from "../enums/autofill-overlay.enum";
import { AutofillService, CozyAutofillOptions } from "../services/abstractions/autofill.service";
import {
  ambiguousContactFieldNames,
  generateRandomChars,
  getAmbiguousFieldsContact,
} from "../utils";

import { LockedVaultPendingNotificationsData } from "./abstractions/notification.background";
import {
  BuildCipherDataParams,
  CloseInlineMenuMessage,
  CurrentAddNewItemData,
  FocusedFieldData,
  InlineMenuButtonPortMessageHandlers,
  InlineMenuCipherData,
  InlineMenuListPortMessageHandlers,
  InlineMenuPosition,
  NewCardCipherData,
  NewIdentityCipherData,
  NewLoginCipherData,
  OverlayAddNewItemMessage,
  OverlayBackground as OverlayBackgroundInterface,
  OverlayBackgroundExtensionMessage,
  OverlayBackgroundExtensionMessageHandlers,
  OverlayPortMessage,
  PageDetailsForTab,
  SubFrameOffsetData,
  SubFrameOffsetsForTab,
  ToggleInlineMenuHiddenMessage,
  InlineMenuCipherDataContact,
} from "./abstractions/overlay.background";

/* start Cozy imports */
/* eslint-disable */
import { Q, models } from "cozy-client";
import type { IOCozyContact, IOCozyFile } from "cozy-client/types/types";
// @ts-ignore
import { nameToColor } from "cozy-ui/transpiled/react/Avatar/helpers";
import { CozyClientService } from "../../popup/services/cozyClient.service";
import type { AmbiguousContactFieldName, AvailablePapers } from "src/autofill/types";
import {
  COZY_ATTRIBUTES_MAPPING,
  isPaperAttributesModel,
  isHealthPaper,
} from "../../../../../libs/cozy/mapping";
import { createOrUpdateCozyDoctype } from "../../../../../libs/cozy/createOrUpdateCozyDoctype";
import { getCozyValue, getAllPapersFromContact } from "../../../../../libs/cozy/getCozyValue";
import _ from "lodash";
import {
  buildAddressObjectFromInputValues,
  cleanFormattedAddress,
} from "../../../../../libs/cozy/contact.helper";
import NotificationBackground from "./notification.background";
import { CONTACTS_DOCTYPE, FILES_DOCTYPE } from "../../../../../libs/cozy/constants";

const {
  document: { locales },
} = models;
/* eslint-enable */
/* end Cozy imports */

export class OverlayBackground implements OverlayBackgroundInterface {
  private readonly openUnlockPopout = openUnlockPopout;
  private readonly openViewVaultItemPopout = openViewVaultItemPopout;
  private readonly openAddEditVaultItemPopout = openAddEditVaultItemPopout;
  private readonly storeInlineMenuFido2CredentialsSubject = new ReplaySubject<number>(1);
  // Cozy customization
  private lastFilledContactCipherId: string;
  // Cozy customization end
  private pageDetailsForTab: PageDetailsForTab = {};
  private subFrameOffsetsForTab: SubFrameOffsetsForTab = {};
  private portKeyForTab: Record<number, string> = {};
  private expiredPorts: chrome.runtime.Port[] = [];
  private inlineMenuButtonPort: chrome.runtime.Port;
  private inlineMenuListPort: chrome.runtime.Port;
  private inlineMenuCiphers: Map<string, CipherView> = new Map();
  private inlineMenuFido2Credentials: Set<string> = new Set();
  private inlineMenuPageTranslations: Record<string, string>;
  private inlineMenuPosition: InlineMenuPosition = {};
  private cardAndIdentityCiphers: Set<CipherView> | null = null;
  private currentInlineMenuCiphersCount: number = 0;
  private delayedCloseTimeout: number | NodeJS.Timeout;
  private startInlineMenuFadeInSubject = new Subject<void>();
  private cancelInlineMenuFadeInSubject = new Subject<boolean>();
  private startUpdateInlineMenuPositionSubject = new Subject<chrome.runtime.MessageSender>();
  private cancelUpdateInlineMenuPositionSubject = new Subject<void>();
  private repositionInlineMenuSubject = new Subject<chrome.runtime.MessageSender>();
  private rebuildSubFrameOffsetsSubject = new Subject<chrome.runtime.MessageSender>();
  private addNewVaultItemSubject = new Subject<CurrentAddNewItemData>();
  private currentAddNewItemData: CurrentAddNewItemData;
  private focusedFieldData: FocusedFieldData;
  private isFieldCurrentlyFocused: boolean = false;
  private isFieldCurrentlyFilling: boolean = false;
  private isInlineMenuButtonVisible: boolean = false;
  private isInlineMenuListVisible: boolean = false;
  private showPasskeysLabelsWithinInlineMenu: boolean = false;
  private iconsServerUrl: string;
  private readonly extensionMessageHandlers: OverlayBackgroundExtensionMessageHandlers = {
    autofillOverlayElementClosed: ({ message, sender }) =>
      this.overlayElementClosed(message, sender),
    autofillOverlayAddNewVaultItem: ({ message, sender }) => this.addNewVaultItem(message, sender),
    triggerAutofillOverlayReposition: ({ sender }) => this.triggerOverlayReposition(sender),
    checkIsInlineMenuCiphersPopulated: ({ sender }) =>
      this.checkIsInlineMenuCiphersPopulated(sender),
    updateFocusedFieldData: ({ message, sender }) => this.setFocusedFieldData(message, sender),
    updateIsFieldCurrentlyFocused: ({ message, sender }) =>
      this.updateIsFieldCurrentlyFocused(message, sender),
    checkIsFieldCurrentlyFocused: () => this.checkIsFieldCurrentlyFocused(),
    updateIsFieldCurrentlyFilling: ({ message }) => this.updateIsFieldCurrentlyFilling(message),
    checkIsFieldCurrentlyFilling: () => this.checkIsFieldCurrentlyFilling(),
    getAutofillInlineMenuVisibility: () => this.getInlineMenuVisibility(),
    openAutofillInlineMenu: () => this.openInlineMenu(false),
    closeAutofillInlineMenu: ({ message, sender }) => this.closeInlineMenu(sender, message),
    checkAutofillInlineMenuFocused: ({ sender }) => this.checkInlineMenuFocused(sender),
    focusAutofillInlineMenuList: () => this.focusInlineMenuList(),
    updateAutofillInlineMenuPosition: ({ message, sender }) =>
      this.updateInlineMenuPosition(message, sender),
    getAutofillInlineMenuPosition: () => this.getInlineMenuPosition(),
    updateAutofillInlineMenuElementIsVisibleStatus: ({ message, sender }) =>
      this.updateInlineMenuElementIsVisibleStatus(message, sender),
    checkIsAutofillInlineMenuButtonVisible: () => this.checkIsInlineMenuButtonVisible(),
    checkIsAutofillInlineMenuListVisible: () => this.checkIsInlineMenuListVisible(),
    getCurrentTabFrameId: ({ sender }) => this.getSenderFrameId(sender),
    updateSubFrameData: ({ message, sender }) => this.updateSubFrameData(message, sender),
    triggerSubFrameFocusInRebuild: ({ sender }) => this.triggerSubFrameFocusInRebuild(sender),
    destroyAutofillInlineMenuListeners: ({ message, sender }) =>
      this.triggerDestroyInlineMenuListeners(sender.tab, message.subFrameData.frameId),
    collectPageDetailsResponse: ({ message, sender }) => this.storePageDetails(message, sender),
    unlockCompleted: ({ message }) => this.unlockCompleted(message),
    doFullSync: () => this.updateOverlayCiphers(),
    addedCipher: () => this.updateOverlayCiphers(),
    addEditCipherSubmitted: () => this.updateOverlayCiphers(),
    editedCipher: () => this.updateOverlayCiphers(),
    deletedCipher: () => this.updateOverlayCiphers(),
    fido2AbortRequest: ({ sender }) => this.abortFido2ActiveRequest(sender),
  };
  private readonly inlineMenuButtonPortMessageHandlers: InlineMenuButtonPortMessageHandlers = {
    triggerDelayedAutofillInlineMenuClosure: () => this.triggerDelayedInlineMenuClosure(),
    autofillInlineMenuButtonClicked: ({ port }) => this.handleInlineMenuButtonClicked(port),
    autofillInlineMenuBlurred: () => this.checkInlineMenuListFocused(),
    redirectAutofillInlineMenuFocusOut: ({ message, port }) =>
      this.redirectInlineMenuFocusOut(message, port),
    updateAutofillInlineMenuColorScheme: () => this.updateInlineMenuButtonColorScheme(),
  };
  private readonly inlineMenuListPortMessageHandlers: InlineMenuListPortMessageHandlers = {
    checkAutofillInlineMenuButtonFocused: () => this.checkInlineMenuButtonFocused(),
    autofillInlineMenuBlurred: () => this.checkInlineMenuButtonFocused(),
    unlockVault: ({ port }) => this.unlockVault(port),
    fillAutofillInlineMenuCipher: ({ message, port }) => this.fillInlineMenuCipher(message, port),
    // Cozy customization
    handleContactClick: ({ message, port }) => this.handleContactClick(message, port),
    saveFieldToCozyDoctype: ({ message, port }) => this.saveFieldToCozyDoctype(message, port),
    fillAutofillInlineMenuCipherWithAmbiguousField: ({ message, port }) =>
      this.fillAutofillInlineMenuCipherWithAmbiguousField(message, port),
    fillAutofillInlineMenuCipherWithCozyData: ({ message, port }) =>
      this.fillAutofillInlineMenuCipherWithCozyData(message, port),
    inlineMenuSearchContact: ({ message }) => this.searchContacts(message),
    redirectToCozy: ({ message }) => this.redirectToCozy(message),
    // Cozy customization end
    addNewVaultItem: ({ message, port }) => this.getNewVaultItemDetails(message, port),
    viewSelectedCipher: ({ message, port }) => this.viewSelectedCipher(message, port),
    redirectAutofillInlineMenuFocusOut: ({ message, port }) =>
      this.redirectInlineMenuFocusOut(message, port),
    updateAutofillInlineMenuListHeight: ({ message }) => this.updateInlineMenuListHeight(message),
  };

  constructor(
    private logService: LogService,
    private cipherService: CipherService,
    private autofillService: AutofillService,
    private authService: AuthService,
    private environmentService: EnvironmentService,
    private domainSettingsService: DomainSettingsService,
    private autofillSettingsService: AutofillSettingsServiceAbstraction,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private vaultSettingsService: VaultSettingsService,
    private fido2ActiveRequestManager: Fido2ActiveRequestManager,
    private themeStateService: ThemeStateService,
    private cozyClientService: CozyClientService,
    private notificationBackground: NotificationBackground,
  ) {
    this.initOverlayEventObservables();
  }

  private redirectToCozy = (message: OverlayPortMessage) => {
    // Interpolate "<id>" in the hash by the id correspond to the inline menu cipher id
    // Useful to open alice.contacts.mycozy.cloud/#/127950390436f45accdf242cac55a2e4/edit for example
    if (message.inlineMenuCipherId) {
      const cipher = this.inlineMenuCiphers.get(message.inlineMenuCipherId);
      message.hash = message.hash.replace("<id>", cipher.id);
    }

    BrowserApi.createNewTab(this.cozyClientService.getAppURL(message.to, message.hash), true);
  };

  private searchContacts = (message: OverlayPortMessage) => {
    this.updateOverlayCiphers(undefined, message.searchValue);
  };

  /**
   * Sets up the extension message listeners and gets the settings for the
   * overlay's visibility and the user's authentication status.
   */
  async init() {
    this.setupExtensionListeners();
    const env = await firstValueFrom(this.environmentService.environment$);
    this.iconsServerUrl = env.getIconsUrl();
  }

  /**
   * Initializes event observables that handle events which affect the overlay's behavior.
   */
  private initOverlayEventObservables() {
    this.storeInlineMenuFido2CredentialsSubject
      .pipe(switchMap((tabId) => this.availablePasskeyAuthCredentials$(tabId)))
      .subscribe((credentials) => this.storeInlineMenuFido2Credentials(credentials));
    this.repositionInlineMenuSubject
      .pipe(
        debounceTime(1000),
        switchMap((sender) => this.repositionInlineMenu(sender)),
      )
      .subscribe();
    this.rebuildSubFrameOffsetsSubject
      .pipe(
        throttleTime(100),
        switchMap((sender) => this.rebuildSubFrameOffsets(sender)),
      )
      .subscribe();
    this.addNewVaultItemSubject
      .pipe(
        debounceTime(100),
        switchMap((addNewItemData) =>
          this.buildCipherAndOpenAddEditVaultItemPopout(addNewItemData),
        ),
      )
      .subscribe();

    // Debounce used to update inline menu position
    merge(
      this.startUpdateInlineMenuPositionSubject.pipe(debounceTime(150)),
      this.cancelUpdateInlineMenuPositionSubject,
    )
      .pipe(switchMap((sender) => this.updateInlineMenuPositionAfterRepositionEvent(sender)))
      .subscribe();

    // FadeIn Observable behavior
    merge(
      this.startInlineMenuFadeInSubject.pipe(debounceTime(150)),
      this.cancelInlineMenuFadeInSubject,
    )
      .pipe(switchMap((cancelSignal) => this.triggerInlineMenuFadeIn(!!cancelSignal)))
      .subscribe();
  }

  /**
   * Removes cached page details for a tab
   * based on the passed tabId.
   *
   * @param tabId - Used to reference the page details of a specific tab
   */
  removePageDetails(tabId: number) {
    if (this.pageDetailsForTab[tabId]) {
      this.pageDetailsForTab[tabId].clear();
      delete this.pageDetailsForTab[tabId];
    }

    if (this.portKeyForTab[tabId]) {
      delete this.portKeyForTab[tabId];
    }
  }

  /**
   * Updates the inline menu list's ciphers and sends the updated list to the inline menu list iframe.
   * Queries all ciphers for the given url, and sorts them by last used. Will not update the
   * list of ciphers if the extension is not unlocked.
   */
  async updateOverlayCiphers(updateAllCipherTypes = true, searchValue?: string) {
    const authStatus = await firstValueFrom(this.authService.activeAccountStatus$);
    if (authStatus !== AuthenticationStatus.Unlocked) {
      if (this.focusedFieldData) {
        this.closeInlineMenuAfterCiphersUpdate().catch((error) => this.logService.error(error));
      }
      return;
    }

    const currentTab = await BrowserApi.getTabFromCurrentWindowId();
    if (this.focusedFieldData && currentTab?.id !== this.focusedFieldData.tabId) {
      this.closeInlineMenuAfterCiphersUpdate().catch((error) => this.logService.error(error));
    }

    if (!currentTab || !currentTab.url?.startsWith("http")) {
      if (updateAllCipherTypes) {
        this.cardAndIdentityCiphers = null;
      }
      return;
    }

    const request = this.fido2ActiveRequestManager.getActiveRequest(currentTab.id);
    if (request) {
      request.subject.next({ type: Fido2ActiveRequestEvents.Refresh });
    }

    this.inlineMenuFido2Credentials.clear();
    this.storeInlineMenuFido2CredentialsSubject.next(currentTab.id);

    this.inlineMenuCiphers = new Map();
    const ciphersViews = await this.getCipherViews(currentTab, updateAllCipherTypes);
    for (let cipherIndex = 0; cipherIndex < ciphersViews.length; cipherIndex++) {
      this.inlineMenuCiphers.set(`inline-menu-cipher-${cipherIndex}`, ciphersViews[cipherIndex]);
    }

    const ciphers = await this.getInlineMenuCipherData();
    this.inlineMenuListPort?.postMessage({
      command: "updateAutofillInlineMenuListCiphers",
      ciphers,
      showInlineMenuAccountCreation: this.showInlineMenuAccountCreation(),
      showPasskeysLabels: this.showPasskeysLabelsWithinInlineMenu,
      searchValue,
    });
  }

  /**
   * Gets the decrypted ciphers within a user's vault based on the current tab's URL.
   *
   * @param currentTab - The current tab
   * @param updateAllCipherTypes - Identifies credit card and identity cipher types should also be updated
   */
  private async getCipherViews(
    currentTab: chrome.tabs.Tab,
    updateAllCipherTypes: boolean,
  ): Promise<CipherView[]> {
    if (updateAllCipherTypes || !this.cardAndIdentityCiphers) {
      return this.getAllCipherTypeViews(currentTab);
    }

    // Cozy customization; This sorting changes the cipher IDs and raises a problem for the ambiguous contact fields functionality, which needs immutable IDs.
    const cipherViews = await this.cipherService.getAllDecryptedForUrl(currentTab?.url || ""); //.sort((a, b) => this.cipherService.sortCiphersByLastUsedThenName(a, b));
    // Cozy customization end

    // Cozy customization; Add contacts first in the list for fixes a bug when opening the iniline menu on an ambiguous field before the first autofill
    return this.cardAndIdentityCiphers.size > 0
      ? _.sortBy(
          Array.from(this.cardAndIdentityCiphers),
          (c) => c.type !== CipherType.Contact,
        ).concat(...cipherViews)
      : cipherViews;
    // Cozy customization end
  }

  /**
   * Queries all cipher types from the user's vault returns them sorted by last used.
   *
   * @param currentTab - The current tab
   */
  private async getAllCipherTypeViews(currentTab: chrome.tabs.Tab): Promise<CipherView[]> {
    if (!this.cardAndIdentityCiphers) {
      this.cardAndIdentityCiphers = new Set([]);
    }

    this.cardAndIdentityCiphers.clear();

    // Cozy customization; This sorting changes the cipher IDs and raises a problem for the ambiguous contact fields functionality, which needs immutable IDs.
    const cipherViews = await this.cipherService.getAllDecryptedForUrl(currentTab.url, [
      CipherType.Card,
      CipherType.Identity,
      CipherType.Contact, // Cozy customization; add contact to autofill
    ]); //.sort((a, b) => this.cipherService.sortCiphersByLastUsedThenName(a, b));
    // Cozy customization end
    for (let cipherIndex = 0; cipherIndex < cipherViews.length; cipherIndex++) {
      const cipherView = cipherViews[cipherIndex];
      if (
        !this.cardAndIdentityCiphers.has(cipherView) &&
        [CipherType.Card, CipherType.Identity, CipherType.Contact].includes(cipherView.type) // Cozy customization; add contact to autofill
      ) {
        this.cardAndIdentityCiphers.add(cipherView);
      }
    }

    if (!this.cardAndIdentityCiphers.size) {
      this.cardAndIdentityCiphers = null;
    }

    return _.sortBy(cipherViews, (c) => c.type !== CipherType.Contact); // Cozy customization; add contact to autofill (sort contacts first in the list for fixes a bug when opening the iniline menu on an ambiguous field after the first autofill)
  }

  /**
   * Strips out unnecessary data from the ciphers and returns an array of
   * objects that contain the cipher data needed for the inline menu list.
   */
  private async getInlineMenuCipherData(): Promise<InlineMenuCipherData[]> {
    const showFavicons = await firstValueFrom(this.domainSettingsService.showFavicons$);
    const inlineMenuCiphersArray = Array.from(this.inlineMenuCiphers);
    let inlineMenuCipherData: InlineMenuCipherData[];

    if (this.showInlineMenuAccountCreation()) {
      inlineMenuCipherData = this.buildInlineMenuAccountCreationCiphers(
        inlineMenuCiphersArray,
        true,
      );
    } else {
      inlineMenuCipherData = await this.buildInlineMenuCiphers(
        inlineMenuCiphersArray,
        showFavicons,
      );
    }

    this.currentInlineMenuCiphersCount = inlineMenuCipherData.length;
    return inlineMenuCipherData;
  }

  /**
   * Builds the inline menu ciphers for a form field that is meant for account creation.
   *
   * @param inlineMenuCiphersArray - Array of inline menu ciphers
   * @param showFavicons - Identifies whether favicons should be shown
   */
  private buildInlineMenuAccountCreationCiphers(
    inlineMenuCiphersArray: [string, CipherView][],
    showFavicons: boolean,
  ) {
    const inlineMenuCipherData: InlineMenuCipherData[] = [];
    const accountCreationLoginCiphers: InlineMenuCipherData[] = [];

    for (let cipherIndex = 0; cipherIndex < inlineMenuCiphersArray.length; cipherIndex++) {
      const [inlineMenuCipherId, cipher] = inlineMenuCiphersArray[cipherIndex];

      if (cipher.type === CipherType.Login) {
        accountCreationLoginCiphers.push(
          this.buildCipherData({
            inlineMenuCipherId,
            cipher,
            showFavicons,
            showInlineMenuAccountCreation: true,
          }),
        );
        continue;
      }

      if (cipher.type !== CipherType.Identity || !this.focusedFieldData?.accountCreationFieldType) {
        continue;
      }

      const identity = this.getIdentityCipherData(cipher, true);
      if (!identity?.username) {
        continue;
      }

      inlineMenuCipherData.push(
        this.buildCipherData({
          inlineMenuCipherId,
          cipher,
          showFavicons,
          showInlineMenuAccountCreation: true,
          identityData: identity,
        }),
      );
    }

    if (accountCreationLoginCiphers.length) {
      return inlineMenuCipherData.concat(accountCreationLoginCiphers);
    }

    return inlineMenuCipherData;
  }

  /**
   * Builds the inline menu ciphers for a form field that is not meant for account creation.
   *
   * @param inlineMenuCiphersArray - Array of inline menu ciphers
   * @param showFavicons - Identifies whether favicons should be shown
   */
  private async buildInlineMenuCiphers(
    inlineMenuCiphersArray: [string, CipherView][],
    showFavicons: boolean,
  ) {
    const inlineMenuCipherData: InlineMenuCipherData[] = [];
    const passkeyCipherData: InlineMenuCipherData[] = [];
    const domainExclusions = await this.getExcludedDomains();
    let domainExclusionsSet: Set<string> | null = null;
    if (domainExclusions) {
      domainExclusionsSet = new Set(Object.keys(await this.getExcludedDomains()));
    }
    const passkeysEnabled = await firstValueFrom(this.vaultSettingsService.enablePasskeys$);

    for (let cipherIndex = 0; cipherIndex < inlineMenuCiphersArray.length; cipherIndex++) {
      const [inlineMenuCipherId, cipher] = inlineMenuCiphersArray[cipherIndex];
      if (this.focusedFieldData?.filledByCipherType !== cipher.type) {
        continue;
      }

      if (!passkeysEnabled || !(await this.showCipherAsPasskey(cipher, domainExclusionsSet))) {
        inlineMenuCipherData.push(
          this.buildCipherData({ inlineMenuCipherId, cipher, showFavicons }),
        );
        continue;
      }

      passkeyCipherData.push(
        this.buildCipherData({
          inlineMenuCipherId,
          cipher,
          showFavicons,
          hasPasskey: true,
        }),
      );

      if (cipher.login?.password && cipher.login.username) {
        inlineMenuCipherData.push(
          this.buildCipherData({ inlineMenuCipherId, cipher, showFavicons }),
        );
      }
    }

    if (passkeyCipherData.length) {
      this.showPasskeysLabelsWithinInlineMenu =
        passkeyCipherData.length > 0 && inlineMenuCipherData.length > 0;
      return passkeyCipherData.concat(inlineMenuCipherData);
    }

    return inlineMenuCipherData;
  }

  /**
   * Identifies whether we should show the cipher as a passkey in the inline menu list.
   *
   * @param cipher - The cipher to check
   * @param domainExclusions - The domain exclusions to check against
   */
  private async showCipherAsPasskey(
    cipher: CipherView,
    domainExclusions: Set<string> | null,
  ): Promise<boolean> {
    if (cipher.type !== CipherType.Login || !this.focusedFieldData?.showPasskeys) {
      return false;
    }

    const fido2Credentials = cipher.login.fido2Credentials;
    if (!fido2Credentials?.length) {
      return false;
    }

    const credentialId = fido2Credentials[0].credentialId;
    const rpId = fido2Credentials[0].rpId;
    const parsedRpId = parse(rpId, { allowPrivateDomains: true });
    if (domainExclusions?.has(parsedRpId.domain)) {
      return false;
    }

    return this.inlineMenuFido2Credentials.has(credentialId);
  }

  /**
   * Builds the cipher data for the inline menu list.
   *
   * @param inlineMenuCipherId - The ID of the inline menu cipher
   * @param cipher - The cipher to build data for
   * @param showFavicons - Identifies whether favicons should be shown
   * @param showInlineMenuAccountCreation - Identifies whether the inline menu is for account creation
   * @param hasPasskey - Identifies whether the cipher has a FIDO2 credential
   * @param identityData - Pre-created identity data
   */
  private buildCipherData({
    inlineMenuCipherId,
    cipher,
    showFavicons,
    showInlineMenuAccountCreation,
    hasPasskey,
    identityData,
  }: BuildCipherDataParams): InlineMenuCipherData {
    const inlineMenuData: InlineMenuCipherData = {
      id: inlineMenuCipherId,
      name: cipher.name,
      type: cipher.type,
      reprompt: cipher.reprompt,
      favorite: cipher.favorite,
      icon: buildCipherIcon(this.iconsServerUrl, cipher, showFavicons),
      accountCreationFieldType: this.focusedFieldData?.accountCreationFieldType,
    };

    if (cipher.type === CipherType.Login) {
      inlineMenuData.login = {
        username: cipher.login.username,
        passkey: hasPasskey
          ? {
              rpName: cipher.login.fido2Credentials[0].rpName,
              userName: cipher.login.fido2Credentials[0].userName,
            }
          : null,
      };
      return inlineMenuData;
    }
    if (cipher.type === CipherType.Card) {
      inlineMenuData.card = cipher.card.subTitle;
      return inlineMenuData;
    }

    // Cozy customization; add contact to autofill
    if (cipher.type === CipherType.Contact) {
      inlineMenuData.contact = this.getContactCipherData(cipher, showInlineMenuAccountCreation);
      return inlineMenuData;
    }
    // Cozy customization end

    inlineMenuData.identity =
      identityData || this.getIdentityCipherData(cipher, showInlineMenuAccountCreation);
    return inlineMenuData;
  }

  /**
   * Gets the identity data for a cipher based on whether the inline menu is for account creation.
   *
   * @param cipher - The cipher to get the identity data for
   * @param showInlineMenuAccountCreation - Identifies whether the inline menu is for account creation
   */
  private getIdentityCipherData(
    cipher: CipherView,
    showInlineMenuAccountCreation: boolean = false,
  ): { fullName: string; username?: string } {
    const { firstName, lastName } = cipher.identity;

    let fullName = "";
    if (firstName) {
      fullName += firstName;
    }

    if (lastName) {
      fullName += ` ${lastName}`;
      fullName = fullName.trim();
    }

    if (
      !showInlineMenuAccountCreation ||
      !this.focusedFieldData?.accountCreationFieldType ||
      this.focusedFieldData.accountCreationFieldType === "password"
    ) {
      return { fullName };
    }

    return {
      fullName,
      username:
        this.focusedFieldData.accountCreationFieldType === "email"
          ? cipher.identity.email
          : cipher.identity.username,
    };
  }

  // Cozy customization; add contact to autofill
  private getContactCipherData(
    cipher: CipherView,
    showLoginAccountCreation: boolean,
  ): InlineMenuCipherDataContact {
    const me = Boolean(cipher.contact.me);
    const fullName = cipher.contact.displayName;
    const initials = cipher.contact.initials;
    const initialsColor = nameToColor(initials);

    if (
      !showLoginAccountCreation ||
      !this.focusedFieldData?.accountCreationFieldType ||
      this.focusedFieldData.accountCreationFieldType === "password"
    ) {
      return { fullName, me, initials, initialsColor };
    }

    return {
      fullName,
      me,
      initials,
      initialsColor,
      username: cipher.contact.primaryEmail,
    };
  }
  // Cozy customization end

  /**
   * Identifies whether the inline menu is being shown on an account creation field.
   */
  private showInlineMenuAccountCreation(): boolean {
    if (typeof this.focusedFieldData?.showInlineMenuAccountCreation !== "undefined") {
      return this.focusedFieldData?.showInlineMenuAccountCreation;
    }

    if (this.focusedFieldData?.filledByCipherType !== CipherType.Login) {
      return false;
    }

    if (this.cardAndIdentityCiphers) {
      return this.inlineMenuCiphers.size === this.cardAndIdentityCiphers.size;
    }

    return this.inlineMenuCiphers.size === 0;
  }

  /**
   * Stores the credential ids associated with a FIDO2 conditional mediated ui request.
   *
   * @param credentials - The FIDO2 credentials to store
   */
  private storeInlineMenuFido2Credentials(credentials: Fido2CredentialView[]) {
    this.inlineMenuFido2Credentials.clear();

    credentials.forEach(
      (credential) =>
        credential?.credentialId && this.inlineMenuFido2Credentials.add(credential.credentialId),
    );
  }

  /**
   * Gets the passkey credentials available from an active FIDO2 request for a given tab.
   *
   * @param tabId - The tab id to get the active request for.
   */
  private availablePasskeyAuthCredentials$(tabId: number): Observable<Fido2CredentialView[]> {
    return this.fido2ActiveRequestManager
      .getActiveRequest$(tabId)
      .pipe(map((request) => request?.credentials ?? []));
  }

  /**
   * Aborts an active FIDO2 request for a given tab and updates the inline menu ciphers.
   *
   * @param sender - The sender of the message
   */
  private async abortFido2ActiveRequest(sender: chrome.runtime.MessageSender) {
    this.fido2ActiveRequestManager.removeActiveRequest(sender.tab.id);
    await this.updateOverlayCiphers(false);
  }

  /**
   * Gets the neverDomains setting from the domain settings service.
   */
  async getExcludedDomains(): Promise<NeverDomains> {
    return await firstValueFrom(this.domainSettingsService.neverDomains$);
  }

  /**
   * Gets the currently focused field and closes the inline menu on that tab.
   */
  private async closeInlineMenuAfterCiphersUpdate() {
    const focusedFieldTab = await BrowserApi.getTab(this.focusedFieldData.tabId);
    this.closeInlineMenu({ tab: focusedFieldTab }, { forceCloseInlineMenu: true });
  }

  /**
   * Handles aggregation of page details for a tab. Stores the page details
   * in association with the tabId of the tab that sent the message.
   *
   * @param message - Message received from the `collectPageDetailsResponse` command
   * @param sender - The sender of the message
   */
  private storePageDetails(
    message: OverlayBackgroundExtensionMessage,
    sender: chrome.runtime.MessageSender,
  ) {
    const pageDetails = {
      frameId: sender.frameId,
      tab: sender.tab,
      details: message.details,
    };

    if (pageDetails.frameId !== 0 && pageDetails.details.fields.length) {
      this.buildSubFrameOffsets(
        pageDetails.tab,
        pageDetails.frameId,
        pageDetails.details.url,
      ).catch((error) => this.logService.error(error));
      BrowserApi.tabSendMessage(pageDetails.tab, {
        command: "setupRebuildSubFrameOffsetsListeners",
      }).catch((error) => this.logService.error(error));
    }

    const pageDetailsMap = this.pageDetailsForTab[sender.tab.id];
    if (!pageDetailsMap) {
      this.pageDetailsForTab[sender.tab.id] = new Map([[sender.frameId, pageDetails]]);
      return;
    }

    pageDetailsMap.set(sender.frameId, pageDetails);
  }

  /**
   * Returns the frameId, called when calculating sub frame offsets within the tab.
   * Is used to determine if we should reposition the inline menu when a resize event
   * occurs within a frame.
   *
   * @param sender - The sender of the message
   */
  private getSenderFrameId(sender: chrome.runtime.MessageSender) {
    return sender.frameId;
  }

  /**
   * Handles sub frame offset calculations for the given tab and frame id.
   * Is used in setting the position of the inline menu list and button.
   *
   * @param message - The message received from the `updateSubFrameData` command
   * @param sender - The sender of the message
   */
  private updateSubFrameData(
    message: OverlayBackgroundExtensionMessage,
    sender: chrome.runtime.MessageSender,
  ) {
    const subFrameOffsetsForTab = this.subFrameOffsetsForTab[sender.tab.id];
    if (subFrameOffsetsForTab) {
      subFrameOffsetsForTab.set(message.subFrameData.frameId, message.subFrameData);
    }
  }

  /**
   * Builds the offset data for a sub frame of a tab. The offset data is used
   * to calculate the position of the inline menu list and button.
   *
   * @param tab - The tab that the sub frame is associated with
   * @param frameId - The frame ID of the sub frame
   * @param url - The URL of the sub frame
   * @param forceRebuild - Identifies whether the sub frame offsets should be rebuilt
   */
  private async buildSubFrameOffsets(
    tab: chrome.tabs.Tab,
    frameId: number,
    url: string,
    forceRebuild: boolean = false,
  ) {
    let subFrameDepth = 0;
    const tabId = tab.id;
    let subFrameOffsetsForTab = this.subFrameOffsetsForTab[tabId];
    if (!subFrameOffsetsForTab) {
      this.subFrameOffsetsForTab[tabId] = new Map();
      subFrameOffsetsForTab = this.subFrameOffsetsForTab[tabId];
    }

    if (!forceRebuild && subFrameOffsetsForTab.get(frameId)) {
      return;
    }

    const subFrameData: SubFrameOffsetData = { url, top: 0, left: 0, parentFrameIds: [0] };
    let frameDetails = await BrowserApi.getFrameDetails({ tabId, frameId });

    while (frameDetails && frameDetails.parentFrameId > -1) {
      subFrameDepth++;
      if (subFrameDepth >= MAX_SUB_FRAME_DEPTH) {
        subFrameOffsetsForTab.set(frameId, null);
        this.triggerDestroyInlineMenuListeners(tab, frameId);
        return;
      }

      const subFrameOffset: SubFrameOffsetData = await BrowserApi.tabSendMessage(
        tab,
        {
          command: "getSubFrameOffsets",
          subFrameUrl: frameDetails.url,
          subFrameId: frameDetails.documentId,
        },
        { frameId: frameDetails.parentFrameId },
      );

      if (!subFrameOffset) {
        subFrameOffsetsForTab.set(frameId, null);
        BrowserApi.tabSendMessage(
          tab,
          { command: "getSubFrameOffsetsFromWindowMessage", subFrameId: frameId },
          { frameId },
        ).catch((error) => this.logService.error(error));
        return;
      }

      subFrameData.top += subFrameOffset.top;
      subFrameData.left += subFrameOffset.left;
      if (!subFrameData.parentFrameIds.includes(frameDetails.parentFrameId)) {
        subFrameData.parentFrameIds.push(frameDetails.parentFrameId);
      }

      frameDetails = await BrowserApi.getFrameDetails({
        tabId,
        frameId: frameDetails.parentFrameId,
      });
    }

    subFrameOffsetsForTab.set(frameId, subFrameData);
  }

  /**
   * Triggers a removal and destruction of all
   *
   * @param tab - The tab that the sub frame is associated with
   * @param frameId - The frame ID of the sub frame
   */
  private triggerDestroyInlineMenuListeners(tab: chrome.tabs.Tab, frameId: number) {
    this.logService.error(
      "Excessive frame depth encountered, destroying inline menu on field within frame",
      tab,
      frameId,
    );

    BrowserApi.tabSendMessage(
      tab,
      { command: "destroyAutofillInlineMenuListeners" },
      { frameId },
    ).catch((error) => this.logService.error(error));
  }

  /**
   * Rebuilds the sub frame offsets for the tab associated with the sender.
   *
   * @param sender - The sender of the message
   */
  private async rebuildSubFrameOffsets(sender: chrome.runtime.MessageSender) {
    this.cancelUpdateInlineMenuPositionSubject.next();
    this.clearDelayedInlineMenuClosure();

    const subFrameOffsetsForTab = this.subFrameOffsetsForTab[sender.tab.id];
    if (subFrameOffsetsForTab) {
      const tabFrameIds = Array.from(subFrameOffsetsForTab.keys());
      for (const frameId of tabFrameIds) {
        await this.buildSubFrameOffsets(sender.tab, frameId, sender.url, true);
      }
    }
  }

  /**
   * Handles updating the inline menu's position after rebuilding the sub frames
   * for the provided tab. Will skip repositioning the inline menu if the field
   * is not currently focused, or if the focused field has a value.
   *
   * @param sender - The sender of the message
   */
  private async updateInlineMenuPositionAfterRepositionEvent(
    sender: chrome.runtime.MessageSender | void,
  ) {
    if (!sender || !this.isFieldCurrentlyFocused) {
      return;
    }

    if (!this.checkIsInlineMenuButtonVisible()) {
      this.toggleInlineMenuHidden(
        { isInlineMenuHidden: false, setTransparentInlineMenu: true },
        sender,
      ).catch((error) => this.logService.error(error));
    }

    this.updateInlineMenuPosition({ overlayElement: AutofillOverlayElement.Button }, sender).catch(
      (error) => this.logService.error(error),
    );

    const mostRecentlyFocusedFieldHasValue = await BrowserApi.tabSendMessage(
      sender.tab,
      { command: "checkMostRecentlyFocusedFieldHasValue" },
      { frameId: this.focusedFieldData?.frameId },
    );

    if ((await this.getInlineMenuVisibility()) === AutofillOverlayVisibility.OnButtonClick) {
      return;
    }

    if (
      mostRecentlyFocusedFieldHasValue &&
      (this.checkIsInlineMenuCiphersPopulated(sender) ||
        (await this.getAuthStatus()) !== AuthenticationStatus.Unlocked)
    ) {
      return;
    }

    this.updateInlineMenuPosition({ overlayElement: AutofillOverlayElement.List }, sender).catch(
      (error) => this.logService.error(error),
    );
  }

  /**
   * Triggers autofill for the selected cipher in the inline menu list. Also places
   * the selected cipher at the top of the list of ciphers.
   *
   * @param inlineMenuCipherId - Cipher ID corresponding to the inlineMenuCiphers map. Does not correspond to the actual cipher's ID.
   * @param usePasskey - Identifies whether the cipher has a FIDO2 credential
   * @param sender - The sender of the port message
   */
  private async fillInlineMenuCipher(
    { inlineMenuCipherId, usePasskey }: OverlayPortMessage,
    { sender }: chrome.runtime.Port,
    cozyAutofillOptions: CozyAutofillOptions = {},
  ) {
    const pageDetails = this.pageDetailsForTab[sender.tab.id];
    if (!inlineMenuCipherId || !pageDetails?.size) {
      return;
    }

    const cipher = this.inlineMenuCiphers.get(inlineMenuCipherId);

    if (usePasskey && cipher.login?.hasFido2Credentials) {
      await this.authenticatePasskeyCredential(
        sender.tab.id,
        cipher.login.fido2Credentials[0].credentialId,
      );
      this.updateLastUsedInlineMenuCipher(inlineMenuCipherId, cipher);
      this.closeInlineMenu(sender, { forceCloseInlineMenu: true });

      return;
    }

    if (await this.autofillService.isPasswordRepromptRequired(cipher, sender.tab)) {
      return;
    }
    const totpCode = await this.autofillService.doAutoFill({
      tab: sender.tab,
      cipher: cipher,
      pageDetails: Array.from(pageDetails.values()),
      fillNewPassword: true,
      allowTotpAutofill: true,
      cozyAutofillOptions: {
        ...cozyAutofillOptions,
        // Useful for Contacts CypherType
        focusedFieldData: this.focusedFieldData,
      },
    });

    // Cozy customization - Remembering the last filled cipher ID allows to open a custom UI in the inline menu but it works only for contacts.
    if (cipher.type === CipherType.Contact) {
      this.lastFilledContactCipherId = inlineMenuCipherId;
    }
    // Cozy customization end

    if (totpCode) {
      this.platformUtilsService.copyToClipboard(totpCode);
    }

    this.updateLastUsedInlineMenuCipher(inlineMenuCipherId, cipher);
  }

  /**
   * Triggers a FIDO2 authentication from the inline menu using the passed credential ID.
   *
   * @param tabId - The tab ID to trigger the authentication for
   * @param credentialId - The credential ID to authenticate
   */
  async authenticatePasskeyCredential(tabId: number, credentialId: string) {
    const request = this.fido2ActiveRequestManager.getActiveRequest(tabId);
    if (!request) {
      this.logService.error(
        "Could not complete passkey autofill due to missing active Fido2 request",
      );
      return;
    }

    request.subject.next({ type: Fido2ActiveRequestEvents.Continue, credentialId });
  }

  /**
   * Sets the most recently used cipher at the top of the list of ciphers.
   *
   * @param inlineMenuCipherId - The ID of the inline menu cipher
   * @param cipher - The cipher to set as the most recently used
   */
  private updateLastUsedInlineMenuCipher(inlineMenuCipherId: string, cipher: CipherView) {
    this.inlineMenuCiphers = new Map([[inlineMenuCipherId, cipher], ...this.inlineMenuCiphers]);
  }

  /**
   * Sets the most recently used cipher at the top of the list of ciphers.
   * If the contact doesn't have a Name AND has several ambiguity(tel|email|address), we call `emptyNameList` after selecting the ambiguity.
   *
   * @param inlineMenuCipherId - The ID of the inline menu cipher
   * @param cipher - The cipher to set as the most recently used
   */
  private async fillAutofillInlineMenuCipherWithAmbiguousField(
    message: OverlayPortMessage,
    port: chrome.runtime.Port,
  ) {
    const { cozyAutofillOptions, inlineMenuCipherId } = message;

    const client = await this.cozyClientService.getClientInstance();
    const cipher = this.inlineMenuCiphers.get(inlineMenuCipherId);

    const { data: contact } = (await client.query(Q(CONTACTS_DOCTYPE).getById(cipher.id), {
      executeFromStore: true,
    })) as { data: IOCozyContact };

    const value = await getCozyValue({
      client,
      cipher,
      fieldQualifier: this.focusedFieldData?.fieldQualifier,
    });

    if (!value) {
      this.inlineMenuListPort?.postMessage({
        command: "createEmptyNameList",
        inlineMenuCipherId,
        contactName: contact.displayName,
        fieldHtmlIDToFill: cozyAutofillOptions.fieldHtmlIDToFill,
        focusedFieldName: "name",
      });
      return;
    }

    this.fillInlineMenuCipher(message, port, cozyAutofillOptions);
  }

  private async fillAutofillInlineMenuCipherWithCozyData(
    message: OverlayPortMessage,
    port: chrome.runtime.Port,
  ) {
    const { cozyAutofillOptions } = message;

    this.fillInlineMenuCipher(message, port, cozyAutofillOptions);
  }

  /**
   * @param inlineMenuCipherId - Cipher ID corresponding to the inlineMenuCiphers map. Does not correspond to the actual cipher's ID.
   * @param sender - The sender of the port message
   */
  private async handleContactClick(message: OverlayPortMessage, port: chrome.runtime.Port) {
    const { inlineMenuCipherId, fieldHtmlIDToFill } = message;
    const client = await this.cozyClientService.getClientInstance();
    const cipher = this.inlineMenuCiphers.get(inlineMenuCipherId);

    const { data: contact } = (await client.query(Q(CONTACTS_DOCTYPE).getById(cipher.id), {
      executeFromStore: true,
    })) as { data: IOCozyContact };

    const focusedFieldModel = COZY_ATTRIBUTES_MAPPING[this.focusedFieldData?.fieldQualifier];

    const ambiguousContactFields = getAmbiguousFieldsContact(ambiguousContactFieldNames, contact);

    const isFocusedFieldAmbigous = ambiguousContactFieldNames.includes(
      focusedFieldModel.path as AmbiguousContactFieldName,
    );
    const hasMultipleAmbiguousValueInSameField = Object.values(ambiguousContactFields).some(
      (item) => item.length > 1,
    );

    // On an ambiguous form field, the associated contact values are kept (compare with "path" for "address" fields).
    const ambiguousFormFieldsOfFocusedField = Object.fromEntries(
      Object.entries(ambiguousContactFields).filter(
        ([fieldName]) => fieldName === focusedFieldModel.path,
      ),
    );
    // On an unambiguous form field, we keep only the multiple values of an ambiguous contact field.
    const unambiguousFormFieldsOfFocusedField = Object.fromEntries(
      Object.entries(ambiguousContactFields).filter(
        ([, fieldValue]) => Array.isArray(fieldValue) && fieldValue.length > 1,
      ),
    );
    const hasAtLeastOneFocusFieldValue =
      Object.values(ambiguousFormFieldsOfFocusedField).length > 0;

    /*
      On a form field with data coming from a paper :
      - Display a menu to select or create a paper
      On a form field other than ambiguous(phone/address/email):
      - If the contact has one or less ambiguous value: autofill everything.
      - If the contact has more than one ambiguous values: display a menu to choose which one.
      On the ambiguous(phone/address/email) form field:
      - Display a menu to select value.
    */
    const shouldHideHealthPaper =
      (await this.cozyClientService.getFlagValue("hide.healthTheme.enabled")) &&
      isHealthPaper(this.focusedFieldData?.fieldQualifier);

    if (isPaperAttributesModel(focusedFieldModel) && !shouldHideHealthPaper) {
      const availablePapers: AvailablePapers[] = (
        await getAllPapersFromContact({
          client,
          contactId: contact.id,
          contactEmail: cipher.contact.primaryEmail,
          me: cipher.contact.me,
          cozyAttributeModel: focusedFieldModel,
        })
      ).map((paper: IOCozyFile) => ({
        id: paper._id,
        name: paper.name,
        value: _.get(paper, focusedFieldModel.path),
        qualificationLabel: _.get(paper, "metadata.qualification.label"),
        metadataName: focusedFieldModel.name,
      }));
      this.inlineMenuListPort?.postMessage({
        command: "paperList",
        inlineMenuCipherId,
        contactName: contact.displayName,
        availablePapers,
        fieldHtmlIDToFill,
      });
    } else if (
      (!isFocusedFieldAmbigous && hasMultipleAmbiguousValueInSameField) ||
      (isFocusedFieldAmbigous && hasAtLeastOneFocusFieldValue)
    ) {
      this.inlineMenuListPort?.postMessage({
        command: "ambiguousFieldList",
        inlineMenuCipherId,
        contactName: contact.displayName,
        ambiguousFields: isFocusedFieldAmbigous
          ? ambiguousFormFieldsOfFocusedField
          : unambiguousFormFieldsOfFocusedField,
        isFocusedFieldAmbigous,
        fieldHtmlIDToFill,
      });
    } else {
      // Special case: if we are a paper and there are no ambiguous fields, we arrive here
      // and we do not want to show the empty list
      if (isPaperAttributesModel(focusedFieldModel) && shouldHideHealthPaper) {
        this.fillInlineMenuCipher(message, port);
        return;
      }

      const value = await getCozyValue({
        client,
        cipher,
        fieldQualifier: this.focusedFieldData?.fieldQualifier,
      });

      if (!value) {
        this.inlineMenuListPort?.postMessage({
          command: "createEmptyNameList",
          inlineMenuCipherId,
          contactName: contact.displayName,
          fieldHtmlIDToFill,
          // Compare with "path" for "address" fields
          focusedFieldName: focusedFieldModel.path.split(".")[0],
        });
        return;
      }
      this.fillInlineMenuCipher(message, port);
    }
  }

  private async saveFieldToCozyDoctype(message: OverlayPortMessage, port: chrome.runtime.Port) {
    const { inlineMenuCipherId, fieldQualifier, inputValues, fieldHtmlIDToFill } = message;

    if (inlineMenuCipherId) {
      const client = await this.cozyClientService.getClientInstance();
      const cipher = this.inlineMenuCiphers.get(inlineMenuCipherId);

      const createdOrUpdatedCozyDoctype = await createOrUpdateCozyDoctype({
        client,
        cipher,
        inputValues,
        i18nService: this.i18nService,
        logService: this.logService,
      });

      if (createdOrUpdatedCozyDoctype._type === FILES_DOCTYPE) {
        const locale = this.i18nService.translationLocale || "en";
        const t = locales.getBoundT(locale);

        await this.notificationBackground.paperSaved(port.sender.tab, {
          paperSavedId: createdOrUpdatedCozyDoctype._id,
          paperSavedQualification: createdOrUpdatedCozyDoctype.metadata.qualification.label,
          paperSavedQualificationLabel: t(
            `Scan.items.${createdOrUpdatedCozyDoctype.metadata.qualification.label}`,
          ),
        });
      }

      const isAddress = inputValues.values.some((inputValue) => inputValue.key === "street");
      // If is an address, we need set the value of the field to the formatted address, because getCozyValue refers to `formattedAddress` to return values corresponding to the postal address.
      const value = isAddress
        ? cleanFormattedAddress(buildAddressObjectFromInputValues(inputValues))
        : inputValues.values[0].value;
      this.fillInlineMenuCipher(message, port, {
        value,
        type: inputValues.type,
        label: inputValues.label,
        ...(fieldQualifier
          ? inputValues
          : {
              fillOnlyTheseFieldQualifiers: [
                "identityAddress1",
                "identityCity",
                "identityCountry",
                "identityPostalCode",
                "identityState",
              ],
            }),
        ...(fieldHtmlIDToFill ? { fillOnlyThisFieldHtmlID: fieldHtmlIDToFill } : {}),
      });
    }
  }

  /**
   * Checks if the inline menu is focused. Will check the inline menu list
   * if it is open, otherwise it will check the inline menu button.
   */
  private checkInlineMenuFocused(sender: chrome.runtime.MessageSender) {
    if (!this.senderTabHasFocusedField(sender)) {
      return;
    }

    if (this.inlineMenuListPort) {
      this.checkInlineMenuListFocused();

      return;
    }

    this.checkInlineMenuButtonFocused();
  }

  /**
   * Posts a message to the inline menu button iframe to check if it is focused.
   */
  private checkInlineMenuButtonFocused() {
    this.inlineMenuButtonPort?.postMessage({ command: "checkAutofillInlineMenuButtonFocused" });
  }

  /**
   * Posts a message to the inline menu list iframe to check if it is focused.
   */
  private checkInlineMenuListFocused() {
    this.inlineMenuListPort?.postMessage({ command: "checkAutofillInlineMenuListFocused" });
  }

  /**
   * Sends a message to the sender tab to close the autofill inline menu.
   *
   * @param sender - The sender of the port message
   * @param forceCloseInlineMenu - Identifies whether the inline menu should be forced closed
   * @param overlayElement - The overlay element to close, either the list or button
   */
  private closeInlineMenu(
    sender: chrome.runtime.MessageSender,
    { forceCloseInlineMenu, overlayElement }: CloseInlineMenuMessage = {},
  ) {
    const command = "closeAutofillInlineMenu";
    const sendOptions = { frameId: 0 };
    if (forceCloseInlineMenu) {
      BrowserApi.tabSendMessage(sender.tab, { command, overlayElement }, sendOptions).catch(
        (error) => this.logService.error(error),
      );
      this.isInlineMenuButtonVisible = false;
      this.isInlineMenuListVisible = false;
      return;
    }

    if (this.isFieldCurrentlyFocused) {
      return;
    }

    if (this.isFieldCurrentlyFilling) {
      BrowserApi.tabSendMessage(
        sender.tab,
        { command, overlayElement: AutofillOverlayElement.List },
        sendOptions,
      ).catch((error) => this.logService.error(error));
      this.isInlineMenuListVisible = false;
      return;
    }

    if (overlayElement === AutofillOverlayElement.Button) {
      this.isInlineMenuButtonVisible = false;
    }

    if (overlayElement === AutofillOverlayElement.List) {
      this.isInlineMenuListVisible = false;
    }

    if (!overlayElement) {
      this.isInlineMenuButtonVisible = false;
      this.isInlineMenuListVisible = false;
    }

    BrowserApi.tabSendMessage(sender.tab, { command, overlayElement }, sendOptions).catch((error) =>
      this.logService.error(error),
    );
  }

  /**
   * Sends a message to the sender tab to trigger a delayed closure of the inline menu.
   * This is used to ensure that we capture click events on the inline menu in the case
   * that some on page programmatic method attempts to force focus redirection.
   */
  private triggerDelayedInlineMenuClosure() {
    if (this.isFieldCurrentlyFocused) {
      return;
    }

    this.clearDelayedInlineMenuClosure();
    this.delayedCloseTimeout = globalThis.setTimeout(() => {
      const message = { command: "triggerDelayedAutofillInlineMenuClosure" };
      this.inlineMenuButtonPort?.postMessage(message);
      this.inlineMenuListPort?.postMessage(message);
    }, 100);
  }

  /**
   * Clears the delayed closure timeout for the inline menu, effectively
   * cancelling the event from occurring.
   */
  private clearDelayedInlineMenuClosure() {
    if (this.delayedCloseTimeout) {
      clearTimeout(this.delayedCloseTimeout);
    }
  }

  /**
   * Handles cleanup when an overlay element is closed. Disconnects
   * the list and button ports and sets them to null.
   *
   * @param overlayElement - The overlay element that was closed, either the list or button
   * @param sender - The sender of the port message
   */
  private overlayElementClosed(
    { overlayElement }: OverlayBackgroundExtensionMessage,
    sender: chrome.runtime.MessageSender,
  ) {
    if (!this.senderTabHasFocusedField(sender)) {
      this.expiredPorts.forEach((port) => port.disconnect());
      this.expiredPorts = [];

      return;
    }

    if (overlayElement === AutofillOverlayElement.Button) {
      this.inlineMenuButtonPort?.disconnect();
      this.inlineMenuButtonPort = null;
      this.isInlineMenuButtonVisible = false;

      return;
    }

    this.inlineMenuListPort?.disconnect();
    this.inlineMenuListPort = null;
    this.isInlineMenuListVisible = false;
  }

  /**
   * Updates the position of either the inline menu list or button. The position
   * is based on the focused field's position and dimensions.
   *
   * @param overlayElement - The overlay element to update, either the list or button
   * @param sender - The sender of the port message
   */
  private async updateInlineMenuPosition(
    { overlayElement }: { overlayElement?: string },
    sender: chrome.runtime.MessageSender,
  ) {
    if (!overlayElement || !this.senderTabHasFocusedField(sender)) {
      return;
    }

    this.cancelInlineMenuFadeInAndPositionUpdate();

    await BrowserApi.tabSendMessage(
      sender.tab,
      { command: "appendAutofillInlineMenuToDom", overlayElement },
      { frameId: 0 },
    );

    const subFrameOffsetsForTab = this.subFrameOffsetsForTab[this.focusedFieldData.tabId];
    let subFrameOffsets: SubFrameOffsetData;
    if (subFrameOffsetsForTab) {
      subFrameOffsets = subFrameOffsetsForTab.get(this.focusedFieldData.frameId);
      if (subFrameOffsets === null) {
        this.rebuildSubFrameOffsetsSubject.next(sender);
        this.startUpdateInlineMenuPositionSubject.next(sender);
        return;
      }
    }

    if (overlayElement === AutofillOverlayElement.Button) {
      this.inlineMenuButtonPort?.postMessage({
        command: "updateAutofillInlineMenuPosition",
        styles: this.getInlineMenuButtonPosition(subFrameOffsets),
      });
      this.startInlineMenuFadeIn();

      return;
    }

    this.inlineMenuListPort?.postMessage({
      command: "updateAutofillInlineMenuPosition",
      styles: this.getInlineMenuListPosition(subFrameOffsets),
    });
    this.startInlineMenuFadeIn();
  }

  /**
   * Triggers an update of the inline menu's visibility after the top level frame
   * appends the element to the DOM.
   *
   * @param message - The message received from the content script
   * @param sender - The sender of the port message
   */
  private updateInlineMenuElementIsVisibleStatus(
    message: OverlayBackgroundExtensionMessage,
    sender: chrome.runtime.MessageSender,
  ) {
    if (!this.senderTabHasFocusedField(sender)) {
      return;
    }

    const { overlayElement, isVisible } = message;
    if (overlayElement === AutofillOverlayElement.Button) {
      this.isInlineMenuButtonVisible = isVisible;
      return;
    }

    if (overlayElement === AutofillOverlayElement.List) {
      this.isInlineMenuListVisible = isVisible;
    }
  }

  /**
   * Returns the position of the currently open inline menu.
   */
  private getInlineMenuPosition(): InlineMenuPosition {
    return this.inlineMenuPosition;
  }

  /**
   * Handles updating the opacity of both the inline menu button and list.
   * This is used to simultaneously fade in the inline menu elements.
   */
  private startInlineMenuFadeIn() {
    this.cancelInlineMenuFadeIn();
    this.startInlineMenuFadeInSubject.next();
  }

  /**
   * Clears the timeout used to fade in the inline menu elements.
   */
  private cancelInlineMenuFadeIn() {
    this.cancelInlineMenuFadeInSubject.next(true);
  }

  /**
   * Posts a message to the inline menu elements to trigger a fade in of the inline menu.
   *
   * @param cancelFadeIn - Signal passed to debounced observable to cancel the fade in
   */
  private async triggerInlineMenuFadeIn(cancelFadeIn: boolean = false) {
    if (cancelFadeIn) {
      return;
    }

    const message = { command: "fadeInAutofillInlineMenuIframe" };
    this.inlineMenuButtonPort?.postMessage(message);
    this.inlineMenuListPort?.postMessage(message);
  }

  /**
   * Gets the position of the focused field and calculates the position
   * of the inline menu button based on the focused field's position and dimensions.
   */
  private getInlineMenuButtonPosition(subFrameOffsets: SubFrameOffsetData) {
    const subFrameTopOffset = subFrameOffsets?.top || 0;
    const subFrameLeftOffset = subFrameOffsets?.left || 0;

    const { top, left, width, height } = this.focusedFieldData.focusedFieldRects;
    const { paddingRight, paddingLeft } = this.focusedFieldData.focusedFieldStyles;
    let elementOffset = height * 0.37;
    if (height >= 35) {
      elementOffset = height >= 50 ? height * 0.47 : height * 0.42;
    }

    const fieldPaddingRight = parseInt(paddingRight, 10);
    const fieldPaddingLeft = parseInt(paddingLeft, 10);
    const elementHeight = height - elementOffset;

    const elementTopPosition = subFrameTopOffset + top + elementOffset / 2;
    const elementLeftPosition =
      fieldPaddingRight > fieldPaddingLeft
        ? subFrameLeftOffset + left + width - height - (fieldPaddingRight - elementOffset + 2)
        : subFrameLeftOffset + left + width - height + elementOffset / 2;

    this.inlineMenuPosition.button = {
      top: Math.round(elementTopPosition),
      left: Math.round(elementLeftPosition),
      height: Math.round(elementHeight),
      width: Math.round(elementHeight),
    };

    return {
      top: `${this.inlineMenuPosition.button.top}px`,
      left: `${this.inlineMenuPosition.button.left}px`,
      height: `${this.inlineMenuPosition.button.height}px`,
      width: `${this.inlineMenuPosition.button.width}px`,
    };
  }

  /**
   * Gets the position of the focused field and calculates the position
   * of the inline menu list based on the focused field's position and dimensions.
   */
  private getInlineMenuListPosition(subFrameOffsets: SubFrameOffsetData) {
    const subFrameTopOffset = subFrameOffsets?.top || 0;
    const subFrameLeftOffset = subFrameOffsets?.left || 0;

    const { top, left, width, height } = this.focusedFieldData.focusedFieldRects;

    this.inlineMenuPosition.list = {
      top: Math.round(top + height + subFrameTopOffset),
      left: Math.round(left + subFrameLeftOffset),
      height: 0,
      width: Math.round(width),
    };

    return {
      width: `${this.inlineMenuPosition.list.width}px`,
      top: `${this.inlineMenuPosition.list.top}px`,
      left: `${this.inlineMenuPosition.list.left}px`,
    };
  }

  /**
   * Sets the focused field data to the data passed in the extension message.
   *
   * @param focusedFieldData - Contains the rects and styles of the focused field.
   * @param sender - The sender of the extension message
   */
  private setFocusedFieldData(
    { focusedFieldData }: OverlayBackgroundExtensionMessage,
    sender: chrome.runtime.MessageSender,
  ) {
    if (this.focusedFieldData && !this.senderFrameHasFocusedField(sender)) {
      BrowserApi.tabSendMessage(
        sender.tab,
        { command: "unsetMostRecentlyFocusedField" },
        { frameId: this.focusedFieldData.frameId },
      ).catch((error) => this.logService.error(error));
    }

    const previousFocusedFieldData = this.focusedFieldData;
    this.focusedFieldData = { ...focusedFieldData, tabId: sender.tab.id, frameId: sender.frameId };
    this.isFieldCurrentlyFocused = true;

    const accountCreationFieldBlurred =
      previousFocusedFieldData?.showInlineMenuAccountCreation &&
      !this.focusedFieldData.showInlineMenuAccountCreation;

    if (accountCreationFieldBlurred || this.showInlineMenuAccountCreation()) {
      this.updateIdentityCiphersOnLoginField(previousFocusedFieldData).catch((error) =>
        this.logService.error(error),
      );
      return;
    }

    if (previousFocusedFieldData?.filledByCipherType !== focusedFieldData?.filledByCipherType) {
      const updateAllCipherTypes = focusedFieldData.filledByCipherType !== CipherType.Login;
      this.updateOverlayCiphers(updateAllCipherTypes).catch((error) =>
        this.logService.error(error),
      );
    }
  }

  /**
   * Triggers an update of populated identity ciphers when a login field is focused.
   *
   * @param previousFocusedFieldData - The data set of the previously focused field
   */
  private async updateIdentityCiphersOnLoginField(previousFocusedFieldData: FocusedFieldData) {
    if (
      !previousFocusedFieldData ||
      !this.isInlineMenuButtonVisible ||
      (await this.getAuthStatus()) !== AuthenticationStatus.Unlocked
    ) {
      return;
    }

    this.inlineMenuListPort?.postMessage({
      command: "updateAutofillInlineMenuListCiphers",
      ciphers: await this.getInlineMenuCipherData(),
      showInlineMenuAccountCreation: this.showInlineMenuAccountCreation(),
      showPasskeysLabels: this.showPasskeysLabelsWithinInlineMenu,
    });
  }

  /**
   * Updates the inline menu's visibility based on the display property passed in the extension message.
   *
   * @param display - The display property of the inline menu, either "block" or "none"
   * @param sender - The sender of the extension message
   */
  private async toggleInlineMenuHidden(
    { isInlineMenuHidden, setTransparentInlineMenu }: ToggleInlineMenuHiddenMessage,
    sender: chrome.runtime.MessageSender,
  ) {
    if (!this.senderTabHasFocusedField(sender)) {
      return;
    }

    this.cancelInlineMenuFadeIn();
    const display = isInlineMenuHidden ? "none" : "block";
    let styles: { display: string; opacity?: string } = { display };

    if (typeof setTransparentInlineMenu !== "undefined") {
      const opacity = setTransparentInlineMenu ? "0" : "1";
      styles = { ...styles, opacity };
    }

    const portMessage = { command: "toggleAutofillInlineMenuHidden", styles };
    if (this.inlineMenuButtonPort) {
      this.isInlineMenuButtonVisible = !isInlineMenuHidden;
      this.inlineMenuButtonPort.postMessage(portMessage);
    }

    if (this.inlineMenuListPort) {
      this.isInlineMenuListVisible = !isInlineMenuHidden;
      this.inlineMenuListPort.postMessage(portMessage);
    }

    if (setTransparentInlineMenu) {
      this.startInlineMenuFadeIn();
    }
  }

  /**
   * Sends a message to the currently active tab to open the autofill inline menu.
   *
   * @param isFocusingFieldElement - Identifies whether the field element should be focused when the inline menu is opened
   * @param isOpeningFullInlineMenu - Identifies whether the full inline menu should be forced open regardless of other states
   */
  private async openInlineMenu(isFocusingFieldElement = false, isOpeningFullInlineMenu = false) {
    this.clearDelayedInlineMenuClosure();
    const currentTab = await BrowserApi.getTabFromCurrentWindowId();
    if (!currentTab) {
      return;
    }

    await BrowserApi.tabSendMessage(
      currentTab,
      {
        command: "openAutofillInlineMenu",
        isFocusingFieldElement,
        isOpeningFullInlineMenu,
        authStatus: await this.getAuthStatus(),
      },
      {
        frameId: this.focusedFieldData?.tabId === currentTab.id ? this.focusedFieldData.frameId : 0,
      },
    );
  }

  /**
   * Gets the inline menu's visibility setting from the settings service.
   */
  private async getInlineMenuVisibility(): Promise<InlineMenuVisibilitySetting> {
    return await firstValueFrom(this.autofillSettingsService.inlineMenuVisibility$);
  }

  /**
   * Gets the user's authentication status from the auth service. If the user's authentication
   * status has changed, the inline menu button's authentication status will be updated
   * and the inline menu list's ciphers will be updated.
   */
  private async getAuthStatus() {
    return await firstValueFrom(this.authService.activeAccountStatus$);
  }

  /**
   * Sends a message to the inline menu button to update its authentication status.
   */
  private async updateInlineMenuButtonAuthStatus() {
    this.inlineMenuButtonPort?.postMessage({
      command: "updateInlineMenuButtonAuthStatus",
      authStatus: await this.getAuthStatus(),
    });
  }

  /**
   * Handles the inline menu button being clicked. If the user is not authenticated,
   * the vault will be unlocked. If the user is authenticated, the inline menu will
   * be opened.
   *
   * @param port - The port of the inline menu button
   */
  private async handleInlineMenuButtonClicked(port: chrome.runtime.Port) {
    this.clearDelayedInlineMenuClosure();
    this.cancelInlineMenuFadeInAndPositionUpdate();

    if ((await this.getAuthStatus()) !== AuthenticationStatus.Unlocked) {
      await this.unlockVault(port);
      return;
    }

    await this.openInlineMenu(false, true);
  }

  /**
   * Facilitates opening the unlock popout window.
   *
   * @param port - The port of the inline menu list
   */
  private async unlockVault(port: chrome.runtime.Port) {
    const { sender } = port;

    this.closeInlineMenu(port.sender);
    const retryMessage: LockedVaultPendingNotificationsData = {
      commandToRetry: { message: { command: "openAutofillInlineMenu" }, sender },
      target: "overlay.background",
    };
    await BrowserApi.tabSendMessageData(
      sender.tab,
      "addToLockedVaultPendingNotifications",
      retryMessage,
    );
    await this.openUnlockPopout(sender.tab, true);
  }

  /**
   * Triggers the opening of a vault item popout window associated
   * with the passed cipher ID.
   * @param inlineMenuCipherId - Cipher ID corresponding to the inlineMenuCiphers map. Does not correspond to the actual cipher's ID.
   * @param sender - The sender of the port message
   */
  private async viewSelectedCipher(
    { inlineMenuCipherId }: OverlayPortMessage,
    { sender }: chrome.runtime.Port,
  ) {
    const cipher = this.inlineMenuCiphers.get(inlineMenuCipherId);
    if (!cipher) {
      return;
    }

    this.closeInlineMenu(sender);
    await this.openViewVaultItemPopout(sender.tab, {
      cipherId: cipher.id,
      action: SHOW_AUTOFILL_BUTTON,
    });
  }

  /**
   * Facilitates redirecting focus to the inline menu list.
   */
  private focusInlineMenuList() {
    this.inlineMenuListPort?.postMessage({ command: "focusAutofillInlineMenuList" });
  }

  /**
   * Updates the authentication status for the user and opens the inline menu if
   * a followup command is present in the message.
   *
   * @param message - Extension message received from the `unlockCompleted` command
   */
  private async unlockCompleted(message: OverlayBackgroundExtensionMessage) {
    await this.updateInlineMenuButtonAuthStatus();
    await this.updateOverlayCiphers();

    if (message.data?.commandToRetry?.message?.command === "openAutofillInlineMenu") {
      await this.openInlineMenu(true);
    }
  }

  /**
   * Gets the translations for the inline menu page.
   */
  private getInlineMenuTranslations() {
    if (!this.inlineMenuPageTranslations) {
      this.inlineMenuPageTranslations = {
        locale: BrowserApi.getUILanguage(),
        opensInANewWindow: this.i18nService.translate("opensInANewWindow"),
        buttonPageTitle: this.i18nService.translate("bitwardenOverlayButton"),
        toggleBitwardenVaultOverlay: this.i18nService.translate("toggleBitwardenVaultOverlay"),
        listPageTitle: this.i18nService.translate("bitwardenVault"),
        unlockYourAccount: this.i18nService.translate("unlockYourAccountToViewAutofillSuggestions"),
        unlockAccount: this.i18nService.translate("unlockAccount"),
        unlockAccountAria: this.i18nService.translate("unlockAccountAria"),
        fillCredentialsFor: this.i18nService.translate("fillCredentialsFor"),
        username: this.i18nService.translate("username")?.toLowerCase(),
        view: this.i18nService.translate("view"),
        edit: this.i18nService.translate("edit"),
        noItemsToShow: this.i18nService.translate("noItemsToShow"),
        newItem: this.i18nService.translate("newItem"),
        addNewVaultItem: this.i18nService.translate("addNewVaultItem"),
        newLogin: this.i18nService.translate("newLogin"),
        addNewLoginItem: this.i18nService.translate("addNewLoginItemAria"),
        newCard: this.i18nService.translate("newCard"),
        addNewCardItem: this.i18nService.translate("addNewCardItemAria"),
        newIdentity: this.i18nService.translate("newIdentity"),
        addNewIdentityItem: this.i18nService.translate("addNewIdentityItemAria"),
        cardNumberEndsWith: this.i18nService.translate("cardNumberEndsWith"),
        passkeys: this.i18nService.translate("passkeys"),
        passwords: this.i18nService.translate("passwords"),
        logInWithPasskey: this.i18nService.translate("logInWithPasskeyAriaLabel"),
        autofillAll: this.i18nService.translate("autofillAll"),
        autofillCurrent: this.i18nService.translate("autofillCurrent"),
        cipherContactMe: this.i18nService.translate("cipherContactMe"),
        home: this.i18nService.translate("home"),
        work: this.i18nService.translate("work"),
        cell: this.i18nService.translate("cell"),
        contactSearch: this.i18nService.translate("contactSearch"),
        empty_email: this.i18nService.translate("empty_email"),
        empty_phone: this.i18nService.translate("empty_phone"),
        empty_address: this.i18nService.translate("empty_address"),
        empty_name: this.i18nService.translate("empty_name"),
        empty_jobTitle: this.i18nService.translate("empty_jobTitle"),
        empty_company: this.i18nService.translate("empty_company"),
        new: this.i18nService.translate("new"),
        address: this.i18nService.translate("address"),
        address_street: this.i18nService.translate("address_street"),
        address_code: this.i18nService.translate("address_code"),
        address_number: this.i18nService.translate("address_number"),
        address_city: this.i18nService.translate("address_city"),
        address_building: this.i18nService.translate("address_building"),
        address_stairs: this.i18nService.translate("address_stairs"),
        address_floor: this.i18nService.translate("address_floor"),
        address_apartment: this.i18nService.translate("address_apartment"),
        address_locality: this.i18nService.translate("address_locality"),
        address_country: this.i18nService.translate("address_country"),
        address_entrycode: this.i18nService.translate("address_entrycode"),
        address_region: this.i18nService.translate("address_region"),
        phone: this.i18nService.translate("phone"),
        email: this.i18nService.translate("email"),
        cellHome: this.i18nService.translate("cellHome"),
        cellWork: this.i18nService.translate("cellWork"),
        voiceHome: this.i18nService.translate("voiceHome"),
        voiceWork: this.i18nService.translate("voiceWork"),
        faxHome: this.i18nService.translate("faxHome"),
        faxWork: this.i18nService.translate("faxWork"),
        none: this.i18nService.translate("none"),
        name: this.i18nService.translate("name"),
        new_address: this.i18nService.translate("new_address"),
        new_phone: this.i18nService.translate("new_phone"),
        new_email: this.i18nService.translate("new_email"),
        new_name: this.i18nService.translate("new_name"),
        new_jobTitle: this.i18nService.translate("new_jobTitle"),
        new_company: this.i18nService.translate("new_company"),
        new_contact: this.i18nService.translate("new_contact"),
        addressDetails: this.i18nService.translate("addressDetails"),
        new_paperIdentityCardNumber: this.i18nService.translate("new_paperIdentityCardNumber"),
        new_paperPassportNumber: this.i18nService.translate("new_paperPassportNumber"),
        new_paperSocialSecurityNumber: this.i18nService.translate("new_paperSocialSecurityNumber"),
        new_paperResidencePermitNumber: this.i18nService.translate(
          "new_paperResidencePermitNumber",
        ),
        new_paperDrivingLicenseNumber: this.i18nService.translate("new_paperDrivingLicenseNumber"),
        new_paperVehicleRegistrationNumber: this.i18nService.translate(
          "new_paperVehicleRegistrationNumber",
        ),
        new_paperVehicleRegistrationConfidentialCode: this.i18nService.translate(
          "new_paperVehicleRegistrationConfidentialCode",
        ),
        new_paperVehicleRegistrationLicensePlateNumber: this.i18nService.translate(
          "new_paperVehicleRegistrationLicensePlateNumber",
        ),
        new_paperBankIbanNumber: this.i18nService.translate("new_paperBankIbanNumber"),
        new_paperBankBicNumber: this.i18nService.translate("new_paperBankBicNumber"),
        new_paperGrossSalaryAmount: this.i18nService.translate("new_paperGrossSalaryAmount"),
        new_paperNetSalaryAmount: this.i18nService.translate("new_paperNetSalaryAmount"),
        new_paperTaxNoticeNumber: this.i18nService.translate("new_paperTaxNoticeNumber"),
        new_paperTaxNoticeRefTaxIncome: this.i18nService.translate(
          "new_paperTaxNoticeRefTaxIncome",
        ),
        autofill_identityTitle: this.i18nService.translate("autofill_identityTitle"),
        autofill_identityFirstName: this.i18nService.translate("autofill_identityFirstName"),
        autofill_identityMiddleName: this.i18nService.translate("autofill_identityMiddleName"),
        autofill_identityLastName: this.i18nService.translate("autofill_identityLastName"),
        autofill_contactSurname: this.i18nService.translate("autofill_contactSurname"),
        autofill_contactJobTitle: this.i18nService.translate("autofill_contactJobTitle"),
        autofill_contactBirthDay: this.i18nService.translate("autofill_contactBirthDay"),
        autofill_contactBirthMonth: this.i18nService.translate("autofill_contactBirthMonth"),
        autofill_contactBirthYear: this.i18nService.translate("autofill_contactBirthYear"),
        autofill_addressNumber: this.i18nService.translate("autofill_addressNumber"),
        autofill_identityFullName: this.i18nService.translate("autofill_identityFullName"),
        autofill_identityAddress1: this.i18nService.translate("autofill_identityAddress1"),
        autofill_identityAddress2: this.i18nService.translate("autofill_identityAddress2"),
        autofill_identityAddress3: this.i18nService.translate("autofill_identityAddress3"),
        autofill_identityCity: this.i18nService.translate("autofill_identityCity"),
        autofill_identityState: this.i18nService.translate("autofill_identityState"),
        autofill_identityPostalCode: this.i18nService.translate("autofill_identityPostalCode"),
        autofill_identityCountry: this.i18nService.translate("autofill_identityCountry"),
        autofill_identityCompany: this.i18nService.translate("autofill_identityCompany"),
        autofill_identityPhone: this.i18nService.translate("autofill_identityPhone"),
        autofill_identityEmail: this.i18nService.translate("autofill_identityEmail"),
        autofill_identityUsername: this.i18nService.translate("autofill_identityUsername"),
        autofill_paperIdentityCardNumber: this.i18nService.translate(
          "autofill_paperIdentityCardNumber",
        ),
        autofill_paperPassportNumber: this.i18nService.translate("autofill_paperPassportNumber"),
        autofill_paperSocialSecurityNumber: this.i18nService.translate(
          "autofill_paperSocialSecurityNumber",
        ),
        autofill_paperResidencePermitNumber: this.i18nService.translate(
          "autofill_paperResidencePermitNumber",
        ),
        autofill_paperDrivingLicenseNumber: this.i18nService.translate(
          "autofill_paperDrivingLicenseNumber",
        ),
        autofill_paperVehicleRegistrationNumber: this.i18nService.translate(
          "autofill_paperVehicleRegistrationNumber",
        ),
        autofill_paperVehicleRegistrationConfidentialCode: this.i18nService.translate(
          "autofill_paperVehicleRegistrationConfidentialCode",
        ),
        autofill_paperVehicleRegistrationLicensePlateNumber: this.i18nService.translate(
          "autofill_paperVehicleRegistrationLicensePlateNumber",
        ),
        autofill_paperBankIbanNumber: this.i18nService.translate("autofill_paperBankIbanNumber"),
        autofill_paperBankBicNumber: this.i18nService.translate("autofill_paperBankBicNumber"),
        autofill_paperGrossSalaryAmount: this.i18nService.translate(
          "autofill_paperGrossSalaryAmount",
        ),
        autofill_paperNetSalaryAmount: this.i18nService.translate("autofill_paperNetSalaryAmount"),
        autofill_paperTaxNoticeNumber: this.i18nService.translate("autofill_paperTaxNoticeNumber"),
        autofill_paperTaxNoticeRefTaxIncome: this.i18nService.translate(
          "autofill_paperTaxNoticeRefTaxIncome",
        ),
        givenName: this.i18nService.translate("givenName"),
        additionalName: this.i18nService.translate("additionalName"),
        familyName: this.i18nService.translate("familyName"),
        displayName: this.i18nService.translate("displayName"),
        label: this.i18nService.translate("label"),
        save: this.i18nService.translate("save"),
        cancel: this.i18nService.translate("cancel"),
      };
    }

    return this.inlineMenuPageTranslations;
  }

  /**
   * Facilitates redirecting focus out of one of the
   * inline menu elements to elements on the page.
   *
   * @param direction - The direction to redirect focus to (either "next", "previous" or "current)
   * @param sender - The sender of the port message
   */
  private redirectInlineMenuFocusOut(
    { direction }: OverlayPortMessage,
    { sender }: chrome.runtime.Port,
  ) {
    if (!direction) {
      return;
    }

    BrowserApi.tabSendMessageData(sender.tab, "redirectAutofillInlineMenuFocusOut", {
      direction,
    }).catch((error) => this.logService.error(error));
  }

  /**
   * Triggers adding a new vault item from the overlay. Gathers data
   * input by the user before calling to open the add/edit window.
   *
   * @param addNewCipherType - The type of cipher to add
   * @param sender - The sender of the port message
   */
  private getNewVaultItemDetails(
    { addNewCipherType }: OverlayPortMessage,
    { sender }: chrome.runtime.Port,
  ) {
    if (!addNewCipherType || !this.senderTabHasFocusedField(sender)) {
      return;
    }

    this.currentAddNewItemData = { addNewCipherType, sender };
    BrowserApi.tabSendMessage(sender.tab, {
      command: "addNewVaultItemFromOverlay",
      addNewCipherType,
    }).catch((error) => this.logService.error(error));
  }

  /**
   * Handles adding a new vault item from the overlay. Gathers data login
   * data captured in the extension message.
   *
   * @param addNewCipherType - The type of cipher to add
   * @param login - The login data captured from the extension message
   * @param card - The card data captured from the extension message
   * @param identity - The identity data captured from the extension message
   * @param sender - The sender of the extension message
   */
  private async addNewVaultItem(
    { addNewCipherType, login, card, identity }: OverlayAddNewItemMessage,
    sender: chrome.runtime.MessageSender,
  ) {
    if (
      !this.currentAddNewItemData ||
      sender.tab.id !== this.currentAddNewItemData.sender.tab.id ||
      !addNewCipherType ||
      this.currentAddNewItemData.addNewCipherType !== addNewCipherType
    ) {
      return;
    }

    if (login && this.isAddingNewLogin()) {
      this.updateCurrentAddNewItemLogin(login, sender);
    }

    if (card && this.isAddingNewCard()) {
      this.updateCurrentAddNewItemCard(card);
    }

    if (identity && this.isAddingNewIdentity()) {
      this.updateCurrentAddNewItemIdentity(identity);
    }

    this.addNewVaultItemSubject.next(this.currentAddNewItemData);
  }

  /**
   * Identifies if the current add new item data is for adding a new login.
   */
  private isAddingNewLogin() {
    return this.currentAddNewItemData.addNewCipherType === CipherType.Login;
  }

  /**
   * Identifies if the current add new item data is for adding a new card.
   */
  private isAddingNewCard() {
    return this.currentAddNewItemData.addNewCipherType === CipherType.Card;
  }

  /**
   * Identifies if the current add new item data is for adding a new identity.
   */
  private isAddingNewIdentity() {
    return this.currentAddNewItemData.addNewCipherType === CipherType.Identity;
  }

  /**
   * Updates the current add new item data with the provided login data. If the
   * login data is already present, the data will be merged with the existing data.
   *
   * @param login - The login data captured from the extension message
   * @param sender - The sender of the extension message
   */
  private updateCurrentAddNewItemLogin(
    login: NewLoginCipherData,
    sender: chrome.runtime.MessageSender,
  ) {
    const { username, password } = login;

    if (this.partialLoginDataFoundInSubFrame(sender, login)) {
      login.uri = "";
      login.hostname = "";
    }

    if (!this.currentAddNewItemData.login) {
      this.currentAddNewItemData.login = login;
      return;
    }

    const currentLoginData = this.currentAddNewItemData.login;
    if (sender.frameId === 0 && currentLoginData.hostname && !username && !password) {
      login.uri = "";
      login.hostname = "";
    }

    this.currentAddNewItemData.login = {
      uri: login.uri || currentLoginData.uri,
      hostname: login.hostname || currentLoginData.hostname,
      username: username || currentLoginData.username,
      password: password || currentLoginData.password,
    };
  }

  /**
   * Handles verifying if the login data for a tab is separated between various
   * iframe elements. If that is the case, we want to ignore the login uri and
   * domain to ensure the top frame is treated as the primary source of login data.
   *
   * @param sender - The sender of the extension message
   * @param login - The login data captured from the extension message
   */
  private partialLoginDataFoundInSubFrame(
    sender: chrome.runtime.MessageSender,
    login: NewLoginCipherData,
  ) {
    const { frameId } = sender;
    const { username, password } = login;

    return frameId !== 0 && (!username || !password);
  }

  /**
   * Updates the current add new item data with the provided card data. If the
   * card data is already present, the data will be merged with the existing data.
   *
   * @param card - The card data captured from the extension message
   */
  private updateCurrentAddNewItemCard(card: NewCardCipherData) {
    if (!this.currentAddNewItemData.card) {
      this.currentAddNewItemData.card = card;
      return;
    }

    const currentCardData = this.currentAddNewItemData.card;
    this.currentAddNewItemData.card = {
      cardholderName: card.cardholderName || currentCardData.cardholderName,
      number: card.number || currentCardData.number,
      expirationMonth: card.expirationMonth || currentCardData.expirationMonth,
      expirationYear: card.expirationYear || currentCardData.expirationYear,
      expirationDate: card.expirationDate || currentCardData.expirationDate,
      cvv: card.cvv || currentCardData.cvv,
    };
  }

  /**
   * Updates the current add new item data with the provided identity data. If the
   * identity data is already present, the data will be merged with the existing data.
   *
   * @param identity - The identity data captured from the extension message
   */
  private updateCurrentAddNewItemIdentity(identity: NewIdentityCipherData) {
    if (!this.currentAddNewItemData.identity) {
      this.currentAddNewItemData.identity = identity;
      return;
    }

    const currentIdentityData = this.currentAddNewItemData.identity;
    this.currentAddNewItemData.identity = {
      title: identity.title || currentIdentityData.title,
      firstName: identity.firstName || currentIdentityData.firstName,
      middleName: identity.middleName || currentIdentityData.middleName,
      lastName: identity.lastName || currentIdentityData.lastName,
      fullName: identity.fullName || currentIdentityData.fullName,
      address1: identity.address1 || currentIdentityData.address1,
      address2: identity.address2 || currentIdentityData.address2,
      address3: identity.address3 || currentIdentityData.address3,
      city: identity.city || currentIdentityData.city,
      state: identity.state || currentIdentityData.state,
      postalCode: identity.postalCode || currentIdentityData.postalCode,
      country: identity.country || currentIdentityData.country,
      company: identity.company || currentIdentityData.company,
      phone: identity.phone || currentIdentityData.phone,
      email: identity.email || currentIdentityData.email,
      username: identity.username || currentIdentityData.username,
    };
  }

  /**
   * Handles building a new cipher and opening the add/edit vault item popout.
   *
   * @param login - The login data captured from the extension message
   * @param card - The card data captured from the extension message
   * @param identity - The identity data captured from the extension message
   * @param sender - The sender of the extension message
   */
  private async buildCipherAndOpenAddEditVaultItemPopout({
    login,
    card,
    identity,
    sender,
  }: CurrentAddNewItemData) {
    const cipherView: CipherView = this.buildNewVaultItemCipherView({
      login,
      card,
      identity,
    });

    if (!cipherView) {
      this.currentAddNewItemData = null;
      return;
    }

    try {
      this.closeInlineMenu(sender);
      await this.cipherService.setAddEditCipherInfo({
        cipher: cipherView,
        collectionIds: cipherView.collectionIds,
      });

      await this.openAddEditVaultItemPopout(sender.tab, { cipherId: cipherView.id });
      await BrowserApi.sendMessage("inlineAutofillMenuRefreshAddEditCipher");
    } catch (error) {
      this.logService.error("Error building cipher and opening add/edit vault item popout", error);
    }

    this.currentAddNewItemData = null;
  }

  /**
   * Builds and returns a new cipher view with the provided vault item data.
   *
   * @param login - The login data captured from the extension message
   * @param card - The card data captured from the extension message
   * @param identity - The identity data captured from the extension message
   */
  private buildNewVaultItemCipherView({ login, card, identity }: OverlayAddNewItemMessage) {
    if (login && this.isAddingNewLogin()) {
      return this.buildLoginCipherView(login);
    }

    if (card && this.isAddingNewCard()) {
      return this.buildCardCipherView(card);
    }

    if (identity && this.isAddingNewIdentity()) {
      return this.buildIdentityCipherView(identity);
    }
  }

  /**
   * Builds a new login cipher view with the provided login data.
   *
   * @param login - The login data captured from the extension message
   */
  private buildLoginCipherView(login: NewLoginCipherData) {
    const uriView = new LoginUriView();
    uriView.uri = login.uri;

    const loginView = new LoginView();
    loginView.uris = [uriView];
    loginView.username = login.username || "";
    loginView.password = login.password || "";

    const cipherView = new CipherView();
    cipherView.name = (Utils.getHostname(login.uri) || login.hostname).replace(/^www\./, "");
    cipherView.folderId = null;
    cipherView.type = CipherType.Login;
    cipherView.login = loginView;

    return cipherView;
  }

  /**
   * Builds a new card cipher view with the provided card data.
   *
   * @param card - The card data captured from the extension message
   */
  private buildCardCipherView(card: NewCardCipherData) {
    const cardView = new CardView();
    cardView.cardholderName = card.cardholderName || "";
    cardView.number = card.number || "";
    cardView.expMonth = card.expirationMonth || "";
    cardView.expYear = card.expirationYear || "";
    cardView.code = card.cvv || "";
    cardView.brand = card.number ? CardView.getCardBrandByPatterns(card.number) : "";

    const cipherView = new CipherView();
    cipherView.name = "";
    cipherView.folderId = null;
    cipherView.type = CipherType.Card;
    cipherView.card = cardView;

    return cipherView;
  }

  /**
   * Builds a new identity cipher view with the provided identity data.
   *
   * @param identity - The identity data captured from the extension message
   */
  private buildIdentityCipherView(identity: NewIdentityCipherData) {
    const identityView = new IdentityView();
    identityView.title = identity.title || "";
    identityView.firstName = identity.firstName || "";
    identityView.middleName = identity.middleName || "";
    identityView.lastName = identity.lastName || "";
    identityView.address1 = identity.address1 || "";
    identityView.address2 = identity.address2 || "";
    identityView.address3 = identity.address3 || "";
    identityView.city = identity.city || "";
    identityView.state = identity.state || "";
    identityView.postalCode = identity.postalCode || "";
    identityView.country = identity.country || "";
    identityView.company = identity.company || "";
    identityView.phone = identity.phone || "";
    identityView.email = identity.email || "";
    identityView.username = identity.username || "";

    if (identity.fullName && !identityView.firstName && !identityView.lastName) {
      this.buildIdentityNameParts(identity, identityView);
    }

    const cipherView = new CipherView();
    cipherView.name = "";
    cipherView.folderId = null;
    cipherView.type = CipherType.Identity;
    cipherView.identity = identityView;

    return cipherView;
  }

  /**
   * Splits the identity full name into first, middle, and last name parts.
   *
   * @param identity - The identity data captured from the extension message
   * @param identityView - The identity view to update
   */
  private buildIdentityNameParts(identity: NewIdentityCipherData, identityView: IdentityView) {
    const fullNameParts = identity.fullName.split(" ");
    if (fullNameParts.length === 1) {
      identityView.firstName = fullNameParts[0] || "";

      return;
    }

    if (fullNameParts.length === 2) {
      identityView.firstName = fullNameParts[0] || "";
      identityView.lastName = fullNameParts[1] || "";

      return;
    }

    identityView.firstName = fullNameParts[0] || "";
    identityView.middleName = fullNameParts[1] || "";
    identityView.lastName = fullNameParts[2] || "";
  }

  /**
   * Updates the property that identifies if a form field set up for the inline menu is currently focused.
   *
   * @param message - The message received from the web page
   * @param sender - The sender of the port message
   */
  private updateIsFieldCurrentlyFocused(
    message: OverlayBackgroundExtensionMessage,
    sender: chrome.runtime.MessageSender,
  ) {
    if (this.focusedFieldData && !this.senderFrameHasFocusedField(sender)) {
      return;
    }

    this.isFieldCurrentlyFocused = message.isFieldCurrentlyFocused;
  }

  /**
   * Allows a content script to check if a form field setup for the inline menu is currently focused.
   */
  private checkIsFieldCurrentlyFocused() {
    return this.isFieldCurrentlyFocused;
  }

  /**
   * Updates the property that identifies if a form field is currently being autofilled.
   *
   * @param message - The message received from the web page
   */
  private updateIsFieldCurrentlyFilling(message: OverlayBackgroundExtensionMessage) {
    this.isFieldCurrentlyFilling = message.isFieldCurrentlyFilling;
  }

  /**
   * Allows a content script to check if a form field is currently being autofilled.
   */
  private checkIsFieldCurrentlyFilling() {
    return this.isFieldCurrentlyFilling;
  }

  /**
   * Returns the visibility status of the inline menu button.
   */
  private checkIsInlineMenuButtonVisible(): boolean {
    return this.isInlineMenuButtonVisible;
  }

  /**
   * Returns the visibility status of the inline menu list.
   */
  private checkIsInlineMenuListVisible(): boolean {
    return this.isInlineMenuListVisible;
  }

  /**
   * Responds to the content script's request to check if the inline menu ciphers are populated.
   * This will return true only if the sender is the focused field's tab and the inline menu
   * ciphers are populated.
   *
   * @param sender - The sender of the message
   */
  private checkIsInlineMenuCiphersPopulated(sender: chrome.runtime.MessageSender) {
    return this.senderTabHasFocusedField(sender) && this.currentInlineMenuCiphersCount > 0;
  }

  /**
   * Triggers an update in the meta "color-scheme" value within the inline menu button.
   * This is done to ensure that the button element has a transparent background, which
   * is accomplished by setting the "color-scheme" meta value of the button iframe to
   * the same value as the page's meta "color-scheme" value.
   */
  private updateInlineMenuButtonColorScheme() {
    this.inlineMenuButtonPort?.postMessage({
      command: "updateAutofillInlineMenuColorScheme",
    });
  }

  /**
   * Triggers an update in the inline menu list's height.
   *
   * @param message - Contains the dimensions of the inline menu list
   */
  private updateInlineMenuListHeight(message: OverlayBackgroundExtensionMessage) {
    const parsedHeight = parseInt(message.styles?.height);
    if (this.inlineMenuPosition.list && parsedHeight > 0) {
      this.inlineMenuPosition.list.height = parsedHeight;
    }

    this.inlineMenuListPort?.postMessage({
      command: "updateAutofillInlineMenuPosition",
      styles: message.styles,
    });
  }

  /**
   * Handles verifying whether the inline menu should be repositioned. This is used to
   * guard against removing the inline menu when other frames trigger a resize event.
   *
   * @param sender - The sender of the message
   */
  private checkShouldRepositionInlineMenu(sender: chrome.runtime.MessageSender): boolean {
    if (!this.focusedFieldData || !this.senderTabHasFocusedField(sender)) {
      return false;
    }

    if (this.senderFrameHasFocusedField(sender)) {
      return true;
    }

    const subFrameOffsetsForTab = this.subFrameOffsetsForTab[sender.tab.id];
    if (subFrameOffsetsForTab) {
      for (const value of subFrameOffsetsForTab.values()) {
        if (value?.parentFrameIds.includes(sender.frameId)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Identifies if the sender tab is the same as the focused field's tab.
   *
   * @param sender - The sender of the message
   */
  private senderTabHasFocusedField(sender: chrome.runtime.MessageSender) {
    return sender.tab.id === this.focusedFieldData?.tabId;
  }

  /**
   * Identifies if the sender frame is the same as the focused field's frame.
   *
   * @param sender - The sender of the message
   */
  private senderFrameHasFocusedField(sender: chrome.runtime.MessageSender) {
    return sender.frameId === this.focusedFieldData?.frameId;
  }

  /**
   * Triggers when a scroll or resize event occurs within a tab. Will reposition the inline menu
   * if the focused field is within the viewport.
   *
   * @param sender - The sender of the message
   */
  private async triggerOverlayReposition(sender: chrome.runtime.MessageSender) {
    if (!this.checkShouldRepositionInlineMenu(sender)) {
      return;
    }

    this.resetFocusedFieldSubFrameOffsets(sender);
    this.cancelInlineMenuFadeInAndPositionUpdate();
    this.toggleInlineMenuHidden({ isInlineMenuHidden: true }, sender).catch((error) =>
      this.logService.error(error),
    );
    this.repositionInlineMenuSubject.next(sender);
  }

  /**
   * Sets the sub frame offsets for the currently focused field's frame to a null value .
   * This ensures that we can delay presentation of the inline menu after a reposition
   * event if the user clicks on a field before the sub frames can be rebuilt.
   *
   * @param sender
   */
  private resetFocusedFieldSubFrameOffsets(sender: chrome.runtime.MessageSender) {
    if (this.focusedFieldData.frameId > 0 && this.subFrameOffsetsForTab[sender.tab.id]) {
      this.subFrameOffsetsForTab[sender.tab.id].set(this.focusedFieldData.frameId, null);
    }
  }

  /**
   * Triggers when a focus event occurs within a tab. Will reposition the inline menu
   * if the focused field is within the viewport.
   *
   * @param sender - The sender of the message
   */
  private async triggerSubFrameFocusInRebuild(sender: chrome.runtime.MessageSender) {
    this.cancelInlineMenuFadeInAndPositionUpdate();
    this.rebuildSubFrameOffsetsSubject.next(sender);
    this.repositionInlineMenuSubject.next(sender);
  }

  /**
   * Handles determining if the inline menu should be repositioned or closed, and initiates
   * the process of calculating the new position of the inline menu.
   *
   * @param sender - The sender of the message
   */
  private repositionInlineMenu = async (sender: chrome.runtime.MessageSender) => {
    this.cancelInlineMenuFadeInAndPositionUpdate();
    if (!this.isFieldCurrentlyFocused && !this.isInlineMenuButtonVisible) {
      await this.closeInlineMenuAfterReposition(sender);
      return;
    }

    const isFieldWithinViewport = await BrowserApi.tabSendMessage(
      sender.tab,
      { command: "checkIsMostRecentlyFocusedFieldWithinViewport" },
      { frameId: this.focusedFieldData.frameId },
    );
    if (!isFieldWithinViewport) {
      await this.closeInlineMenuAfterReposition(sender);
      return;
    }

    if (this.focusedFieldData.frameId > 0) {
      this.rebuildSubFrameOffsetsSubject.next(sender);
    }

    this.startUpdateInlineMenuPositionSubject.next(sender);
  };

  /**
   * Triggers a closure of the inline menu during a reposition event.
   *
   * @param sender - The sender of the message
|   */
  private async closeInlineMenuAfterReposition(sender: chrome.runtime.MessageSender) {
    await this.toggleInlineMenuHidden(
      { isInlineMenuHidden: false, setTransparentInlineMenu: true },
      sender,
    );
    this.closeInlineMenu(sender, { forceCloseInlineMenu: true });
  }

  /**
   * Cancels the observables that update the position and fade in of the inline menu.
   */
  private cancelInlineMenuFadeInAndPositionUpdate() {
    this.cancelInlineMenuFadeIn();
    this.cancelUpdateInlineMenuPositionSubject.next();
  }

  /**
   * Sets up the extension message listeners for the overlay.
   */
  private setupExtensionListeners() {
    BrowserApi.messageListener("overlay.background", this.handleExtensionMessage);
    BrowserApi.addListener(chrome.webNavigation.onCommitted, this.handleWebNavigationOnCommitted);
    BrowserApi.addListener(chrome.runtime.onConnect, this.handlePortOnConnect);
  }

  /**
   * Handles extension messages sent to the extension background.
   *
   * @param message - The message received from the extension
   * @param sender - The sender of the message
   * @param sendResponse - The response to send back to the sender
   */
  private handleExtensionMessage = (
    message: OverlayBackgroundExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void,
  ) => {
    const handler: CallableFunction | undefined = this.extensionMessageHandlers[message?.command];
    if (!handler) {
      return null;
    }

    const messageResponse = handler({ message, sender });
    if (typeof messageResponse === "undefined") {
      return null;
    }

    Promise.resolve(messageResponse)
      .then((response) => sendResponse(response))
      .catch((error) => this.logService.error(error));
    return true;
  };

  /**
   * Handles clearing page details and sub frame offsets when a frame or tab navigation event occurs.
   *
   * @param details - The details of the web navigation event
   */
  private handleWebNavigationOnCommitted = (
    details: chrome.webNavigation.WebNavigationTransitionCallbackDetails,
  ) => {
    const { frameId, tabId } = details;
    const subFrames = this.subFrameOffsetsForTab[tabId];
    if (frameId === 0) {
      this.removePageDetails(tabId);
      if (subFrames) {
        subFrames.clear();
        delete this.subFrameOffsetsForTab[tabId];
      }
      return;
    }

    if (subFrames && subFrames.has(frameId)) {
      subFrames.delete(frameId);
    }
  };

  /**
   * Handles the connection of a port to the extension background.
   *
   * @param port - The port that connected to the extension background
   */
  private handlePortOnConnect = async (port: chrome.runtime.Port) => {
    const isInlineMenuListMessageConnector = port.name === AutofillOverlayPort.ListMessageConnector;
    const isInlineMenuButtonMessageConnector =
      port.name === AutofillOverlayPort.ButtonMessageConnector;
    if (isInlineMenuListMessageConnector || isInlineMenuButtonMessageConnector) {
      port.onMessage.addListener(this.handleOverlayElementPortMessage);
      return;
    }

    const isInlineMenuListPort = port.name === AutofillOverlayPort.List;
    const isInlineMenuButtonPort = port.name === AutofillOverlayPort.Button;
    if (!isInlineMenuListPort && !isInlineMenuButtonPort) {
      return;
    }

    if (!this.portKeyForTab[port.sender.tab.id]) {
      this.portKeyForTab[port.sender.tab.id] = generateRandomChars(12);
    }

    this.storeOverlayPort(port);
    port.onDisconnect.addListener(this.handlePortOnDisconnect);
    port.onMessage.addListener(this.handleOverlayElementPortMessage);
    port.postMessage({
      command: `initAutofillInlineMenu${isInlineMenuListPort ? "List" : "Button"}`,
      iframeUrl: chrome.runtime.getURL(
        `overlay/menu-${isInlineMenuListPort ? "list" : "button"}.html`,
      ),
      pageTitle: chrome.i18n.getMessage(
        isInlineMenuListPort ? "bitwardenVault" : "bitwardenOverlayButton",
      ),
      authStatus: await this.getAuthStatus(),
      styleSheetUrl: chrome.runtime.getURL(
        `overlay/menu-${isInlineMenuListPort ? "list" : "button"}.css`,
      ),
      theme: await firstValueFrom(this.themeStateService.selectedTheme$),
      translations: this.getInlineMenuTranslations(),
      ciphers: isInlineMenuListPort ? await this.getInlineMenuCipherData() : null,
      // Cozy customization
      lastFilledContactCipherId: this.lastFilledContactCipherId,
      fieldQualifier: this.focusedFieldData?.fieldQualifier,
      fieldHtmlID: this.focusedFieldData?.fieldHtmlID,
      fieldValue: this.focusedFieldData?.fieldValue,
      // Cozy customization end
      portKey: this.portKeyForTab[port.sender.tab.id],
      portName: isInlineMenuListPort
        ? AutofillOverlayPort.ListMessageConnector
        : AutofillOverlayPort.ButtonMessageConnector,
      filledByCipherType: this.focusedFieldData?.filledByCipherType,
      showInlineMenuAccountCreation: this.showInlineMenuAccountCreation(),
      showPasskeysLabels: this.showPasskeysLabelsWithinInlineMenu,
    });
    this.updateInlineMenuPosition(
      {
        overlayElement: isInlineMenuListPort
          ? AutofillOverlayElement.List
          : AutofillOverlayElement.Button,
      },
      port.sender,
    ).catch((error) => this.logService.error(error));
  };

  /**
   * Stores the connected overlay port and sets up any existing ports to be disconnected.
   *
   * @param port - The port to store
|   */
  private storeOverlayPort(port: chrome.runtime.Port) {
    if (port.name === AutofillOverlayPort.List) {
      this.storeExpiredOverlayPort(this.inlineMenuListPort);
      this.inlineMenuListPort = port;
      return;
    }

    if (port.name === AutofillOverlayPort.Button) {
      this.storeExpiredOverlayPort(this.inlineMenuButtonPort);
      this.inlineMenuButtonPort = port;
    }
  }

  /**
   * When registering a new connection, we want to ensure that the port is disconnected.
   * This method places an existing port in the expiredPorts array to be disconnected
   * at a later time.
   *
   * @param port - The port to store in the expiredPorts array
   */
  private storeExpiredOverlayPort(port: chrome.runtime.Port | null) {
    if (port) {
      this.expiredPorts.push(port);
    }
  }

  /**
   * Handles messages sent to the overlay list or button ports.
   *
   * @param message - The message received from the port
   * @param port - The port that sent the message
   */
  private handleOverlayElementPortMessage = (
    message: OverlayBackgroundExtensionMessage,
    port: chrome.runtime.Port,
  ) => {
    const tabPortKey = this.portKeyForTab[port.sender.tab.id];
    if (!tabPortKey || tabPortKey !== message?.portKey) {
      return;
    }

    const command = message.command;
    let handler: CallableFunction | undefined;

    if (port.name === AutofillOverlayPort.ButtonMessageConnector) {
      handler = this.inlineMenuButtonPortMessageHandlers[command];
    }

    if (port.name === AutofillOverlayPort.ListMessageConnector) {
      handler = this.inlineMenuListPortMessageHandlers[command];
    }

    if (!handler) {
      return;
    }

    handler({ message, port });
  };

  /**
   * Ensures that the inline menu list and button port
   * references are reset when they are disconnected.
   *
   * @param port - The port that was disconnected
   */
  private handlePortOnDisconnect = (port: chrome.runtime.Port) => {
    if (port.name === AutofillOverlayPort.List) {
      this.inlineMenuListPort = null;
      this.isInlineMenuListVisible = false;
      this.inlineMenuPosition.list = null;
    }

    if (port.name === AutofillOverlayPort.Button) {
      this.inlineMenuButtonPort = null;
      this.isInlineMenuButtonVisible = false;
      this.inlineMenuPosition.button = null;
    }
  };
}
