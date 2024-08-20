import "@webcomponents/custom-elements";
import "lit/polyfill-support.js";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { EVENTS } from "@bitwarden/common/autofill/constants";
import { CipherType } from "@bitwarden/common/vault/enums";

import { InlineMenuCipherData } from "../../../../background/abstractions/overlay.background";
import {
  ambiguousContactFieldNames,
  bitwardenToCozy,
  buildSvgDomElement,
  getAmbiguousValueKey,
  makeAmbiguousValueLabel,
} from "../../../../utils";
import {
  backIcon,
  globeIcon,
  lockIcon,
  plusIcon,
  viewCipherIcon,
  magnifier,
} from "../../../../utils/svg-icons";
import {
  AutofillInlineMenuListWindowMessageHandlers,
  InitAutofillInlineMenuListMessage,
} from "../../abstractions/autofill-inline-menu-list";
import { AutofillInlineMenuPageElement } from "../shared/autofill-inline-menu-page-element";

/* start Cozy imports */
/* eslint-disable */
import uniqueId from "lodash/uniqueId";
import { AutofillFieldQualifierType } from "src/autofill/enums/autofill-field.enums";
import {
  AmbiguousContactFields,
  AmbiguousContactFieldValue,
  AmbiguousContactFieldName,
} from "src/autofill/types";
/* eslint-enable */
/* end Cozy imports */

export class AutofillInlineMenuList extends AutofillInlineMenuPageElement {
  private inlineMenuListContainer: HTMLDivElement;
  private resizeObserver: ResizeObserver;
  private eventHandlersMemo: { [key: string]: EventListener } = {};
  private ciphers: InlineMenuCipherData[] = [];
  private ciphersList: HTMLUListElement;
  private cipherListScrollIsDebounced = false;
  private cipherListScrollDebounceTimeout: number | NodeJS.Timeout;
  private currentCipherIndex = 0;
  private filledByCipherType: CipherType;
  // Cozy customization
  private lastFilledCipherId: string;
  private fieldQualifier: AutofillFieldQualifierType;
  private fieldValue: string;
  private fieldHtmlID: string;
  private contactSearchInputElement: HTMLInputElement;
  // Cozy customization end
  private showInlineMenuAccountCreation: boolean;
  private readonly showCiphersPerPage = 6;
  private newItemButtonElement: HTMLButtonElement;
  private readonly inlineMenuListWindowMessageHandlers: AutofillInlineMenuListWindowMessageHandlers =
    {
      initAutofillInlineMenuList: ({ message }) => this.initAutofillInlineMenuList(message),
      checkAutofillInlineMenuListFocused: () => this.checkInlineMenuListFocused(),
      updateAutofillInlineMenuListCiphers: ({ message }) =>
        this.updateListItems(
          message.ciphers,
          message.showInlineMenuAccountCreation,
          message.searchValue,
        ),
      ambiguousFieldList: ({ message }) =>
        this.ambiguousFieldList(
          message.inlineMenuCipherId,
          message.contactName,
          message.ambiguousFields,
          message.isFocusedFieldAmbigous,
          message.fieldHtmlIDToFill,
        ),
      focusAutofillInlineMenuList: () => this.focusInlineMenuList(),
    };

  constructor() {
    super();

    this.setupInlineMenuListGlobalListeners();
  }

  /**
   * Initializes the inline menu list and updates the list items with the passed ciphers.
   * If the auth status is not `Unlocked`, the locked inline menu is built.
   *
   * @param translations - The translations to use for the inline menu list.
   * @param styleSheetUrl - The URL of the stylesheet to use for the inline menu list.
   * @param theme - The theme to use for the inline menu list.
   * @param authStatus - The current authentication status.
   * @param ciphers - The ciphers to display in the inline menu list.
   * @param portKey - Background generated key that allows the port to communicate with the background.
   * @param filledByCipherType - The type of cipher that fills the current field.
   * @param showInlineMenuAccountCreation - Whether identity ciphers are shown on login fields.
   */
  private async initAutofillInlineMenuList({
    translations,
    styleSheetUrl,
    theme,
    authStatus,
    ciphers,
    portKey,
    filledByCipherType,
    showInlineMenuAccountCreation,
    // Cozy customization
    lastFilledCipherId,
    fieldQualifier,
    fieldHtmlID,
    fieldValue,
    // Cozy customization end
  }: InitAutofillInlineMenuListMessage) {
    const linkElement = await this.initAutofillInlineMenuPage(
      "list",
      styleSheetUrl,
      translations,
      portKey,
    );
    // Cozy customization
    this.lastFilledCipherId = lastFilledCipherId;
    this.fieldQualifier = fieldQualifier;
    this.fieldValue = fieldValue;
    this.fieldHtmlID = fieldHtmlID;
    // Cozy customization end

    this.filledByCipherType = filledByCipherType;

    const themeClass = `theme_${theme}`;
    globalThis.document.documentElement.classList.add(themeClass);

    this.inlineMenuListContainer = globalThis.document.createElement("div");
    this.inlineMenuListContainer.classList.add("inline-menu-list-container", themeClass);
    this.resizeObserver.observe(this.inlineMenuListContainer);

    this.shadowDom.append(linkElement, this.inlineMenuListContainer);

    if (authStatus === AuthenticationStatus.Unlocked) {
      this.updateListItems(ciphers, showInlineMenuAccountCreation);
      return;
    }

    this.buildLockedInlineMenu();
  }

  /**
   * Builds the locked inline menu, which is displayed when the user is not authenticated.
   * Facilitates the ability to unlock the extension from the inline menu.
   */
  private buildLockedInlineMenu() {
    const lockedInlineMenu = globalThis.document.createElement("div");
    lockedInlineMenu.id = "locked-inline-menu-description";
    lockedInlineMenu.classList.add("locked-inline-menu", "inline-menu-list-message");
    lockedInlineMenu.textContent = this.getTranslation("unlockYourAccount");

    const unlockButtonElement = globalThis.document.createElement("button");
    unlockButtonElement.id = "unlock-button";
    unlockButtonElement.tabIndex = -1;
    unlockButtonElement.classList.add(
      "unlock-button",
      "inline-menu-list-button",
      "inline-menu-list-action",
    );
    unlockButtonElement.textContent = this.getTranslation("unlockAccount");
    unlockButtonElement.setAttribute("aria-label", this.getTranslation("unlockAccountAria"));
    unlockButtonElement.prepend(buildSvgDomElement(lockIcon));
    unlockButtonElement.addEventListener(EVENTS.CLICK, this.handleUnlockButtonClick);

    const inlineMenuListButtonContainer = this.buildButtonContainer(unlockButtonElement);

    this.inlineMenuListContainer.append(lockedInlineMenu, inlineMenuListButtonContainer);
  }

  /**
   * Handles the click event for the unlock button.
   * Sends a message to the parent window to unlock the vault.
   */
  private handleUnlockButtonClick = () => {
    this.postMessageToParent({ command: "unlockVault" });
  };

  /**
   * Updates the list items with the passed ciphers.
   * If no ciphers are passed, the no results inline menu is built.
   *
   * @param ciphers - The ciphers to display in the inline menu list.
   * @param showInlineMenuAccountCreation - Whether identity ciphers are shown on login fields.
   */
  private updateListItems(
    ciphers: InlineMenuCipherData[],
    showInlineMenuAccountCreation?: boolean,
    searchValue?: string,
  ) {
    const isSearching = !!searchValue;
    // Cozy customization - Filter the contact ciphers by the search value or display all the ciphers
    const ciphersFiltered = isSearching
      ? ciphers.filter(
          (cipher) =>
            cipher.type === CipherType.Contact &&
            cipher.contact.fullName.toLowerCase().includes(searchValue.toLowerCase()),
        )
      : ciphers || [];

    // Sorting only required for contact list
    const isContactCipherList = ciphers?.every((cipher) => cipher.contact);
    this.ciphers = isContactCipherList
      ? ciphersFiltered.sort((a, b) => {
          return (
            Number(b.favorite) - Number(a.favorite) || Number(b.contact.me) - Number(a.contact.me)
          );
        })
      : ciphersFiltered;
    // Cozy customization end
    this.currentCipherIndex = 0;
    this.showInlineMenuAccountCreation = showInlineMenuAccountCreation;
    if (this.inlineMenuListContainer) {
      if (isSearching) {
        const children = Array.from(this.inlineMenuListContainer.childNodes);
        for (let i = 0; i < children.length; i++) {
          const child = children[i] as Element;
          if (!child.classList.contains("inline-menu-list-search-container")) {
            child.remove();
          }
        }
      } else {
        this.inlineMenuListContainer.innerHTML = "";
        this.inlineMenuListContainer.classList.remove(
          "inline-menu-list-container--with-new-item-button",
        );
      }
    }

    if (!this.ciphers?.length) {
      this.buildNoResultsInlineMenuList();
      return;
    }

    this.ciphersList = globalThis.document.createElement("ul");
    this.ciphersList.classList.add("inline-menu-list-actions");
    this.ciphersList.setAttribute("role", "list");
    this.ciphersList.addEventListener(EVENTS.SCROLL, this.handleCiphersListScrollEvent, {
      passive: true,
    });

    // On the contact ambiguous fields, if the field has a value, the corresponding menu is displayed directly.
    if (
      this.fieldValue &&
      ambiguousContactFieldNames.includes(bitwardenToCozy[this.fieldQualifier])
    ) {
      this.postMessageToParent({
        command: "handleContactClick",
        inlineMenuCipherId: this.lastFilledCipherId,
        lastFilledCipherId: this.lastFilledCipherId,
        fieldQualifier: this.fieldQualifier,
        fieldValue: this.fieldValue,
        fieldHtmlIDToFill: this.fieldHtmlID,
      });
    } else {
      this.loadPageOfCiphers();
    }

    if (isContactCipherList && !isSearching) {
      this.inlineMenuListContainer.appendChild(this.buildContactSearch());
      this.inlineMenuListContainer.classList.add(
        "inline-menu-list-container--with-new-item-button",
      );
    }

    this.inlineMenuListContainer.appendChild(this.ciphersList);
    this.toggleScrollClass();

    if (!this.showInlineMenuAccountCreation) {
      return;
    }

    const addNewLoginButtonContainer = this.buildNewItemButton();
    this.inlineMenuListContainer.appendChild(addNewLoginButtonContainer);
    this.inlineMenuListContainer.classList.add("inline-menu-list-container--with-new-item-button");
    this.newItemButtonElement.addEventListener(EVENTS.KEYUP, this.handleNewItemButtonKeyUpEvent);
  }

  private buildContactSearch() {
    const inputContainer = globalThis.document.createElement("div");
    inputContainer.classList.add("search-container");
    this.contactSearchInputElement = globalThis.document.createElement("input");
    this.contactSearchInputElement.type = "text";
    this.contactSearchInputElement.placeholder = this.getTranslation("contactSearch");
    this.contactSearchInputElement.tabIndex = -1;
    this.contactSearchInputElement.classList.add("contact-search-header");
    const iconElement = buildSvgDomElement(magnifier);
    iconElement.classList.add("search-icon");

    inputContainer.append(iconElement);
    inputContainer.append(this.contactSearchInputElement);

    this.contactSearchInputElement.addEventListener(EVENTS.KEYUP, this.handleNewSearch());

    return this.buildSearchContainer(inputContainer);
  }

  private buildSearchContainer(element: Element) {
    const inlineMenuListButtonContainer = globalThis.document.createElement("div");
    inlineMenuListButtonContainer.classList.add("inline-menu-list-search-container");
    inlineMenuListButtonContainer.appendChild(element);

    return inlineMenuListButtonContainer;
  }

  private handleNewSearch = () => {
    return this.useEventHandlersMemo(
      () =>
        this.postMessageToParent({
          command: "inlineMenuSearchContact",
          searchValue: this.contactSearchInputElement.value,
        }),
      `inline-menu-search-contact-handler`,
    );
  };

  /**
   * @param inlineMenuCipherId
   * @param contactName
   * @param ambiguousKey
   * @param ambiguousValue
   * @param isAmbiguousFieldFocused
   */
  private createAmbiguousListItem(
    inlineMenuCipherId: string,
    contactName: string,
    ambiguousKey: AmbiguousContactFieldName,
    ambiguousValue: AmbiguousContactFieldValue[0],
    isAmbiguousFieldFocused: boolean,
    fieldHtmlIDToFill: string,
  ) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const currentListItemValue = ambiguousValue[getAmbiguousValueKey(ambiguousKey)];

    const listItem = document.createElement("li");
    listItem.setAttribute("role", "listitem");
    listItem.classList.add("inline-menu-list-actions-item");

    const div = document.createElement("div");
    div.classList.add("cipher-container");

    const fillButton = document.createElement("button");
    fillButton.setAttribute("tabindex", "-1");
    fillButton.classList.add("fill-cipher-button", "inline-menu-list-action");
    fillButton.setAttribute("aria-label", contactName);
    fillButton.addEventListener(
      EVENTS.CLICK,
      this.handleFillCipherAmbiguousClickEvent(
        inlineMenuCipherId,
        ambiguousValue,
        fieldHtmlIDToFill,
        uniqueId(),
      ),
    );

    const isAlreadySelected =
      this.fieldValue && currentListItemValue.toLowerCase().includes(this.fieldValue.toLowerCase());
    const radio = document.createElement("input");
    radio.setAttribute("type", "radio");
    radio.setAttribute("name", "contact");
    radio.setAttribute("id", "contact");
    if (isAlreadySelected) {
      radio.setAttribute("checked", "true");
    }
    radio.style.marginRight = "2rem";

    const detailsSpan = document.createElement("span");
    detailsSpan.classList.add("cipher-details");

    const nameSpanText = makeAmbiguousValueLabel(
      ambiguousValue,
      isAmbiguousFieldFocused,
      this.getTranslation.bind(this),
    );
    const nameSpan = document.createElement("span");
    nameSpan.setAttribute("title", nameSpanText);
    nameSpan.textContent = nameSpanText;
    nameSpan.classList.add("cipher-name");

    const subNameSpan = document.createElement("span");
    subNameSpan.setAttribute("title", ambiguousKey);
    subNameSpan.classList.add("cipher-subtitle");

    // Reverse the class for the current ambiguous field
    if (bitwardenToCozy[this.fieldQualifier] === ambiguousKey) {
      subNameSpan.classList.replace("cipher-subtitle", "cipher-name");
      nameSpan.classList.replace("cipher-name", "cipher-subtitle");
    }
    subNameSpan.textContent = currentListItemValue;

    detailsSpan.appendChild(nameSpan);
    detailsSpan.appendChild(subNameSpan);
    fillButton.appendChild(radio);
    fillButton.appendChild(detailsSpan);

    div.appendChild(fillButton);
    listItem.appendChild(div);

    return listItem;
  }

  /**
   * @param contactName
   */
  private buildNewAmbiguousHeader(contactName: string) {
    this.newItemButtonElement = globalThis.document.createElement("button");
    this.newItemButtonElement.tabIndex = -1;
    this.newItemButtonElement.classList.add("inline-menu-list-ambiguous-header");

    const span = globalThis.document.createElement("span");
    span.textContent = contactName;
    span.setAttribute("title", contactName);
    span.classList.add("ambiguous-header-text");
    this.newItemButtonElement.setAttribute("aria-label", contactName);

    if (this.fieldValue) {
      this.newItemButtonElement.classList.add(
        "inline-menu-list-ambiguous-header--without-back-icon",
      );
    } else {
      this.newItemButtonElement.append(buildSvgDomElement(backIcon));
      this.newItemButtonElement.addEventListener(EVENTS.CLICK, this.handleNewAmbiguousHeaderClick);
    }
    this.newItemButtonElement.appendChild(span);

    return this.buildAmbiguousHeaderContainer(this.newItemButtonElement);
  }

  private handleNewAmbiguousHeaderClick = () => {
    this.updateListItems(this.ciphers);
  };

  /**
   * @param element
   */
  private buildAmbiguousHeaderContainer(element: Element) {
    const inlineMenuListButtonContainer = globalThis.document.createElement("div");
    inlineMenuListButtonContainer.classList.add("inline-menu-list-ambiguous-header-container");
    inlineMenuListButtonContainer.appendChild(element);

    return inlineMenuListButtonContainer;
  }

  // TODO Part_2 => Uncomment for next step
  // private createNewAmbiguousButton(inlineMenuCipherId: string, ambiguousKey: AmbiguousContactFieldName) {
  //   const listItem = document.createElement("li");
  //   listItem.setAttribute("role", "listitem");
  //   listItem.classList.add("inline-menu-list-actions-item");

  //   const div = document.createElement("div");
  //   div.classList.add("cipher-container");

  //   const fillButton = document.createElement("button");
  //   fillButton.setAttribute("tabindex", "-1");
  //   fillButton.classList.add("fill-cipher-button", "inline-menu-list-action");
  //   fillButton.setAttribute("aria-label", ambiguousKey);
  //   // TODO Part_2 => fillButton.addEventListener(EVENTS.CLICK, this.handleFillCipherAmbiguousClickEvent(inlineMenuCipherId, ambiguousValue, uniqueId()));

  //   const radio = document.createElement("input");
  //   radio.setAttribute("type", "radio");
  //   radio.setAttribute("name", "contact");
  //   radio.setAttribute("id", "contact");
  //   radio.style.marginRight = "2rem";

  //   const detailsSpan = document.createElement("span");
  //   detailsSpan.classList.add("cipher-details");

  //   const nameSpanText = `New ${ambiguousKey}`;
  //   const nameSpan = document.createElement("span");
  //   nameSpan.setAttribute("title", nameSpanText);
  //   nameSpan.textContent = nameSpanText;
  //   nameSpan.classList.add("cipher-name");

  //   detailsSpan.appendChild(nameSpan);
  //   fillButton.appendChild(radio);
  //   fillButton.appendChild(detailsSpan);
  //   div.appendChild(fillButton);
  //   listItem.appendChild(div);

  //   return listItem;
  // }

  /**
   * @param ambiguousKey
   */
  private createEmptyAmbiguousListItem(ambiguousKey: AmbiguousContactFieldName) {
    const listItem = document.createElement("li");
    listItem.setAttribute("role", "listitem");
    listItem.classList.add("inline-menu-list-actions-item", "disabled");

    const div = document.createElement("div");
    div.classList.add("cipher-container");

    const fillButton = document.createElement("button");
    fillButton.setAttribute("tabindex", "-1");
    fillButton.classList.add("fill-cipher-button", "inline-menu-list-action");
    fillButton.setAttribute("aria-label", this.getTranslation(`empty_ambiguous_${ambiguousKey}`));

    const radio = document.createElement("input");
    radio.setAttribute("type", "radio");
    radio.setAttribute("name", "contact");
    radio.setAttribute("id", "contact");
    radio.style.marginRight = "2rem";

    const detailsSpan = document.createElement("span");
    detailsSpan.classList.add("cipher-details");

    const nameSpanText = this.getTranslation(`empty_ambiguous_${ambiguousKey}`);
    const nameSpan = document.createElement("span");
    nameSpan.setAttribute("title", nameSpanText);
    nameSpan.textContent = nameSpanText;
    nameSpan.classList.add("cipher-name");

    detailsSpan.appendChild(nameSpan);
    fillButton.appendChild(radio);
    fillButton.appendChild(detailsSpan);
    div.appendChild(fillButton);
    listItem.appendChild(div);

    return listItem;
  }

  /**
   * @param inlineMenuCipherId
   * @param contactName
   * @param ambiguousFields
   * @param isAmbiguousFieldFocused
   */
  private ambiguousFieldList(
    inlineMenuCipherId: string,
    contactName: string,
    ambiguousFields: AmbiguousContactFields,
    isAmbiguousFieldFocused: boolean,
    fieldHtmlIDToFill: string,
  ) {
    this.inlineMenuListContainer.innerHTML = "";
    this.inlineMenuListContainer.classList.remove(
      "inline-menu-list-container--with-new-item-button",
    );

    const addNewLoginButtonContainer = this.buildNewAmbiguousHeader(contactName);

    const ulElement = globalThis.document.createElement("ul");
    ulElement.classList.add("inline-menu-list-actions");
    ulElement.setAttribute("role", "list");
    ulElement.addEventListener(EVENTS.SCROLL, this.handleCiphersListScrollEvent, {
      passive: true,
    });

    const firstAmbiguousFieldEntries = Object.entries(ambiguousFields)?.[0];
    const firstAmbiguousFieldName = firstAmbiguousFieldEntries?.[0] as AmbiguousContactFieldName; // || bitwardenToCozy[this.fieldQualifier]; // TODO Part_2 To add for next step, The contact has no value in an ambiguous focus form field

    if (firstAmbiguousFieldEntries) {
      for (const firstAmbiguousFieldValue of firstAmbiguousFieldEntries[1]) {
        const li = this.createAmbiguousListItem(
          inlineMenuCipherId,
          contactName,
          firstAmbiguousFieldName,
          firstAmbiguousFieldValue,
          isAmbiguousFieldFocused,
          fieldHtmlIDToFill,
        );
        ulElement.appendChild(li);
      }
    } else {
      const emptyLi = this.createEmptyAmbiguousListItem(firstAmbiguousFieldName);
      ulElement.appendChild(emptyLi);
    }
    // TODO Uncomment for next step, Add "New xxx" button for ambiguous field
    // if (isAmbiguousFieldFocused) {
    //   const newButton = this.createNewAmbiguousButton(inlineMenuCipherId, firstAmbiguousFieldName);
    //   ulElement.appendChild(newButton);
    // }

    this.inlineMenuListContainer.appendChild(addNewLoginButtonContainer);
    this.inlineMenuListContainer.appendChild(ulElement);

    this.inlineMenuListContainer.classList.add("inline-menu-list-container--with-new-item-button");
  }

  /**
   * @param inlineMenuCipherId
   * @param ambiguousValue
   * @param UID
   */
  private handleFillCipherAmbiguousClickEvent = (
    inlineMenuCipherId: string,
    ambiguousValue: AmbiguousContactFieldValue[0],
    fieldHtmlIDToFill: string,
    UID: string,
  ) => {
    return this.useEventHandlersMemo(
      () =>
        this.postMessageToParent({
          command: "fillAutofillInlineMenuCipherWithAmbiguousField",
          inlineMenuCipherId,
          ambiguousValue,
          fieldHtmlIDToFill,
        }),
      `${UID}-fill-cipher-button-click-handler`,
    );
  };

  /**
   * Inline menu view that is presented when no ciphers are found for a given page.
   * Facilitates the ability to add a new vault item from the inline menu.
   */
  private buildNoResultsInlineMenuList() {
    const noItemsMessage = globalThis.document.createElement("div");
    noItemsMessage.classList.add("no-items", "inline-menu-list-message");
    noItemsMessage.textContent = this.getTranslation("noItemsToShow");

    const newItemButton = this.buildNewItemButton();

    this.inlineMenuListContainer.append(noItemsMessage, newItemButton);
  }

  /**
   * Builds a "New Item" button and returns the container of that button.
   */
  private buildNewItemButton() {
    this.newItemButtonElement = globalThis.document.createElement("button");
    this.newItemButtonElement.tabIndex = -1;
    this.newItemButtonElement.id = "new-item-button";
    this.newItemButtonElement.classList.add(
      "add-new-item-button",
      "inline-menu-list-button",
      "inline-menu-list-action",
    );
    this.newItemButtonElement.textContent = this.getNewItemButtonText();
    this.newItemButtonElement.setAttribute("aria-label", this.getNewItemAriaLabel());
    this.newItemButtonElement.prepend(buildSvgDomElement(plusIcon));
    this.newItemButtonElement.addEventListener(EVENTS.CLICK, this.handeNewItemButtonClick);

    return this.buildButtonContainer(this.newItemButtonElement);
  }

  /**
   * Gets the new item text for the button based on the cipher type the focused field is filled by.
   */
  private getNewItemButtonText() {
    if (this.isFilledByLoginCipher() || this.showInlineMenuAccountCreation) {
      return this.getTranslation("newLogin");
    }

    if (this.isFilledByCardCipher()) {
      return this.getTranslation("newCard");
    }

    if (this.isFilledByIdentityCipher()) {
      return this.getTranslation("newIdentity");
    }

    return this.getTranslation("newItem");
  }

  /**
   * Gets the aria label for the new item button based on the cipher type the focused field is filled by.
   */
  private getNewItemAriaLabel() {
    if (this.isFilledByLoginCipher() || this.showInlineMenuAccountCreation) {
      return this.getTranslation("addNewLoginItem");
    }

    if (this.isFilledByCardCipher()) {
      return this.getTranslation("addNewCardItem");
    }

    if (this.isFilledByIdentityCipher()) {
      return this.getTranslation("addNewIdentityItem");
    }

    return this.getTranslation("addNewVaultItem");
  }

  /**
   * Builds a container for a given element.
   *
   * @param element - The element to build the container for.
   */
  private buildButtonContainer(element: Element) {
    const inlineMenuListButtonContainer = globalThis.document.createElement("div");
    inlineMenuListButtonContainer.classList.add("inline-menu-list-button-container");
    inlineMenuListButtonContainer.appendChild(element);

    return inlineMenuListButtonContainer;
  }

  /**
   * Handles the click event for the new item button.
   * Sends a message to the parent window to add a new vault item.
   */
  private handeNewItemButtonClick = () => {
    let addNewCipherType = this.filledByCipherType;

    if (this.showInlineMenuAccountCreation) {
      addNewCipherType = CipherType.Login;
    }
    if (this.isFilledByContactCipher()) {
      this.postMessageToParent({
        command: "redirectToCozy",
        to: "contacts",
        hash: "new",
      });
      return;
    }

    this.postMessageToParent({
      command: "addNewVaultItem",
      addNewCipherType,
    });
  };

  /**
   * Loads a page of ciphers into the inline menu list container.
   */
  private loadPageOfCiphers(filteredCiphers?: InlineMenuCipherData[]) {
    const ciphers = filteredCiphers || this.ciphers;
    if (filteredCiphers) {
      this.currentCipherIndex = 0;
      this.ciphersList.innerHTML = "";
    }
    const lastIndex = Math.min(this.currentCipherIndex + this.showCiphersPerPage, ciphers.length);

    for (let cipherIndex = this.currentCipherIndex; cipherIndex < lastIndex; cipherIndex++) {
      this.ciphersList.appendChild(this.buildInlineMenuListActionsItem(ciphers[cipherIndex]));
      this.currentCipherIndex++;
    }

    if (this.currentCipherIndex >= ciphers.length) {
      this.ciphersList.removeEventListener(EVENTS.SCROLL, this.handleCiphersListScrollEvent);
    }
  }

  /**
   * Handles updating the list of ciphers when the
   * user scrolls to the bottom of the list.
   */
  private handleCiphersListScrollEvent = () => {
    if (this.cipherListScrollIsDebounced) {
      return;
    }

    this.cipherListScrollIsDebounced = true;
    if (this.cipherListScrollDebounceTimeout) {
      clearTimeout(this.cipherListScrollDebounceTimeout);
    }
    this.cipherListScrollDebounceTimeout = globalThis.setTimeout(
      this.handleDebouncedScrollEvent,
      300,
    );
  };

  /**
   * Debounced handler for updating the list of ciphers when the user scrolls to
   * the bottom of the list. Triggers at most once every 300ms.
   */
  private handleDebouncedScrollEvent = () => {
    this.cipherListScrollIsDebounced = false;

    const scrollPercentage =
      (this.ciphersList.scrollTop /
        (this.ciphersList.scrollHeight - this.ciphersList.offsetHeight)) *
      100;
    if (scrollPercentage >= 80) {
      this.loadPageOfCiphers();
    }
  };

  /**
   * Builds the list item for a given cipher.
   *
   * @param cipher - The cipher to build the list item for.
   */
  private buildInlineMenuListActionsItem(cipher: InlineMenuCipherData) {
    const fillCipherElement = this.buildFillCipherElement(cipher);
    const viewCipherElement = this.buildViewCipherElement(cipher);

    const cipherContainerElement = globalThis.document.createElement("div");
    cipherContainerElement.classList.add("cipher-container");
    cipherContainerElement.append(fillCipherElement, viewCipherElement);

    const inlineMenuListActionsItem = globalThis.document.createElement("li");
    inlineMenuListActionsItem.setAttribute("role", "listitem");
    inlineMenuListActionsItem.classList.add("inline-menu-list-actions-item");
    inlineMenuListActionsItem.appendChild(cipherContainerElement);

    return inlineMenuListActionsItem;
  }

  /**
   * Builds the fill cipher button for a given cipher.
   * Wraps the cipher icon and details.
   *
   * @param cipher - The cipher to build the fill cipher button for.
   */
  private buildFillCipherElement(cipher: InlineMenuCipherData) {
    const cipherIcon = this.buildCipherIconElement(cipher);
    const cipherDetailsElement = this.buildCipherDetailsElement(cipher);

    const fillCipherElement = globalThis.document.createElement("button");
    fillCipherElement.tabIndex = -1;
    fillCipherElement.classList.add("fill-cipher-button", "inline-menu-list-action");
    fillCipherElement.setAttribute(
      "aria-label",
      `${this.getTranslation("fillCredentialsFor")} ${cipher.name}`,
    );
    this.addFillCipherElementAriaDescription(fillCipherElement, cipher);
    fillCipherElement.append(cipherIcon, cipherDetailsElement);
    fillCipherElement.addEventListener(EVENTS.CLICK, this.handleFillCipherClickEvent(cipher));
    fillCipherElement.addEventListener(EVENTS.KEYUP, this.handleFillCipherKeyUpEvent);

    return fillCipherElement;
  }

  /**
   * Adds an aria description to the fill cipher button for a given cipher.
   *
   * @param fillCipherElement - The fill cipher button element.
   * @param cipher - The cipher to add the aria description for.
   */
  private addFillCipherElementAriaDescription(
    fillCipherElement: HTMLButtonElement,
    cipher: InlineMenuCipherData,
  ) {
    if (cipher.login) {
      fillCipherElement.setAttribute(
        "aria-description",
        `${this.getTranslation("username")}: ${cipher.login.username}`,
      );
      return;
    }

    if (cipher.card) {
      const cardParts = cipher.card.split(", *");
      if (cardParts.length === 1) {
        const cardDigits = cardParts[0].startsWith("*") ? cardParts[0].substring(1) : cardParts[0];
        fillCipherElement.setAttribute(
          "aria-description",
          `${this.getTranslation("cardNumberEndsWith")} ${cardDigits}`,
        );
        return;
      }

      const cardBrand = cardParts[0];
      const cardDigits = cardParts[1];
      fillCipherElement.setAttribute(
        "aria-description",
        `${cardBrand}, ${this.getTranslation("cardNumberEndsWith")} ${cardDigits}`,
      );
    }
  }

  /**
   * Handles the click event for the fill cipher button.
   * Sends a message to the parent window to fill the selected cipher.
   *
   * @param cipher - The cipher to fill.
   */
  private handleFillCipherClickEvent = (cipher: InlineMenuCipherData) => {
    if (cipher.contact) {
      return this.useEventHandlersMemo(
        () =>
          this.postMessageToParent({
            command: "handleContactClick",
            inlineMenuCipherId: cipher.id,
            lastFilledCipherId: this.lastFilledCipherId,
            fieldQualifier: this.fieldQualifier,
            fieldValue: this.fieldValue,
          }),
        `${cipher.id}-fill-cipher-button-click-handler`,
      );
    }

    return this.useEventHandlersMemo(
      () =>
        this.postMessageToParent({
          command: "fillAutofillInlineMenuCipher",
          inlineMenuCipherId: cipher.id,
        }),
      `${cipher.id}-fill-cipher-button-click-handler`,
    );
  };

  /**
   * Handles the keyup event for the fill cipher button. Facilitates
   * selecting the next/previous cipher item on ArrowDown/ArrowUp. Also
   * facilitates moving keyboard focus to the view cipher button on ArrowRight.
   *
   * @param event - The keyup event.
   */
  private handleFillCipherKeyUpEvent = (event: KeyboardEvent) => {
    const listenedForKeys = new Set(["ArrowDown", "ArrowUp", "ArrowRight"]);
    if (!listenedForKeys.has(event.code) || !(event.target instanceof Element)) {
      return;
    }

    event.preventDefault();

    const currentListItem = event.target.closest(".inline-menu-list-actions-item") as HTMLElement;
    if (event.code === "ArrowDown") {
      this.focusNextListItem(currentListItem);
      return;
    }

    if (event.code === "ArrowUp") {
      this.focusPreviousListItem(currentListItem);
      return;
    }

    this.focusViewCipherButton(currentListItem, event.target as HTMLElement);
  };

  /**
   * Handles the keyup event for the "New Item" button. Allows for keyboard navigation
   * between ciphers elements if the other ciphers exist in the inline menu.
   *
   * @param event - The captured keyup event.
   */
  private handleNewItemButtonKeyUpEvent = (event: KeyboardEvent) => {
    const listenedForKeys = new Set(["ArrowDown", "ArrowUp"]);
    if (!listenedForKeys.has(event.code) || !(event.target instanceof Element)) {
      return;
    }

    if (event.code === "ArrowDown") {
      const firstFillButton = this.ciphersList.firstElementChild?.querySelector(
        ".fill-cipher-button",
      ) as HTMLButtonElement;
      firstFillButton?.focus();
      return;
    }

    const lastFillButton = this.ciphersList.lastElementChild?.querySelector(
      ".fill-cipher-button",
    ) as HTMLButtonElement;
    lastFillButton?.focus();
  };

  /**
   * Builds the button that facilitates viewing a cipher in the vault.
   *
   * @param cipher - The cipher to view.
   */
  private buildViewCipherElement(cipher: InlineMenuCipherData) {
    const viewCipherElement = globalThis.document.createElement("button");
    viewCipherElement.tabIndex = -1;
    viewCipherElement.classList.add("view-cipher-button");
    viewCipherElement.setAttribute(
      "aria-label",
      `${this.getTranslation("view")} ${cipher.name}, ${this.getTranslation("opensInANewWindow")}`,
    );
    viewCipherElement.append(buildSvgDomElement(viewCipherIcon));
    viewCipherElement.addEventListener(EVENTS.CLICK, this.handleViewCipherClickEvent(cipher));
    viewCipherElement.addEventListener(EVENTS.KEYUP, this.handleViewCipherKeyUpEvent);

    return viewCipherElement;
  }

  /**
   * Handles the click event for the view cipher button. Sends a
   * message to the parent window to view the selected cipher.
   *
   * @param cipher - The cipher to view.
   */
  private handleViewCipherClickEvent = (cipher: InlineMenuCipherData) => {
    return this.useEventHandlersMemo(
      () =>
        this.postMessageToParent({ command: "viewSelectedCipher", inlineMenuCipherId: cipher.id }),
      `${cipher.id}-view-cipher-button-click-handler`,
    );
  };

  /**
   * Handles the keyup event for the view cipher button. Facilitates
   * selecting the next/previous cipher item on ArrowDown/ArrowUp.
   * Also facilitates moving keyboard focus to the current fill
   * cipher button on ArrowLeft.
   *
   * @param event - The keyup event.
   */
  private handleViewCipherKeyUpEvent = (event: KeyboardEvent) => {
    const listenedForKeys = new Set(["ArrowDown", "ArrowUp", "ArrowLeft"]);
    if (!listenedForKeys.has(event.code) || !(event.target instanceof Element)) {
      return;
    }

    event.preventDefault();

    const currentListItem = event.target.closest(".inline-menu-list-actions-item") as HTMLElement;
    const cipherContainer = currentListItem.querySelector(".cipher-container") as HTMLElement;
    cipherContainer?.classList.remove("remove-outline");
    if (event.code === "ArrowDown") {
      this.focusNextListItem(currentListItem);
      return;
    }

    if (event.code === "ArrowUp") {
      this.focusPreviousListItem(currentListItem);
      return;
    }

    const previousSibling = event.target.previousElementSibling as HTMLElement;
    previousSibling?.focus();
  };

  /**
   * Builds the icon for a given cipher. Prioritizes the favicon from a given cipher url
   * and the default icon element within the extension. If neither are available, the
   * globe icon is used.
   *
   * @param cipher - The cipher to build the icon for.
   */
  private buildCipherIconElement(cipher: InlineMenuCipherData) {
    const cipherIcon = globalThis.document.createElement("span");
    cipherIcon.classList.add("cipher-icon");
    cipherIcon.setAttribute("aria-hidden", "true");

    // Cozy customization; add contact initials to autofill
    if (cipher.contact) {
      cipherIcon.classList.remove("cipher-icon");
      cipherIcon.classList.add("contact-initials");
      cipherIcon.style.backgroundColor = cipher.contact.initialsColor;
      cipherIcon.textContent = cipher.contact.initials;
      return cipherIcon;
    }
    // Cozy customization end

    if (cipher.icon?.image) {
      try {
        const url = new URL(cipher.icon.image);
        cipherIcon.style.backgroundImage = `url(${url.href})`;

        const dummyImageElement = globalThis.document.createElement("img");
        dummyImageElement.src = url.href;
        dummyImageElement.addEventListener("error", () => {
          cipherIcon.style.backgroundImage = "";
          const iconClasses = cipher.icon.icon.split(" ");
          cipherIcon.classList.add("cipher-icon", "bwi", ...iconClasses);
        });
        dummyImageElement.remove();

        return cipherIcon;
      } catch {
        // Silently default to the globe icon element if the image URL is invalid
      }
    }

    if (cipher.icon?.icon) {
      const iconClasses = cipher.icon.icon.split(" ");
      cipherIcon.classList.add("cipher-icon", "bwi", ...iconClasses);
      return cipherIcon;
    }

    cipherIcon.append(buildSvgDomElement(globeIcon));
    return cipherIcon;
  }

  /**
   * Builds the details for a given cipher. Includes the cipher name and subtitle.
   *
   * @param cipher - The cipher to build the details for.
   */
  private buildCipherDetailsElement(cipher: InlineMenuCipherData) {
    const cipherNameElement = this.buildCipherNameElement(cipher);
    const cipherSubtitleElement = this.buildCipherSubtitleElement(cipher);

    const cipherDetailsElement = globalThis.document.createElement("span");
    cipherDetailsElement.classList.add("cipher-details");
    if (cipherNameElement) {
      cipherDetailsElement.appendChild(cipherNameElement);
    }
    if (cipherSubtitleElement) {
      cipherDetailsElement.appendChild(cipherSubtitleElement);
    }

    return cipherDetailsElement;
  }

  /**
   * Builds the name element for a given cipher.
   *
   * @param cipher - The cipher to build the name element for.
   */
  private buildCipherNameElement(cipher: InlineMenuCipherData): HTMLSpanElement | null {
    if (!cipher.name) {
      return null;
    }

    const cipherNameElement = globalThis.document.createElement("span");
    cipherNameElement.classList.add("cipher-name");

    // Cozy customization, replace text of cipher name with contact name if available
    //*
    cipherNameElement.textContent = cipher.contact
      ? cipher.contact.me
        ? `${cipher.contact.fullName} (${this.getTranslation("cipherContactMe")})`
        : cipher.contact.fullName
      : cipher.name;
    /*/
    cipherNameElement.textContent = cipher.name;
    //*/

    cipherNameElement.setAttribute("title", cipher.name);

    return cipherNameElement;
  }

  /**
   * Builds the subtitle element for a given cipher.
   *
   * @param cipher - The cipher to build the username login element for.
   */
  private buildCipherSubtitleElement(cipher: InlineMenuCipherData): HTMLSpanElement | null {
    const subTitleText = this.getSubTitleText(cipher);
    if (!subTitleText) {
      return null;
    }

    const cipherSubtitleElement = globalThis.document.createElement("span");
    cipherSubtitleElement.classList.add("cipher-subtitle");
    cipherSubtitleElement.textContent = subTitleText;
    cipherSubtitleElement.setAttribute("title", subTitleText);

    return cipherSubtitleElement;
  }

  /**
   * Gets the subtitle text for a given cipher.
   *
   * @param cipher - The cipher to get the subtitle text for.
   */
  private getSubTitleText(cipher: InlineMenuCipherData): string {
    if (cipher.identity?.username) {
      return cipher.identity.username;
    }

    if (cipher.identity?.fullName) {
      return cipher.identity.fullName;
    }

    if (cipher.login?.username) {
      return cipher.login.username;
    }

    if (cipher.card) {
      return cipher.card;
    }

    return "";
  }

  /**
   * Validates whether the inline menu list iframe is currently focused.
   * If not focused, will check if the button element is focused.
   */
  private checkInlineMenuListFocused() {
    if (globalThis.document.hasFocus() || this.inlineMenuListContainer.matches(":hover")) {
      return;
    }

    this.postMessageToParent({ command: "checkAutofillInlineMenuButtonFocused" });
  }

  /**
   * Focuses the inline menu list iframe. The element that receives focus is
   * determined by the presence of the unlock button, new item button, or
   * the first cipher button.
   */
  private focusInlineMenuList() {
    this.inlineMenuListContainer.setAttribute("role", "dialog");
    this.inlineMenuListContainer.setAttribute("aria-modal", "true");

    const unlockButtonElement = this.inlineMenuListContainer.querySelector(
      "#unlock-button",
    ) as HTMLElement;
    if (unlockButtonElement) {
      unlockButtonElement.focus();
      return;
    }

    const firstListElement = this.inlineMenuListContainer.querySelector(
      ".inline-menu-list-action",
    ) as HTMLElement;
    firstListElement?.focus();
  }

  /**
   * Sets up the global listeners for the inline menu list iframe.
   */
  private setupInlineMenuListGlobalListeners() {
    this.setupGlobalListeners(this.inlineMenuListWindowMessageHandlers);

    this.resizeObserver = new ResizeObserver(this.handleResizeObserver);
  }

  /**
   * Handles the resize observer event. Facilitates updating the height of the
   * inline menu list iframe when the height of the list changes.
   *
   * @param entries - The resize observer entries.
   */
  private handleResizeObserver = (entries: ResizeObserverEntry[]) => {
    for (let entryIndex = 0; entryIndex < entries.length; entryIndex++) {
      const entry = entries[entryIndex];
      if (entry.target !== this.inlineMenuListContainer) {
        continue;
      }

      const { height } = entry.contentRect;
      this.toggleScrollClass(height);
      this.postMessageToParent({
        command: "updateAutofillInlineMenuListHeight",
        styles: { height: `${height}px` },
      });
      break;
    }
  };

  /**
   * Toggles the scrollbar class on the inline menu list actions container.
   *
   * @param height - The height of the inline menu list actions container.
   */
  private toggleScrollClass = (height?: number) => {
    if (!this.ciphersList) {
      return;
    }
    const scrollbarClass = "inline-menu-list-actions--scrollbar";

    let containerHeight = height;
    if (!containerHeight) {
      const inlineMenuListContainerRects = this.inlineMenuListContainer.getBoundingClientRect();
      containerHeight = inlineMenuListContainerRects.height;
    }

    if (containerHeight >= 170) {
      this.ciphersList.classList.add(scrollbarClass);
      return;
    }

    this.ciphersList.classList.remove(scrollbarClass);
  };

  /**
   * Establishes a memoized event handler for a given event.
   *
   * @param eventHandler - The event handler to memoize.
   * @param memoIndex - The memo index to use for the event handler.
   */
  private useEventHandlersMemo = (eventHandler: EventListener, memoIndex: string) => {
    return this.eventHandlersMemo[memoIndex] || (this.eventHandlersMemo[memoIndex] = eventHandler);
  };

  /**
   * Focuses the next list item in the inline menu list. If the current list item is the last
   * item in the list, the first item is focused.
   *
   * @param currentListItem - The current list item.
   */
  private focusNextListItem(currentListItem: HTMLElement) {
    const nextListItem = currentListItem.nextSibling as HTMLElement;
    const nextSibling = nextListItem?.querySelector(".inline-menu-list-action") as HTMLElement;
    if (nextSibling) {
      nextSibling.focus();
      return;
    }

    if (this.newItemButtonElement) {
      this.newItemButtonElement.focus();
      return;
    }

    const firstListItem = currentListItem.parentElement?.firstChild as HTMLElement;
    const firstSibling = firstListItem?.querySelector(".inline-menu-list-action") as HTMLElement;
    firstSibling?.focus();
  }

  /**
   * Focuses the previous list item in the inline menu list. If the current list item is the first
   * item in the list, the last item is focused.
   *
   * @param currentListItem - The current list item.
   */
  private focusPreviousListItem(currentListItem: HTMLElement) {
    const previousListItem = currentListItem.previousSibling as HTMLElement;
    const previousSibling = previousListItem?.querySelector(
      ".inline-menu-list-action",
    ) as HTMLElement;
    if (previousSibling) {
      previousSibling.focus();
      return;
    }

    if (this.newItemButtonElement) {
      this.newItemButtonElement.focus();
      return;
    }

    const lastListItem = currentListItem.parentElement?.lastChild as HTMLElement;
    const lastSibling = lastListItem?.querySelector(".inline-menu-list-action") as HTMLElement;
    lastSibling?.focus();
  }

  /**
   * Focuses the view cipher button relative to the current fill cipher button.
   *
   * @param currentListItem - The current list item.
   * @param currentButtonElement - The current button element.
   */
  private focusViewCipherButton(currentListItem: HTMLElement, currentButtonElement: HTMLElement) {
    const cipherContainer = currentListItem.querySelector(".cipher-container") as HTMLElement;
    cipherContainer.classList.add("remove-outline");

    const nextSibling = currentButtonElement.nextElementSibling as HTMLElement;
    nextSibling?.focus();
  }

  /**
   * Identifies if the current focused field is filled by a login cipher.
   */
  private isFilledByLoginCipher = () => {
    return this.filledByCipherType === CipherType.Login;
  };

  /**
   * Identifies if the current focused field is filled by a card cipher.
   */
  private isFilledByCardCipher = () => {
    return this.filledByCipherType === CipherType.Card;
  };

  /**
   * Identifies if the current focused field is filled by an identity cipher.
   */
  private isFilledByIdentityCipher = () => {
    return this.filledByCipherType === CipherType.Identity;
  };

  /**
   * Identifies if the current focused field is filled by an contact cipher.
   */
  private isFilledByContactCipher = () => {
    return this.filledByCipherType === CipherType.Contact;
  };
}
