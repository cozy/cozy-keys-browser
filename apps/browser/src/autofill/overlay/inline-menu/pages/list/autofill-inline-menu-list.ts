import "@webcomponents/custom-elements";
import "lit/polyfill-support.js";

import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { EVENTS, UPDATE_PASSKEYS_HEADINGS_ON_SCROLL } from "@bitwarden/common/autofill/constants";
import { CipherType } from "@bitwarden/common/vault/enums";

import { InlineMenuCipherData } from "../../../../background/abstractions/overlay.background";
import { InlineMenuFillTypes } from "../../../../enums/autofill-overlay.enum";
import {
  addressFieldNames,
  ambiguousContactFieldNames,
  getAmbiguousValueKey,
  makeAmbiguousValueLabel,
  makeEditContactField,
  makeEditContactSelectElement,
  buildSvgDomElement,
  specialCharacterToKeyMap,
  throttle,
} from "../../../../utils";
import {
  backIcon,
  creditCardIcon,
  globeIcon,
  idCardIcon,
  lockIcon,
  passkeyIcon,
  plusIcon,
  viewCipherIcon,
  magnifier,
  contact,
  address,
  penIcon,
  fillFieldIcon,
  fillMultipleFieldsIcon,
  ellipsisIcon,
  cozyContactIcon,
  keyIcon,
  refreshIcon,
  spinnerIcon,
} from "../../../../utils/svg-icons";
import {
  AutofillInlineMenuListWindowMessageHandlers,
  EditContactButtonsParams,
  InitAutofillInlineMenuListMessage,
  InputRef,
  InputRefValue,
  InputValues,
  UpdateAutofillInlineMenuGeneratedPasswordMessage,
  UpdateAutofillInlineMenuListCiphersParams,
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
  AvailablePapers,
  AddressContactSubFieldName,
  ActionMenuData,
  isContactActionMenuData,
} from "../../../../../autofill/types";
import {
  COZY_ATTRIBUTES_MAPPING,
  cozypaperFieldNames,
  isPaperAttributesModel,
} from "../../../../../../../../libs/cozy/mapping";
import { CozyAutofillOptions } from "src/autofill/services/abstractions/autofill.service";
/* eslint-enable */
/* end Cozy imports */

export class AutofillInlineMenuList extends AutofillInlineMenuPageElement {
  private inlineMenuListContainer: HTMLDivElement;
  private passwordGeneratorContainer: HTMLDivElement;
  private resizeObserver: ResizeObserver;
  private eventHandlersMemo: { [key: string]: EventListener } = {};
  private ciphers: InlineMenuCipherData[] = [];
  private ciphersList: HTMLUListElement;
  private cipherListScrollIsDebounced = false;
  private cipherListScrollDebounceTimeout: number | NodeJS.Timeout;
  private currentCipherIndex = 0;
  private inlineMenuFillType: InlineMenuFillTypes;
  // Cozy customization
  private lastFilledContactCipherId: string;
  private fieldQualifier: AutofillFieldQualifierType;
  private fieldValue: string;
  private fieldHtmlID: string;
  private contactSearchInputElement: HTMLInputElement;
  private isSearchFocused = false;
  // Cozy customization end
  private showInlineMenuAccountCreation: boolean;
  private showPasskeysLabels: boolean;
  private newItemButtonElement: HTMLButtonElement;
  private passkeysHeadingElement: HTMLLIElement;
  private loginHeadingElement: HTMLLIElement;
  private lastPasskeysListItem: HTMLLIElement;
  private passkeysHeadingHeight: number;
  private lastPasskeysListItemHeight: number;
  private ciphersListHeight: number;
  private isPasskeyAuthInProgress = false;
  private authStatus: AuthenticationStatus;
  private readonly showCiphersPerPage = 6;
  private readonly headingBorderClass = "inline-menu-list-heading--bordered";
  private readonly inlineMenuListWindowMessageHandlers: AutofillInlineMenuListWindowMessageHandlers =
    {
      ambiguousFieldList: ({ message }) =>
        this.ambiguousFieldList(
          message.inlineMenuCipherId,
          message.contactName,
          message.ambiguousFields,
          message.isFocusedFieldAmbigous,
          message.fieldHtmlIDToFill,
        ),
      paperList: ({ message }) =>
        this.paperList(
          message.inlineMenuCipherId,
          message.contactName,
          message.availablePapers,
          message.fieldHtmlIDToFill,
        ),
      loadPageOfCiphers: () => this.loadPageOfCiphers(),
      initAutofillInlineMenuList: ({ message }) => this.initAutofillInlineMenuList(message),
      checkAutofillInlineMenuListFocused: () => this.checkInlineMenuListFocused(),
      updateAutofillInlineMenuListCiphers: ({ message }) => this.updateListItems(message),
      updateAutofillInlineMenuGeneratedPassword: ({ message }) =>
        this.handleUpdateAutofillInlineMenuGeneratedPassword(message),
      showSaveLoginInlineMenuList: () => this.handleShowSaveLoginInlineMenuList(),
      focusAutofillInlineMenuList: () => this.focusInlineMenuList(),
      createEmptyNameList: ({ message }) =>
        this.createEmptyNameList(
          message.inlineMenuCipherId,
          message.contactName,
          message.fieldHtmlIDToFill,
          message.focusedFieldName,
        ),
    };

  constructor() {
    super();

    this.setupInlineMenuListGlobalListeners();
  }

  private editCozyContactAddressFields(inlineMenuCipherId: string, contactName: string) {
    const addressFieldsPrimary = [
      {
        key: "number",
        fieldQualifier: "addressNumber",
      },
      {
        key: "street",
        fieldQualifier: "identityAddress1",
      },
      {
        key: "code",
        fieldQualifier: "identityPostalCode",
      },
      {
        key: "city",
        fieldQualifier: "identityCity",
      },
    ];

    const hiddenContactAddressFields = [
      {
        key: "locality",
        fieldQualifier: "addressLocality",
      },
      {
        key: "floor",
        fieldQualifier: "addressFloor",
      },
      {
        key: "building",
        fieldQualifier: "addressBuilding",
      },
      {
        key: "stairs",
        fieldQualifier: "addressStairs",
      },
      {
        key: "apartment",
        fieldQualifier: "addressApartment",
      },
      {
        key: "entrycode",
        fieldQualifier: "addressEntrycode",
      },
      {
        key: "country",
        fieldQualifier: "identityCountry",
      },
    ];

    this.inlineMenuListContainer.innerHTML = "";
    this.inlineMenuListContainer.classList.remove(
      "inline-menu-list-container--with-new-item-button",
    );
    const editContainer = globalThis.document.createElement("div");
    editContainer.classList.add("contact-edit-container");

    const addNewAmbiguousHeader = this.buildNewListHeader(contactName, this.backToCipherList);

    const inputTextContainer = document.createElement("div");
    inputTextContainer.classList.add("contact-edit-input-container");

    const iconElement = buildSvgDomElement(address);
    iconElement.classList.add("contact-edit-icon");
    inputTextContainer.appendChild(iconElement);

    const inputRefs: InputRef[] = [];
    for (const field of addressFieldsPrimary) {
      const labelGroup = document.createElement("div");
      labelGroup.classList.add("contact-edit-input-label-group");
      const labelElement = document.createElement("label");
      labelElement.htmlFor = field.key;
      labelElement.textContent = this.getTranslation(`address_${field.key}`);
      labelGroup.appendChild(labelElement);

      const inputText = document.createElement("input");
      inputText.classList.add("contact-edit-input");
      inputText.type = "text";
      inputText.id = field.key;

      labelGroup.appendChild(inputText);
      inputTextContainer.appendChild(labelGroup);

      const inputRef = {
        key: field.key,
        element: inputText,
        fieldQualifier: field.fieldQualifier,
      } as InputRef;
      inputRefs.push(inputRef);
    }
    editContainer.appendChild(inputTextContainer);

    const labelGroup = document.createElement("div");
    labelGroup.classList.add("input-group-select");

    const labelElement = document.createElement("label");
    labelElement.textContent = this.getTranslation("label");
    labelGroup.appendChild(labelElement);

    const selectElement = makeEditContactSelectElement(
      this.fieldQualifier,
      this.getTranslation.bind(this),
    );

    labelGroup.appendChild(selectElement);
    editContainer.appendChild(labelGroup);

    const inputTextContainer2 = document.createElement("div");
    inputTextContainer2.classList.add(
      "contact-edit-input-container",
      "contact-edit-input-container--hidden",
    );
    for (const subField of hiddenContactAddressFields) {
      const labelGroup = document.createElement("div");
      labelGroup.classList.add(
        "contact-edit-input-label-group",
        "contact-edit-input-label-group--subfield",
      );
      const labelElement = document.createElement("label");
      labelElement.htmlFor = subField.key;
      labelElement.textContent = this.getTranslation(`address_${subField.key}`);
      labelGroup.appendChild(labelElement);

      const inputText = document.createElement("input");
      inputText.classList.add("contact-edit-input");
      inputText.type = "text";
      inputText.id = subField.key;

      labelGroup.appendChild(inputText);
      inputTextContainer2.appendChild(labelGroup);

      const inputRef = {
        key: subField.key,
        element: inputText,
        fieldQualifier: subField.fieldQualifier,
      } as InputRef;
      inputRefs.push(inputRef);
    }
    editContainer.appendChild(inputTextContainer2);

    const addressDetailsButton = document.createElement("button");
    addressDetailsButton.textContent = this.getTranslation("addressDetails");
    addressDetailsButton.classList.add("contact-address-details-button");
    addressDetailsButton.addEventListener(EVENTS.CLICK, () => {
      addressDetailsButton.classList.add("contact-address-details-button--hidden");
      inputTextContainer2.classList.remove("contact-edit-input-container--hidden");
    });
    editContainer.appendChild(addressDetailsButton);

    const divider = document.createElement("div");
    divider.classList.add("contact-edit-divider");

    const buttons = this.editCozyDoctypeButtons({
      inlineMenuCipherId,
      selectElement,
      inputRefs,
    });

    // Necessary for the bottom margin of “buttons” to be interpreted
    const necessaryStyleElement = document.createElement("div");
    necessaryStyleElement.style.height = "1px";

    this.inlineMenuListContainer.appendChild(addNewAmbiguousHeader);
    this.inlineMenuListContainer.appendChild(editContainer);
    this.inlineMenuListContainer.appendChild(divider);
    this.inlineMenuListContainer.appendChild(buttons);
    this.inlineMenuListContainer.appendChild(necessaryStyleElement);
  }

  private editCozyDoctypeFields(
    inlineMenuCipherId: string,
    contactName: string,
    fieldHtmlIDToFill?: string,
  ) {
    // if the field is an address or an address subfield
    if (
      COZY_ATTRIBUTES_MAPPING[this.fieldQualifier].path === "address" ||
      addressFieldNames.includes(
        // Compare with "path" for "address" fields
        COZY_ATTRIBUTES_MAPPING[this.fieldQualifier].path as AddressContactSubFieldName,
      )
    ) {
      return this.editCozyContactAddressFields(inlineMenuCipherId, contactName);
    }

    this.inlineMenuListContainer.innerHTML = "";
    this.inlineMenuListContainer.classList.remove(
      "inline-menu-list-container--with-new-item-button",
    );

    const editContainer = globalThis.document.createElement("div");
    editContainer.classList.add("contact-edit-container");

    const addNewAmbiguousHeader = this.buildNewListHeader(contactName, this.backToCipherList);

    const { inputTextContainer, inputText } = makeEditContactField(
      this.fieldQualifier,
      this.getTranslation.bind(this),
    );
    editContainer.appendChild(inputTextContainer);

    let selectElement: HTMLSelectElement | null = null;
    if (
      ambiguousContactFieldNames.includes(
        // Compare with "path" for "address" fields
        COZY_ATTRIBUTES_MAPPING[this.fieldQualifier].path as AmbiguousContactFieldName,
      )
    ) {
      const labelGroup = document.createElement("div");
      labelGroup.classList.add("input-group-select");

      const labelElement = document.createElement("label");
      labelElement.textContent = this.getTranslation("label");
      labelGroup.appendChild(labelElement);

      selectElement = makeEditContactSelectElement(
        this.fieldQualifier,
        this.getTranslation.bind(this),
      );

      labelGroup.appendChild(selectElement);
      editContainer.appendChild(labelGroup);
    }

    const divider = document.createElement("div");
    divider.classList.add("contact-edit-divider");

    // Compare with "path" for "address" fields
    const inputRefs = [
      {
        key: COZY_ATTRIBUTES_MAPPING[this.fieldQualifier].path,
        element: inputText,
        fieldQualifier: this.fieldQualifier,
      },
    ] as InputRef[];

    const buttons = this.editCozyDoctypeButtons({
      inlineMenuCipherId,
      fieldHtmlIDToFill,
      fieldQualifier: this.fieldQualifier,
      selectElement,
      inputRefs,
    });

    // Necessary for the bottom margin of “buttons” to be interpreted
    const necessaryStyleElement = document.createElement("div");
    necessaryStyleElement.style.height = "1px";

    this.inlineMenuListContainer.appendChild(addNewAmbiguousHeader);
    this.inlineMenuListContainer.appendChild(editContainer);
    this.inlineMenuListContainer.appendChild(divider);
    this.inlineMenuListContainer.appendChild(buttons);
    this.inlineMenuListContainer.appendChild(necessaryStyleElement);

    // Focus the input text and select the text if there is a value
    inputText.focus();
    if (this.fieldValue) {
      inputText.value = this.fieldValue;
      inputText.select();
    }
  }

  private editCozyDoctypeButtons({
    inlineMenuCipherId,
    fieldHtmlIDToFill,
    fieldQualifier,
    selectElement,
    inputRefs,
  }: EditContactButtonsParams) {
    const buttonContainer = document.createElement("div");
    buttonContainer.classList.add("contact-edit-buttons");

    const cancelButton = document.createElement("button");
    cancelButton.textContent = this.getTranslation("cancel");
    cancelButton.classList.add("contact-edit-button", "contact-edit-button-cancel");
    cancelButton.addEventListener(EVENTS.CLICK, () => {
      this.updateListItems({ ciphers: this.ciphers });
    });

    const saveButton = document.createElement("button");
    saveButton.textContent = this.getTranslation("save");
    saveButton.classList.add("contact-edit-button", "contact-edit-button-save");
    saveButton.addEventListener(EVENTS.CLICK, () => {
      const hasValue = inputRefs?.some((data) => data.element.value);
      if (!hasValue) {
        return;
      }

      // Get the values from the inputs
      let inputValues = {
        values: [] as InputRefValue[],
      };
      for (const input of inputRefs) {
        inputValues.values.push({
          key: input.key,
          value: input.element.value,
          fieldQualifier: input.fieldQualifier,
        });
      }

      if (selectElement) {
        inputValues = {
          ...inputValues,
          // Get type & label from the select element
          ...(selectElement && JSON.parse(selectElement.value)),
        };
      }

      this.handleSaveCozyDoctypeCipherEvent(
        inlineMenuCipherId,
        fieldHtmlIDToFill,
        fieldQualifier,
        inputValues,
      );
    });

    buttonContainer.appendChild(cancelButton);
    buttonContainer.appendChild(saveButton);

    return buttonContainer;
  }

  private handleSaveCozyDoctypeCipherEvent = (
    inlineMenuCipherId: string,
    fieldHtmlIDToFill: string,
    fieldQualifier: string,
    inputValues: InputValues,
  ) => {
    return this.postMessageToParent({
      command: "saveFieldToCozyDoctype",
      inlineMenuCipherId,
      fieldQualifier,
      inputValues,
      fieldHtmlIDToFill,
    });
  };

  /**
   * Initializes the inline menu list and updates the list items with the passed ciphers.
   * If the auth status is not `Unlocked`, the locked inline menu is built.
   *
   * @param message - The message containing the data to initialize the inline menu list.
   */
  private async initAutofillInlineMenuList(message: InitAutofillInlineMenuListMessage) {
    const {
      // Cozy customization
      lastFilledContactCipherId,
      fieldQualifier,
      fieldHtmlID,
      fieldValue,
      // Cozy customization end
      translations,
      styleSheetUrl,
      theme,
      authStatus,
      ciphers,
      portKey,
      inlineMenuFillType,
      showInlineMenuAccountCreation,
      showPasskeysLabels,
      generatedPassword,
      showSaveLoginMenu,
    } = message;
    const linkElement = await this.initAutofillInlineMenuPage(
      "list",
      styleSheetUrl,
      translations,
      portKey,
    );
    // Cozy customization
    this.lastFilledContactCipherId = lastFilledContactCipherId;
    this.fieldQualifier = fieldQualifier;
    this.fieldValue = fieldValue;
    this.fieldHtmlID = fieldHtmlID;
    // Cozy customization end

    this.authStatus = authStatus;
    this.inlineMenuFillType = inlineMenuFillType;
    this.showPasskeysLabels = showPasskeysLabels;

    const themeClass = `theme_${theme}`;
    globalThis.document.documentElement.classList.add(themeClass);

    this.inlineMenuListContainer = globalThis.document.createElement("div");
    this.inlineMenuListContainer.classList.add("inline-menu-list-container", themeClass);
    this.resizeObserver.observe(this.inlineMenuListContainer);

    this.shadowDom.append(linkElement, this.inlineMenuListContainer);

    if (authStatus !== AuthenticationStatus.Unlocked) {
      this.buildLockedInlineMenu();
      return;
    }

    if (showSaveLoginMenu) {
      this.buildSaveLoginInlineMenuList();
      return;
    }

    if (generatedPassword) {
      this.buildPasswordGenerator(generatedPassword);
      return;
    }

    this.updateListItems({
      ciphers,
      showInlineMenuAccountCreation,
    });
  }

  /**
   * Builds the locked inline menu, which is displayed when the user is not authenticated.
   * Facilitates the ability to unlock the extension from the inline menu.
   */
  private buildLockedInlineMenu() {
    const lockedInlineMenu = globalThis.document.createElement("div");
    lockedInlineMenu.id = "locked-inline-menu-description";
    lockedInlineMenu.classList.add("locked-inline-menu", "inline-menu-list-message");
    lockedInlineMenu.textContent = this.getTranslation(
      "unlockYourAccountToViewAutofillSuggestions",
    );

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
   * Builds the inline menu list as a prompt that asks the user if they'd like to save the login data.
   */
  private buildSaveLoginInlineMenuList() {
    const saveLoginMessage = globalThis.document.createElement("div");
    saveLoginMessage.classList.add("save-login", "inline-menu-list-message");
    saveLoginMessage.textContent = this.getTranslation("saveLoginToBitwarden");

    const newItemButton = this.buildNewItemButton(true);
    this.showInlineMenuAccountCreation = true;

    this.inlineMenuListContainer.append(saveLoginMessage, newItemButton);
  }

  /**
   * Handles the show save login inline menu list message that is triggered from the background script.
   */
  private handleShowSaveLoginInlineMenuList() {
    if (this.authStatus === AuthenticationStatus.Unlocked) {
      this.resetInlineMenuContainer();
      this.buildSaveLoginInlineMenuList();
    }
  }

  /**
   * Handles the click event for the unlock button.
   * Sends a message to the parent window to unlock the vault.
   */
  private handleUnlockButtonClick = () => {
    this.postMessageToParent({ command: "unlockVault" });
  };

  /**
   * Builds the password generator within the inline menu.
   *
   * @param generatedPassword - The generated password to display.
   */
  private buildPasswordGenerator(generatedPassword: string) {
    this.passwordGeneratorContainer = globalThis.document.createElement("div");
    this.passwordGeneratorContainer.classList.add("password-generator-container");

    const passwordGeneratorActions = globalThis.document.createElement("div");
    passwordGeneratorActions.classList.add("password-generator-actions");

    const fillGeneratedPasswordButton = globalThis.document.createElement("button");
    fillGeneratedPasswordButton.tabIndex = -1;
    fillGeneratedPasswordButton.classList.add(
      "fill-generated-password-button",
      "inline-menu-list-action",
    );
    fillGeneratedPasswordButton.setAttribute(
      "aria-label",
      this.getTranslation("fillGeneratedPassword"),
    );

    const passwordGeneratorHeading = globalThis.document.createElement("div");
    passwordGeneratorHeading.classList.add("password-generator-heading");
    passwordGeneratorHeading.textContent = this.getTranslation("fillGeneratedPassword");

    const passwordGeneratorContent = globalThis.document.createElement("div");
    passwordGeneratorContent.id = "password-generator-content";
    passwordGeneratorContent.classList.add("password-generator-content");
    passwordGeneratorContent.append(
      passwordGeneratorHeading,
      this.buildColorizedPasswordElement(generatedPassword),
    );

    fillGeneratedPasswordButton.append(buildSvgDomElement(keyIcon), passwordGeneratorContent);
    fillGeneratedPasswordButton.addEventListener(
      EVENTS.CLICK,
      this.handleFillGeneratedPasswordClick,
    );
    fillGeneratedPasswordButton.addEventListener(
      EVENTS.KEYUP,
      this.handleFillGeneratedPasswordKeyUp,
    );

    const refreshGeneratedPasswordButton = globalThis.document.createElement("button");
    refreshGeneratedPasswordButton.tabIndex = -1;
    refreshGeneratedPasswordButton.classList.add(
      "refresh-generated-password-button",
      "inline-menu-list-action",
    );
    refreshGeneratedPasswordButton.setAttribute(
      "aria-label",
      this.getTranslation("regeneratePassword"),
    );
    refreshGeneratedPasswordButton.appendChild(buildSvgDomElement(refreshIcon));
    refreshGeneratedPasswordButton.addEventListener(
      EVENTS.CLICK,
      this.handleRefreshGeneratedPasswordClick,
    );
    refreshGeneratedPasswordButton.addEventListener(
      EVENTS.KEYUP,
      this.handleRefreshGeneratedPasswordKeyUp,
    );

    passwordGeneratorActions.append(fillGeneratedPasswordButton, refreshGeneratedPasswordButton);

    this.passwordGeneratorContainer.appendChild(passwordGeneratorActions);
    this.inlineMenuListContainer.appendChild(this.passwordGeneratorContainer);
  }

  /**
   * Builds the colorized password content element.
   *
   * @param password - The password to display.
   */
  private buildColorizedPasswordElement(password: string) {
    let ariaDescription = `${this.getTranslation("generatedPassword")}: `;
    const passwordContainer = globalThis.document.createElement("div");
    passwordContainer.classList.add("colorized-password");
    const appendPasswordCharacter = (character: string, type: string) => {
      const characterElement = globalThis.document.createElement("div");
      characterElement.classList.add(`password-${type}`);
      characterElement.textContent = character;

      passwordContainer.appendChild(characterElement);
    };

    const passwordArray = Array.from(password);
    for (let i = 0; i < passwordArray.length; i++) {
      const character = passwordArray[i];

      if (character.match(/\W/)) {
        appendPasswordCharacter(character, "special");
        ariaDescription += `${this.getTranslation(specialCharacterToKeyMap[character])} `;
        continue;
      }

      if (character.match(/\d/)) {
        appendPasswordCharacter(character, "number");
        ariaDescription += `${character} `;
        continue;
      }

      appendPasswordCharacter(character, "letter");
      ariaDescription +=
        character === character.toLowerCase()
          ? `${this.getTranslation("lowercaseAriaLabel")} ${character} `
          : `${this.getTranslation("uppercaseAriaLabel")} ${character} `;
    }

    passwordContainer.setAttribute("aria-label", ariaDescription);
    return passwordContainer;
  }

  /**
   * Handles the click event for the fill generated password button. Triggers
   * a message to the background script to fill the generated password.
   */
  private handleFillGeneratedPasswordClick = () => {
    this.postMessageToParent({ command: "fillGeneratedPassword" });
  };

  /**
   * Handles the keyup event for the fill generated password button.
   *
   * @param event - The keyup event.
   */
  private handleFillGeneratedPasswordKeyUp = (event: KeyboardEvent) => {
    if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) {
      return;
    }

    if (event.code === "Space") {
      this.handleFillGeneratedPasswordClick();
      return;
    }

    if (
      event.code === "ArrowRight" &&
      event.target instanceof HTMLElement &&
      event.target.nextElementSibling
    ) {
      (event.target.nextElementSibling as HTMLElement).focus();
      event.target.parentElement.classList.add("remove-outline");
      return;
    }
  };

  /**
   * Handles the click event of the password regenerator button.
   *
   * @param event - The click event.
   */
  private handleRefreshGeneratedPasswordClick = (event?: MouseEvent) => {
    if (event) {
      (event.target as HTMLElement)
        .closest(".password-generator-actions")
        ?.classList.add("remove-outline");
    }

    this.postMessageToParent({ command: "refreshGeneratedPassword" });
  };

  /**
   * Handles the keyup event for the password regenerator button.
   *
   * @param event - The keyup event.
   */
  private handleRefreshGeneratedPasswordKeyUp = (event: KeyboardEvent) => {
    if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) {
      return;
    }

    if (event.code === "Space") {
      this.handleRefreshGeneratedPasswordClick();
      return;
    }

    if (
      event.code === "ArrowLeft" &&
      event.target instanceof HTMLElement &&
      event.target.previousElementSibling
    ) {
      (event.target.previousElementSibling as HTMLElement).focus();
      event.target.parentElement.classList.remove("remove-outline");
      return;
    }
  };

  /**
   * Updates the generated password content element with the passed generated password.
   *
   * @param message - The message containing the generated password.
   */
  private handleUpdateAutofillInlineMenuGeneratedPassword(
    message: UpdateAutofillInlineMenuGeneratedPasswordMessage,
  ) {
    if (this.authStatus !== AuthenticationStatus.Unlocked || !message.generatedPassword) {
      return;
    }

    const passwordGeneratorContentElement = this.inlineMenuListContainer.querySelector(
      "#password-generator-content",
    );
    const colorizedPasswordElement =
      passwordGeneratorContentElement?.querySelector(".colorized-password");
    if (!colorizedPasswordElement) {
      this.resetInlineMenuContainer();
      this.buildPasswordGenerator(message.generatedPassword);
      return;
    }

    colorizedPasswordElement.replaceWith(
      this.buildColorizedPasswordElement(message.generatedPassword),
    );
  }

  /**
   * Updates the list items with the passed ciphers.
   * If no ciphers are passed, the no results inline menu is built.
   *
   * @param ciphers - The ciphers to display in the inline menu list.
   * @param showInlineMenuAccountCreation - Whether identity ciphers are shown on login fields.
   */
  private updateListItems({
    ciphers,
    showInlineMenuAccountCreation,
    searchValue,
    isBack,
  }: UpdateAutofillInlineMenuListCiphersParams) {
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
    if (this.isPasskeyAuthInProgress) {
      return;
    }

    this.ciphers = ciphers;
    this.currentCipherIndex = 0;
    this.showInlineMenuAccountCreation = showInlineMenuAccountCreation;
    this.resetInlineMenuContainer(isSearching);

    if (!this.ciphers?.length) {
      this.buildNoResultsInlineMenuList();
      return;
    }

    this.ciphersList = globalThis.document.createElement("ul");
    this.ciphersList.classList.add("inline-menu-list-actions");
    this.ciphersList.setAttribute("role", "list");
    this.setupCipherListScrollListeners();

    // Cozy customization - On the contact ambiguous fields, if the field has a value, the corresponding menu is displayed directly. Unless we wish to return to the contact cypher list.
    if (
      this.fieldValue &&
      [...ambiguousContactFieldNames, ...addressFieldNames, ...cozypaperFieldNames].includes(
        COZY_ATTRIBUTES_MAPPING[this.fieldQualifier].name as AmbiguousContactFieldName,
      ) &&
      !isBack && // case where we are already on the ambiguous list and wish to return to the contacts list.
      this.lastFilledContactCipherId // If ambiguous field is manually filled, inlineMenuCipherId is undefined.
    ) {
      this.postMessageToParent({
        command: "handleContactClick",
        inlineMenuCipherId: this.lastFilledContactCipherId,
        fieldHtmlIDToFill: this.fieldHtmlID,
      });
    } else {
      this.loadPageOfCiphers();
    }
    // Cozy customization end

    // Cozy customization - Add the search input to the contact list if the search value is empty, during a search it remains present and does not need to be recreated.
    if (isContactCipherList && !isSearching) {
      this.inlineMenuListContainer.appendChild(this.buildContactSearch());
      this.inlineMenuListContainer.classList.add(
        "inline-menu-list-container--with-new-item-button",
      );
    }
    // Cozy customization end
    // Cozy customization - Add the new contact button to the contact list.
    if (this.isFilledByContactCipher()) {
      this.inlineMenuListContainer.appendChild(this.buildNewItemButton());
      this.newItemButtonElement.classList.add("inline-menu-list-actions--bottom");
      if (this.isSearchFocused) {
        this.contactSearchInputElement.focus();
      }
    }
    // Cozy customization end

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

  private buildViewMoreContactButton() {
    const containerElement = globalThis.document.createElement("div");
    containerElement.classList.add("cipher-container");

    const viewMoreContactButtonElement = globalThis.document.createElement("button");
    viewMoreContactButtonElement.tabIndex = -1;
    viewMoreContactButtonElement.classList.add(
      "inline-menu-list-button",
      "inline-menu-list-action",
      "inline-menu-list-button--load-more",
    );
    viewMoreContactButtonElement.textContent = this.getTranslation("viewMoreContact");
    viewMoreContactButtonElement.setAttribute("aria-label", this.getNewItemAriaLabel(false));
    viewMoreContactButtonElement.addEventListener(EVENTS.CLICK, this.createViewMoreInfo.bind(this));

    const inlineMenuListActionsItem = globalThis.document.createElement("li");
    inlineMenuListActionsItem.setAttribute("role", "listitem");
    inlineMenuListActionsItem.classList.add("inline-menu-list-actions-item");

    containerElement.append(viewMoreContactButtonElement);
    inlineMenuListActionsItem.appendChild(containerElement);

    return inlineMenuListActionsItem;
  }

  private createViewMoreInfo() {
    this.inlineMenuListContainer.innerHTML = "";
    this.inlineMenuListContainer.classList.remove(
      "inline-menu-list-container--with-new-item-button",
    );

    const header = this.buildNewListHeader(
      this.getTranslation("viewMoreContact"),
      this.backToCipherList,
    );

    const content = globalThis.document.createElement("div");
    content.classList.add("view-more-contacts");

    const paragraph01 = globalThis.document.createElement("p");
    paragraph01.textContent = this.getTranslation("viewMoreContactInfo1");
    const paragraph02 = globalThis.document.createElement("p");
    paragraph02.textContent = this.getTranslation("viewMoreContactInfo2");

    const spanContainer = globalThis.document.createElement("span");
    spanContainer.classList.add("view-more-contacts-redirect");
    const span = globalThis.document.createElement("span");
    span.textContent = this.getTranslation("viewMoreContactRedirect");
    spanContainer.addEventListener(EVENTS.CLICK, () => {
      this.postMessageToParent({
        command: "redirectToCozy",
        to: "contacts",
      });
    });

    spanContainer.appendChild(buildSvgDomElement(cozyContactIcon));
    spanContainer.appendChild(span);
    content.append(paragraph01, paragraph02, spanContainer);

    this.inlineMenuListContainer.appendChild(header);
    this.inlineMenuListContainer.appendChild(content);
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
    return this.useEventHandlersMemo(() => {
      this.isSearchFocused = true;
      this.postMessageToParent({
        command: "inlineMenuSearchContact",
        searchValue: this.contactSearchInputElement.value,
      });
    }, `inline-menu-search-contact-handler`);
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

    const cozyAutofillOptions = {
      value: currentListItemValue,
      label: ambiguousValue.label,
      type: ambiguousValue.type,
      fillOnlyThisFieldHtmlID: fieldHtmlIDToFill,
    };

    // We need to get back the field qualifier for the action menu
    const fieldQualifier = Object.keys(COZY_ATTRIBUTES_MAPPING).find(
      (key: AutofillFieldQualifierType) => COZY_ATTRIBUTES_MAPPING[key].name === ambiguousKey,
    ) as AutofillFieldQualifierType;

    const actionMenuButtonElement = this.buildActionMenuButton(
      {
        type: "field",
        inlineMenuCipherId,
        fieldQualifier,
        cozyAutofillOptions,
      },
      () => this.backToParent(inlineMenuCipherId),
    );

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
      this.handleFillCipherAmbiguousClickEvent(inlineMenuCipherId, cozyAutofillOptions, uniqueId()),
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
    radio.classList.add("fill-cipher-contact-radio");

    const detailsSpan = document.createElement("span");
    detailsSpan.classList.add("cipher-details");

    const nameSpanText = makeAmbiguousValueLabel(
      ambiguousValue,
      isAmbiguousFieldFocused,
      this.getTranslation.bind(this),
    );
    const nameSpan = document.createElement("span");
    if (nameSpanText) {
      nameSpan.setAttribute("title", nameSpanText);
      nameSpan.textContent = nameSpanText;
      nameSpan.classList.add("cipher-name");

      detailsSpan.appendChild(nameSpan);
    }

    const subNameSpan = document.createElement("span");
    subNameSpan.setAttribute("title", ambiguousKey);
    subNameSpan.classList.add("cipher-subtitle");

    // Reverse the class for the current ambiguous field
    // Compare with "path" for "address" fields
    if (COZY_ATTRIBUTES_MAPPING[this.fieldQualifier].path === ambiguousKey) {
      subNameSpan.classList.replace("cipher-subtitle", "cipher-name");
      nameSpan.classList.replace("cipher-name", "cipher-subtitle");
    }
    subNameSpan.textContent = currentListItemValue;

    detailsSpan.appendChild(subNameSpan);
    fillButton.appendChild(radio);
    fillButton.appendChild(detailsSpan);

    div.appendChild(fillButton);
    div.appendChild(actionMenuButtonElement);
    listItem.appendChild(div);

    return listItem;
  }

  /**
   * @param inlineMenuCipherId
   * @param contactName
   * @param ambiguousKey
   * @param ambiguousValue
   * @param isAmbiguousFieldFocused
   */
  private createPaperListItem(
    inlineMenuCipherId: string,
    contactName: string,
    id: string,
    name: string,
    value: string,
    qualificationLabel: string,
    metadataName: string,
  ) {
    const cozyAutofillOptions = { id, value, qualificationLabel, metadataName };
    const actionMenuButtonElement = this.buildActionMenuButton(
      {
        type: "field",
        inlineMenuCipherId,
        fieldQualifier: this.fieldQualifier,
        cozyAutofillOptions,
      },
      () => this.backToParent(inlineMenuCipherId),
    );

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
      this.handleFillCipherWithCozyDataClickEvent(
        inlineMenuCipherId,
        cozyAutofillOptions,
        uniqueId(),
      ),
    );

    const radio = document.createElement("input");
    radio.setAttribute("type", "radio");
    radio.setAttribute("name", "contact");
    radio.setAttribute("id", "contact");
    radio.classList.add("fill-cipher-contact-radio");

    const detailsSpan = document.createElement("span");
    detailsSpan.classList.add("cipher-details");

    const nameSpanText = name;
    const nameSpan = document.createElement("span");
    nameSpan.setAttribute("title", nameSpanText);
    nameSpan.textContent = nameSpanText;
    nameSpan.classList.add("cipher-name");

    const subNameSpan = document.createElement("span");
    subNameSpan.setAttribute("title", value);
    subNameSpan.classList.add("cipher-subtitle");
    subNameSpan.textContent = value;

    detailsSpan.appendChild(nameSpan);
    detailsSpan.appendChild(subNameSpan);
    fillButton.appendChild(radio);
    fillButton.appendChild(detailsSpan);

    div.appendChild(fillButton);
    div.appendChild(actionMenuButtonElement);
    listItem.appendChild(div);

    return listItem;
  }

  /**
   * @param contactName
   * @param onClick
   */
  private buildNewListHeader(
    contactName: string,
    onClick: () => void,
    actionMenuData?: ActionMenuData,
  ) {
    this.newItemButtonElement = globalThis.document.createElement("button");
    this.newItemButtonElement.tabIndex = -1;
    this.newItemButtonElement.classList.add("inline-menu-list-header");

    const span = globalThis.document.createElement("span");
    span.textContent = contactName;
    span.setAttribute("title", contactName);
    span.classList.add("list-header-text", "list-header-text--full-width");
    this.newItemButtonElement.setAttribute("aria-label", contactName);

    this.newItemButtonElement.append(buildSvgDomElement(backIcon));
    this.newItemButtonElement.addEventListener(EVENTS.CLICK, onClick);
    this.newItemButtonElement.appendChild(span);

    return this.buildListHeaderContainer(this.newItemButtonElement);
  }

  private backToCipherList = () => {
    this.updateListItems({ ciphers: this.ciphers, isBack: true });
  };

  private backToParent = (inlineMenuCipherId: string) => {
    this.postMessageToParent({
      command: "handleContactClick",
      inlineMenuCipherId,
      lastFilledContactCipherId: this.lastFilledContactCipherId,
      fieldQualifier: this.fieldQualifier,
      fieldValue: this.fieldValue,
    });
  };

  /**
   * @param element
   */
  private buildListHeaderContainer(element: Element, rightElement?: HTMLElement) {
    const inlineMenuListButtonContainer = globalThis.document.createElement("div");
    inlineMenuListButtonContainer.classList.add("inline-menu-list-header-container");
    inlineMenuListButtonContainer.appendChild(element);

    if (rightElement) {
      inlineMenuListButtonContainer.appendChild(rightElement);
    }

    return inlineMenuListButtonContainer;
  }

  private createNewButton(
    inlineMenuCipherId: string,
    fieldHtmlIDToFill: string,
    contactName: string,
    focusedFieldName: string,
  ) {
    const title = this.getTranslation(`new_${focusedFieldName}`);

    const listItem = document.createElement("li");
    listItem.setAttribute("role", "listitem");
    listItem.classList.add("inline-menu-list-actions-item");

    const div = document.createElement("div");
    div.classList.add("cipher-container");

    const fillButton = document.createElement("button");
    fillButton.setAttribute("tabindex", "-1");
    fillButton.classList.add("fill-cipher-button", "inline-menu-list-action");
    fillButton.setAttribute("aria-label", title);
    fillButton.addEventListener(EVENTS.CLICK, () =>
      this.editCozyDoctypeFields(inlineMenuCipherId, contactName, fieldHtmlIDToFill),
    );

    const radio = document.createElement("input");
    radio.setAttribute("type", "radio");
    radio.setAttribute("name", "contact");
    radio.setAttribute("id", "contact");
    radio.classList.add("fill-cipher-contact-radio");

    const detailsSpan = document.createElement("span");
    detailsSpan.classList.add("cipher-details");

    const nameSpan = document.createElement("span");
    nameSpan.setAttribute("title", title);
    nameSpan.textContent = title;
    nameSpan.classList.add("cipher-name");

    detailsSpan.appendChild(nameSpan);
    fillButton.appendChild(radio);
    fillButton.appendChild(detailsSpan);
    div.appendChild(fillButton);
    listItem.appendChild(div);

    return listItem;
  }

  /**
   * @param title
   */
  private createEmptyListItem(title: string) {
    const listItem = document.createElement("li");
    listItem.setAttribute("role", "listitem");
    listItem.classList.add(
      "inline-menu-list-actions-item",
      "inline-menu-list-actions-item--empty",
      "disabled",
    );

    const div = document.createElement("div");
    div.classList.add("cipher-container", "cipher-container--empty");

    const iconElement = buildSvgDomElement(contact);
    iconElement.classList.add("cipher-icon--empty");

    const detailsSpan = document.createElement("span");
    detailsSpan.classList.add("cipher-details");

    const nameSpanText = title;
    const nameSpan = document.createElement("span");
    nameSpan.setAttribute("title", nameSpanText);
    nameSpan.textContent = nameSpanText;
    nameSpan.classList.add("cipher-name", "cipher-name--empty");

    detailsSpan.appendChild(nameSpan);
    div.appendChild(iconElement);
    div.appendChild(detailsSpan);
    listItem.appendChild(div);

    return listItem;
  }

  private createEmptyNameList(
    inlineMenuCipherId: string,
    contactName: string,
    fieldHtmlIDToFill: string,
    focusedFieldName: string,
  ) {
    this.inlineMenuListContainer.innerHTML = "";
    this.inlineMenuListContainer.classList.remove(
      "inline-menu-list-container--with-new-item-button",
    );

    const addNewLoginButtonContainer = this.buildNewListHeader(contactName, this.backToCipherList);

    const ulElement = globalThis.document.createElement("ul");
    ulElement.classList.add("inline-menu-list-actions");
    ulElement.setAttribute("role", "list");

    const emptyLiTitle = this.getTranslation(`empty_${focusedFieldName}`);
    const emptyLi = this.createEmptyListItem(emptyLiTitle);
    ulElement.appendChild(emptyLi);

    const newButton = this.createNewButton(
      inlineMenuCipherId,
      fieldHtmlIDToFill,
      contactName,
      focusedFieldName,
    );
    if (newButton) {
      ulElement.appendChild(newButton);
    }

    this.inlineMenuListContainer.appendChild(addNewLoginButtonContainer);
    this.inlineMenuListContainer.appendChild(ulElement);
    this.inlineMenuListContainer.classList.add("inline-menu-list-container--with-new-item-button");
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

    const addNewLoginButtonContainer = this.buildNewListHeader(contactName, this.backToCipherList, {
      type: "fieldHeader",
      inlineMenuCipherId,
    });

    const ulElement = globalThis.document.createElement("ul");
    ulElement.classList.add("inline-menu-list-actions");
    ulElement.setAttribute("role", "list");
    ulElement.addEventListener(EVENTS.SCROLL, this.updateCiphersListOnScroll);

    const firstAmbiguousFieldEntries = Object.entries(ambiguousFields)[0];
    const firstAmbiguousFieldName =
      (firstAmbiguousFieldEntries?.[0] as AmbiguousContactFieldName) ||
      (COZY_ATTRIBUTES_MAPPING[this.fieldQualifier].name as AmbiguousContactFieldName);

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

    if (isAmbiguousFieldFocused) {
      const newButton = this.createNewButton(
        inlineMenuCipherId,
        fieldHtmlIDToFill,
        contactName,
        firstAmbiguousFieldName,
      );
      if (newButton) {
        ulElement.appendChild(newButton);
      }
    }

    this.inlineMenuListContainer.appendChild(addNewLoginButtonContainer);
    this.inlineMenuListContainer.appendChild(ulElement);

    this.inlineMenuListContainer.classList.add("inline-menu-list-container--with-new-item-button");

    this.toggleScrollClass(undefined, ulElement);
  }

  /**
   * @param inlineMenuCipherId
   * @param papers
   */
  private paperList(
    inlineMenuCipherId: string,
    contactName: string,
    availablePapers: AvailablePapers[],
    fieldHtmlIDToFill: string,
  ) {
    this.inlineMenuListContainer.innerHTML = "";
    this.inlineMenuListContainer.classList.remove(
      "inline-menu-list-container--with-new-item-button",
    );

    const addNewLoginButtonContainer = this.buildNewListHeader(contactName, this.backToCipherList);

    const ulElement = globalThis.document.createElement("ul");
    ulElement.classList.add("inline-menu-list-actions");
    ulElement.setAttribute("role", "list");
    ulElement.addEventListener(EVENTS.SCROLL, this.updateCiphersListOnScroll);

    if (availablePapers.length > 0) {
      for (const paper of availablePapers) {
        const li = this.createPaperListItem(
          inlineMenuCipherId,
          contactName,
          paper.id,
          paper.name,
          paper.value,
          paper.qualificationLabel,
          paper.metadataName,
        );
        ulElement.appendChild(li);
      }
    } else {
      const emptyLiText = this.getTranslation("noItemsToShow");
      const emptyLi = this.createEmptyListItem(emptyLiText);
      ulElement.appendChild(emptyLi);
    }

    const newButton = this.createNewButton(
      inlineMenuCipherId,
      fieldHtmlIDToFill,
      contactName,
      this.fieldQualifier,
    );
    ulElement.appendChild(newButton);

    this.inlineMenuListContainer.appendChild(addNewLoginButtonContainer);
    this.inlineMenuListContainer.appendChild(ulElement);

    this.inlineMenuListContainer.classList.add("inline-menu-list-container--with-new-item-button");

    this.toggleScrollClass(undefined, ulElement);
  }

  /**
   * @param inlineMenuCipherId
   * @param cozyAutofillOptions
   * @param fieldHtmlIDToFill
   * @param UID
   */
  private handleFillCipherAmbiguousClickEvent = (
    inlineMenuCipherId: string,
    cozyAutofillOptions: CozyAutofillOptions,
    UID: string,
  ) => {
    return this.useEventHandlersMemo(
      () =>
        this.postMessageToParent({
          command: "fillAutofillInlineMenuCipherWithAmbiguousField",
          inlineMenuCipherId,
          cozyAutofillOptions,
        }),
      `${UID}-fill-cipher-button-click-handler`,
    );
  };

  /**
   * @param inlineMenuCipherId
   * @param cozyAutofillOptions
   * @param UID
   */
  private handleFillCipherWithCozyDataClickEvent = (
    inlineMenuCipherId: string,
    cozyAutofillOptions: CozyAutofillOptions,
    UID: string,
  ) => {
    return this.useEventHandlersMemo(
      () =>
        this.postMessageToParent({
          command: "fillAutofillInlineMenuCipherWithCozyData",
          inlineMenuCipherId,
          cozyAutofillOptions,
        }),
      `${UID}-fill-cipher-button-click-handler`,
    );
  };

  /**
   * Clears and resets the inline menu list container.
   */
  private resetInlineMenuContainer(isSearching?: boolean) {
    if (isSearching) {
      const children = Array.from(this.inlineMenuListContainer.childNodes);
      for (let i = 0; i < children.length; i++) {
        const child = children[i] as Element;
        if (!child.classList.contains("inline-menu-list-search-container")) {
          child.remove();
        }
      }
    } else if (this.inlineMenuListContainer) {
      this.inlineMenuListContainer.innerHTML = "";
      this.inlineMenuListContainer.classList.remove(
        "inline-menu-list-container--with-new-item-button",
      );
    }
  }

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
  private buildNewItemButton(showLogin = false) {
    this.newItemButtonElement = globalThis.document.createElement("button");
    this.newItemButtonElement.tabIndex = -1;
    this.newItemButtonElement.id = "new-item-button";
    this.newItemButtonElement.classList.add(
      "add-new-item-button",
      "inline-menu-list-button",
      "inline-menu-list-action",
    );
    // Cozy customization - Add the bottom class to the new item button if the form is filled by a contact cipher
    if (this.isFilledByContactCipher()) {
      this.newItemButtonElement.classList.add("inline-menu-list-button--bottom");
    }
    // Cozy customization end
    this.newItemButtonElement.textContent = this.getNewItemButtonText(showLogin);
    this.newItemButtonElement.setAttribute("aria-label", this.getNewItemAriaLabel(showLogin));
    this.newItemButtonElement.prepend(buildSvgDomElement(plusIcon));
    this.newItemButtonElement.addEventListener(EVENTS.CLICK, this.handeNewItemButtonClick);

    return this.buildButtonContainer(this.newItemButtonElement);
  }

  /**
   * Gets the new item text for the button based on the cipher type the focused field is filled by.
   */
  private getNewItemButtonText(showLogin: boolean) {
    // Cozy customization - Add the translation for the new item button when the form is filled by a contact cipher
    if (this.isFilledByContactCipher()) {
      return this.getTranslation("new_contact");
    }
    // Cozy customization end

    if (this.isFilledByLoginCipher() || this.showInlineMenuAccountCreation || showLogin) {
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
  private getNewItemAriaLabel(showLogin: boolean) {
    if (this.isFilledByLoginCipher() || this.showInlineMenuAccountCreation || showLogin) {
      return this.getTranslation("addNewLoginItemAria");
    }

    if (this.isFilledByCardCipher()) {
      return this.getTranslation("addNewCardItemAria");
    }

    if (this.isFilledByIdentityCipher()) {
      return this.getTranslation("addNewIdentityItemAria");
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
    let addNewCipherType = this.inlineMenuFillType;

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

    // Extra padding for the "new contact" button
    if (ciphers[0].type === CipherType.Contact) {
      this.ciphersList.style.paddingBottom = "48px";
    }

    const lastIndex = Math.min(this.currentCipherIndex + this.showCiphersPerPage, ciphers.length);

    for (let cipherIndex = this.currentCipherIndex; cipherIndex < lastIndex; cipherIndex++) {
      this.ciphersList.appendChild(this.buildInlineMenuListActionsItem(ciphers[cipherIndex]));
      this.currentCipherIndex++;
    }

    if (!this.showPasskeysLabels && this.allCiphersLoaded()) {
      this.ciphersList.removeEventListener(EVENTS.SCROLL, this.updateCiphersListOnScroll);
    }

    if (this.isFilledByContactCipher()) {
      this.ciphersList.appendChild(this.buildViewMoreContactButton());
    }
  }

  /**
   * Validates whether the list of ciphers has been fully loaded.
   */
  private allCiphersLoaded() {
    return this.currentCipherIndex >= this.ciphers.length;
  }

  /**
   * Sets up the scroll listeners for the ciphers list. These are used to trigger an update of
   * the list of ciphers when the user scrolls to the bottom of the list. Also sets up the
   * scroll listeners that reposition the passkeys and login headings when the user scrolls.
   */
  private setupCipherListScrollListeners() {
    const options = { passive: true };
    this.ciphersList.addEventListener(EVENTS.SCROLL, this.updateCiphersListOnScroll, options);
    if (this.showPasskeysLabels) {
      this.ciphersList.addEventListener(
        EVENTS.SCROLL,
        this.useEventHandlersMemo(
          throttle(this.handleThrottledOnScrollEvent, 50),
          UPDATE_PASSKEYS_HEADINGS_ON_SCROLL,
        ),
        options,
      );
    }
  }

  /**
   * Handles updating the list of ciphers when the
   * user scrolls to the bottom of the list.
   */
  private updateCiphersListOnScroll = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

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
   * Throttled handler for updating the passkeys and login headings when the user scrolls the ciphers list.
   *
   * @param event - The scroll event.
   */
  private handleThrottledOnScrollEvent = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    this.updatePasskeysHeadingsOnScroll(this.ciphersList.scrollTop);
  };

  /**
   * Updates the passkeys and login headings when the user scrolls the ciphers list.
   *
   * @param cipherListScrollTop - The current scroll top position of the ciphers list.
   */
  private updatePasskeysHeadingsOnScroll = (cipherListScrollTop: number) => {
    if (!this.showPasskeysLabels) {
      return;
    }

    if (this.passkeysHeadingElement) {
      this.togglePasskeysHeadingAnchored(cipherListScrollTop);
      this.togglePasskeysHeadingBorder(cipherListScrollTop);
    }

    if (this.loginHeadingElement) {
      this.toggleLoginHeadingBorder(cipherListScrollTop);
    }
  };

  /**
   * Anchors the passkeys heading to the top of the last passkey item when the user scrolls.
   *
   * @param cipherListScrollTop - The current scroll top position of the ciphers list.
   */
  private togglePasskeysHeadingAnchored(cipherListScrollTop: number) {
    if (!this.passkeysHeadingHeight) {
      this.passkeysHeadingHeight = this.passkeysHeadingElement.offsetHeight;
    }

    const passkeysHeadingOffset = this.lastPasskeysListItem.offsetTop - this.passkeysHeadingHeight;
    if (cipherListScrollTop >= passkeysHeadingOffset) {
      this.passkeysHeadingElement.style.position = "relative";
      this.passkeysHeadingElement.style.top = `${passkeysHeadingOffset}px`;

      return;
    }

    this.passkeysHeadingElement.setAttribute("style", "");
  }

  /**
   * Toggles a border on the passkeys heading on scroll, adding it when the user has
   * scrolled at all and removing it once the user scrolls back to the top.
   *
   * @param cipherListScrollTop - The current scroll top position of the ciphers list.
   */
  private togglePasskeysHeadingBorder(cipherListScrollTop: number) {
    if (cipherListScrollTop < 1) {
      this.passkeysHeadingElement.classList.remove(this.headingBorderClass);
      return;
    }

    this.passkeysHeadingElement.classList.add(this.headingBorderClass);
  }

  /**
   * Toggles a border on  the login heading on scroll, adding it when the user has
   * scrolled past the last passkey item and removing it once the user scrolls back up.
   *
   * @param cipherListScrollTop - The current scroll top position of the ciphers list.
   */
  private toggleLoginHeadingBorder(cipherListScrollTop: number) {
    if (!this.lastPasskeysListItemHeight) {
      this.lastPasskeysListItemHeight = this.lastPasskeysListItem.offsetHeight;
    }

    const lastPasskeyOffset = this.lastPasskeysListItem.offsetTop + this.lastPasskeysListItemHeight;
    if (cipherListScrollTop < lastPasskeyOffset) {
      this.loginHeadingElement.classList.remove(this.headingBorderClass);
      return;
    }

    this.loginHeadingElement.classList.add(this.headingBorderClass);
  }

  /**
   * Builds the list item for a given cipher.
   *
   * @param cipher - The cipher to build the list item for.
   */
  private buildInlineMenuListActionsItem(cipher: InlineMenuCipherData) {
    const fillCipherElement = this.buildFillCipherElement(cipher);
    const viewCipherElement = this.buildViewCipherElement(cipher);

    const cipherContainerElement = globalThis.document.createElement("div");
    cipherContainerElement.classList.add(
      "cipher-container",
      `cipher-container--type-${cipher.type}`,
    );
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
      `${
        cipher.login?.passkey
          ? this.getTranslation("logInWithPasskeyAriaLabel")
          : this.getTranslation("fillCredentialsFor")
      } ${cipher.name}`,
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
      const passkeyUserName = cipher.login.passkey?.userName || "";
      const username = cipher.login.username || passkeyUserName;
      if (username) {
        fillCipherElement.setAttribute(
          "aria-description",
          `${this.getTranslation("username")?.toLowerCase()}: ${username}`,
        );
      }
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
    const usePasskey = !!cipher.login?.passkey;
    if (cipher.contact) {
      return this.useEventHandlersMemo(
        () =>
          this.postMessageToParent({
            command: "handleContactClick",
            inlineMenuCipherId: cipher.id,
            lastFilledContactCipherId: this.lastFilledContactCipherId,
            fieldQualifier: this.fieldQualifier,
            fieldValue: this.fieldValue,
          }),
        `${cipher.id}-fill-cipher-button-click-handler`,
      );
    }

    return this.useEventHandlersMemo(
      () => this.triggerFillCipherClickEvent(cipher, usePasskey),
      `${cipher.id}-fill-cipher-button-click-handler-${usePasskey ? "passkey" : ""}`,
    );
  };

  /**
   * Triggers a fill of the currently selected cipher.
   *
   * @param cipher - The cipher to fill.
   * @param usePasskey - Whether the cipher uses a passkey.
   */
  private triggerFillCipherClickEvent = (cipher: InlineMenuCipherData, usePasskey: boolean) => {
    if (usePasskey) {
      this.createPasskeyAuthenticatingLoader();
    }

    this.postMessageToParent({
      command: "fillAutofillInlineMenuCipher",
      inlineMenuCipherId: cipher.id,
      usePasskey,
    });
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
    // Cozy customization, open the action menu if it is a contact
    //*
    if (this.isFilledByContactCipher()) {
      viewCipherElement.append(buildSvgDomElement(ellipsisIcon));
      viewCipherElement.addEventListener(EVENTS.CLICK, () =>
        this.buildActionMenu({ type: "contact", cipher }, this.backToCipherList),
      );
    } else {
      viewCipherElement.append(buildSvgDomElement(viewCipherIcon));
      viewCipherElement.addEventListener(EVENTS.CLICK, this.handleViewCipherClickEvent(cipher));
    }
    /*/
    viewCipherElement.append(buildSvgDomElement(viewCipherIcon));
    viewCipherElement.addEventListener(EVENTS.CLICK, this.handleViewCipherClickEvent(cipher));
    //*/
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
          cipherIcon.classList.add("cipher-icon");
          cipherIcon.append(buildSvgDomElement(globeIcon));
        });
        dummyImageElement.remove();

        return cipherIcon;
      } catch {
        // Silently default to the globe icon element if the image URL is invalid
      }
    }

    if (!cipher.icon?.icon) {
      cipherIcon.append(buildSvgDomElement(globeIcon));
      return cipherIcon;
    }

    if (cipher.icon.icon.includes("bwi-credit-card")) {
      cipherIcon.append(buildSvgDomElement(creditCardIcon));
      return cipherIcon;
    }

    if (cipher.icon.icon.includes("bwi-id-card")) {
      cipherIcon.append(buildSvgDomElement(idCardIcon));
      return cipherIcon;
    }

    const iconClasses = cipher.icon.icon.split(" ");
    cipherIcon.classList.add("cipher-icon", "bwi", ...iconClasses);
    return cipherIcon;
  }

  /**
   * Builds the details for a given cipher. Includes the cipher name and subtitle.
   *
   * @param cipher - The cipher to build the details for.
   */
  private buildCipherDetailsElement(cipher: InlineMenuCipherData) {
    const cipherDetailsElement = globalThis.document.createElement("span");
    cipherDetailsElement.classList.add("cipher-details");

    const cipherNameElement = this.buildCipherNameElement(cipher);
    if (cipherNameElement) {
      cipherDetailsElement.appendChild(cipherNameElement);
    }

    if (cipher.login?.passkey) {
      return this.buildPasskeysCipherDetailsElement(cipher, cipherDetailsElement);
    }

    const subTitleText = this.getSubTitleText(cipher);
    const cipherSubtitleElement = this.buildCipherSubtitleElement(subTitleText);
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
    cipherNameElement.textContent = this.buildCipherName(cipher);
    /*/
    cipherNameElement.textContent = cipher.name;
    //*/

    cipherNameElement.setAttribute("title", cipher.name);

    return cipherNameElement;
  }

  private buildCipherName = (cipher: InlineMenuCipherData) => {
    return cipher.contact
      ? cipher.contact.me
        ? `${cipher.contact.fullName} (${this.getTranslation("cipherContactMe")})`
        : cipher.contact.fullName
      : cipher.name;
  };

  /**
   * Builds the subtitle element for a given cipher.
   *
   * @param subTitleText - The subtitle text to display.
   */
  private buildCipherSubtitleElement(subTitleText: string): HTMLSpanElement | null {
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
   * Builds the passkeys details for a given cipher. Includes the passkey name and username.
   *
   * @param cipher - The cipher to build the passkey details for.
   * @param cipherDetailsElement - The cipher details element to append the passkey details to.
   */
  private buildPasskeysCipherDetailsElement(
    cipher: InlineMenuCipherData,
    cipherDetailsElement: HTMLSpanElement,
  ): HTMLSpanElement {
    let rpNameSubtitle: HTMLSpanElement;

    if (cipher.name !== cipher.login.passkey.rpName) {
      rpNameSubtitle = this.buildCipherSubtitleElement(cipher.login.passkey.rpName);
      if (rpNameSubtitle) {
        rpNameSubtitle.prepend(buildSvgDomElement(passkeyIcon));
        rpNameSubtitle.classList.add("cipher-subtitle--passkey");
        cipherDetailsElement.appendChild(rpNameSubtitle);
      }
    }

    if (cipher.login.username) {
      const usernameSubtitle = this.buildCipherSubtitleElement(cipher.login.username);
      if (usernameSubtitle) {
        if (!rpNameSubtitle) {
          usernameSubtitle.prepend(buildSvgDomElement(passkeyIcon));
          usernameSubtitle.classList.add("cipher-subtitle--passkey");
        }
        cipherDetailsElement.appendChild(usernameSubtitle);
      }

      return cipherDetailsElement;
    }

    const passkeySubtitle = this.buildCipherSubtitleElement(cipher.login.passkey.userName);
    if (passkeySubtitle) {
      if (!rpNameSubtitle) {
        passkeySubtitle.prepend(buildSvgDomElement(passkeyIcon));
        passkeySubtitle.classList.add("cipher-subtitle--passkey");
      }
      cipherDetailsElement.appendChild(passkeySubtitle);
    }

    return cipherDetailsElement;
  }

  /**
   * Creates an indicator for the user that the passkey is being authenticated.
   */
  private createPasskeyAuthenticatingLoader() {
    this.isPasskeyAuthInProgress = true;
    this.resetInlineMenuContainer();

    const passkeyAuthenticatingLoader = globalThis.document.createElement("div");
    passkeyAuthenticatingLoader.classList.add("passkey-authenticating-loader");
    passkeyAuthenticatingLoader.textContent = this.getTranslation("authenticating");
    passkeyAuthenticatingLoader.appendChild(buildSvgDomElement(spinnerIcon));

    this.inlineMenuListContainer.appendChild(passkeyAuthenticatingLoader);

    globalThis.setTimeout(() => {
      this.isPasskeyAuthInProgress = false;
      this.postMessageToParent({ command: "checkAutofillInlineMenuButtonFocused" });
    }, 4000);
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
    if (globalThis.document.hasFocus()) {
      return;
    }

    if (this.isListHovered()) {
      globalThis.document.addEventListener(EVENTS.MOUSEOUT, this.handleMouseOutEvent);
      return;
    }

    this.postMessageToParent({ command: "checkAutofillInlineMenuButtonFocused" });
  }

  /**
   * Triggers a re-check of the list's focus status when the mouse leaves the list.
   */
  private handleMouseOutEvent = () => {
    globalThis.document.removeEventListener(EVENTS.MOUSEOUT, this.handleMouseOutEvent);
    this.checkInlineMenuListFocused();
  };

  /**
   * Validates whether the inline menu list iframe is currently hovered.
   */
  private isListHovered = () => {
    const hoveredElement = this.inlineMenuListContainer?.querySelector(":hover");
    return !!(
      hoveredElement &&
      (hoveredElement === this.inlineMenuListContainer ||
        this.inlineMenuListContainer.contains(hoveredElement))
    );
  };

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
  private toggleScrollClass = (height?: number, container?: Element) => {
    const localContainer = container || this.ciphersList;
    if (!localContainer) {
      return;
    }
    const scrollbarClass = "inline-menu-list-actions--scrollbar";

    let containerHeight = height;
    if (!containerHeight) {
      const inlineMenuListContainerRects = this.inlineMenuListContainer.getBoundingClientRect();
      containerHeight = inlineMenuListContainerRects.height;
    }

    if (containerHeight >= 170) {
      localContainer.classList.add(scrollbarClass);
      return;
    }

    localContainer.classList.remove(scrollbarClass);
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
    return this.inlineMenuFillType === CipherType.Login;
  };

  /**
   * Identifies if the current focused field is filled by a card cipher.
   */
  private isFilledByCardCipher = () => {
    return this.inlineMenuFillType === CipherType.Card;
  };

  /**
   * Identifies if the current focused field is filled by an identity cipher.
   */
  private isFilledByIdentityCipher = () => {
    return this.inlineMenuFillType === CipherType.Identity;
  };

  /**
   * Identifies if the current focused field is filled by an contact cipher.
   */
  private isFilledByContactCipher = () => {
    return this.inlineMenuFillType === CipherType.Contact;
  };

  /* Cozy customization */

  /* * * * * * * * * * * */
  /* *   Action menu   * */
  /* * * * * * * * * * * */

  private buildActionMenu(
    actionMenuData: ActionMenuData,
    onBack: (cipher: InlineMenuCipherData) => void,
  ) {
    this.inlineMenuListContainer.innerHTML = "";
    this.inlineMenuListContainer.classList.remove("inline-menu-list-container");

    let actionMenuHeader;

    const ulElement = globalThis.document.createElement("ul");
    ulElement.classList.add("inline-menu-list-actions");
    ulElement.setAttribute("role", "list");
    ulElement.addEventListener(EVENTS.SCROLL, this.updateCiphersListOnScroll);

    if (actionMenuData.type === "contact") {
      const { cipher } = actionMenuData;

      actionMenuHeader = this.buildNewListHeader(this.buildCipherName(cipher), () =>
        onBack(cipher),
      );

      const viewCipherActionElement = this.createViewCipherAction(cipher);
      ulElement.appendChild(viewCipherActionElement);

      const modifyCipherActionElement = this.createModifyCipherAction(cipher.id, false);
      ulElement.appendChild(modifyCipherActionElement);

      const autofillCurrentElement = this.createAutofillCurrentAction(cipher, {
        fillOnlyTheseFieldQualifiers: [this.fieldQualifier],
      });
      ulElement.appendChild(autofillCurrentElement);

      const autofillAllElement = this.createAutofillAllAction(cipher);
      ulElement.appendChild(autofillAllElement);
    } else if (actionMenuData.type === "field") {
      const { inlineMenuCipherId, fieldQualifier, cozyAutofillOptions } = actionMenuData;

      const cipher = this.ciphers.find(({ id }) => id === inlineMenuCipherId);

      actionMenuHeader = this.buildNewListHeader(cozyAutofillOptions.value, () => onBack(cipher));

      const autofillCurrentElement = this.createAutofillCurrentAction(cipher, {
        ...cozyAutofillOptions,
        fillOnlyTheseFieldQualifiers: [fieldQualifier],
      });

      const fieldModel = COZY_ATTRIBUTES_MAPPING[fieldQualifier];
      const isPaperModel = isPaperAttributesModel(fieldModel);
      const id = isPaperModel ? cozyAutofillOptions.id : cipher.id;

      const editCurrentElement = this.createModifyCipherAction(
        id,
        isPaperModel,
        cozyAutofillOptions.qualificationLabel,
        cozyAutofillOptions.metadataName,
      );
      ulElement.appendChild(editCurrentElement);

      ulElement.appendChild(autofillCurrentElement);

      const autofillAllElement = this.createAutofillAllAction(cipher);
      ulElement.appendChild(autofillAllElement);
      // Add action menu for header here
      // } else if (actionMenuData.type === "fieldHeader") {
      //   const { inlineMenuCipherId } = actionMenuData;
      //   const cipher = this.ciphers.find(({ id }) => id === inlineMenuCipherId);
      //   actionMenuHeader = this.buildNewListHeader(this.buildCipherName(cipher), () =>
      //     onBack(cipher),
      //   );
      //   const modifyCipherActionElement = this.createModifyCipherAction(cipher);
      //   ulElement.appendChild(modifyCipherActionElement);
    }
    this.inlineMenuListContainer.appendChild(actionMenuHeader);
    this.inlineMenuListContainer.appendChild(ulElement);
  }

  private buildActionButton(icon: string, onClick: () => void) {
    const actionMenuButtonElement = document.createElement("button");
    actionMenuButtonElement.tabIndex = -1;
    actionMenuButtonElement.classList.add("action-button-header");

    actionMenuButtonElement.append(buildSvgDomElement(icon));
    actionMenuButtonElement.addEventListener(EVENTS.CLICK, onClick);

    return actionMenuButtonElement;
  }

  private buildActionMenuButton(actionMenuData: ActionMenuData, onBack: () => void) {
    const actionMenuButtonElement = document.createElement("button");
    actionMenuButtonElement.tabIndex = -1;
    actionMenuButtonElement.classList.add("view-cipher-button");
    actionMenuButtonElement.setAttribute("aria-label", "Action menu");

    actionMenuButtonElement.append(buildSvgDomElement(ellipsisIcon));
    actionMenuButtonElement.addEventListener(EVENTS.CLICK, () =>
      this.buildActionMenu(actionMenuData, onBack),
    );

    return actionMenuButtonElement;
  }

  private editPapersMessage = (id: string, qualificationLabel: string, metadataName: string) => {
    this.postMessageToParent({
      command: "redirectToCozy",
      to: "mespapiers",
      hash: `paper/files/${qualificationLabel}/${id}/edit/information?metadata=${metadataName}`,
    });
  };

  private editContactMessage = (id: string) => {
    this.postMessageToParent({
      command: "redirectToCozy",
      to: "contacts",
      hash: "<id>/edit",
      inlineMenuCipherId: id,
    });
  };

  private createViewCipherAction(cipher: InlineMenuCipherData) {
    const li = this.createActionMenuItem(
      this.getTranslation("view"),
      viewCipherIcon,
      this.handleViewCipherClickEvent(cipher),
    );

    return li;
  }

  private createModifyCipherAction(
    id: string,
    isPaperModel: boolean,
    qualificationLabel?: string,
    metadataName?: string,
  ) {
    const li = this.createActionMenuItem(this.getTranslation("edit"), penIcon, () =>
      isPaperModel
        ? this.editPapersMessage(id, qualificationLabel, metadataName)
        : this.editContactMessage(id),
    );

    return li;
  }

  private createAutofillAllAction(cipher: InlineMenuCipherData) {
    const li = this.createActionMenuItem(
      this.getTranslation("autofillAll"),
      fillMultipleFieldsIcon,
      () =>
        this.postMessageToParent({
          command: "fillAutofillInlineMenuCipher",
          inlineMenuCipherId: cipher.id,
        }),
    );

    return li;
  }

  private createAutofillCurrentAction(
    cipher: InlineMenuCipherData,
    cozyAutofillOptions: CozyAutofillOptions,
  ) {
    const li = this.createActionMenuItem(
      this.getTranslation(`autofill_${cozyAutofillOptions.fillOnlyTheseFieldQualifiers[0]}`),
      fillFieldIcon,
      this.handleFillCipherWithCozyDataClickEvent(cipher.id, cozyAutofillOptions, uniqueId()),
    );

    return li;
  }

  /**
   * @param title
   * @param onClick - Callback executed when clicking on the item
   */
  private createActionMenuItem(title: string, icon: string, onClick: any) {
    const listItem = document.createElement("li");
    listItem.setAttribute("role", "listitem");
    listItem.classList.add(
      "inline-menu-list-actions-item",
      "inline-menu-list-actions-item--no-border",
    );

    const div = document.createElement("div");
    div.classList.add("cipher-container");

    const fillButton = document.createElement("button");
    fillButton.setAttribute("tabindex", "-1");
    fillButton.classList.add("fill-cipher-button", "inline-menu-list-action");
    fillButton.setAttribute("aria-label", title);
    fillButton.addEventListener(EVENTS.CLICK, onClick);

    const detailsSpan = document.createElement("span");
    detailsSpan.classList.add("cipher-details");

    const nameSpan = document.createElement("span");
    nameSpan.setAttribute("title", title);
    nameSpan.textContent = title;
    nameSpan.classList.add("cipher-name");

    const iconElement = buildSvgDomElement(icon);
    iconElement.style.margin = "0 2rem 0 1.3rem";

    detailsSpan.appendChild(nameSpan);
    fillButton.appendChild(iconElement);
    fillButton.appendChild(detailsSpan);

    div.appendChild(fillButton);
    listItem.appendChild(div);

    return listItem;
  }
  /* Cozy customization end; action menu */
}
