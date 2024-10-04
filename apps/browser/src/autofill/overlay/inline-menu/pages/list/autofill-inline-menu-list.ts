import "@webcomponents/custom-elements";
import "lit/polyfill-support.js";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { EVENTS } from "@bitwarden/common/autofill/constants";
import { CipherType } from "@bitwarden/common/vault/enums";

import { InlineMenuCipherData } from "../../../../background/abstractions/overlay.background";
import {
  addressFieldNames,
  ambiguousContactFieldNames,
  buildSvgDomElement,
  getAmbiguousValueKey,
  makeAmbiguousValueLabel,
  makeEditContactField,
  makeEditContactSelectElement,
} from "../../../../utils";
import {
  backIcon,
  globeIcon,
  lockIcon,
  plusIcon,
  viewCipherIcon,
  magnifier,
  contact,
  address,
  penIcon,
  fillFieldIcon,
  fillMultipleFieldsIcon,
  ellipsisIcon,
} from "../../../../utils/svg-icons";
import {
  AutofillInlineMenuListWindowMessageHandlers,
  EditContactButtonsParams,
  InitAutofillInlineMenuListMessage,
  InputRef,
  InputRefValue,
  InputValues,
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
  CozyContactFieldNames,
  cozypaperFieldNames,
} from "../../../../../../../../libs/cozy/mapping";
import { CozyAutofillOptions } from "src/autofill/services/abstractions/autofill.service";
import { fields } from "../../../../../../../../libs/cozy/contact.lib";
/* eslint-enable */
/* end Cozy imports */

export class AutofillInlineMenuList extends AutofillInlineMenuPageElement {
  private inlineMenuListContainer: HTMLDivElement;
  private actionMenuContainer: HTMLDivElement;
  private resizeObserver: ResizeObserver;
  private eventHandlersMemo: { [key: string]: EventListener } = {};
  private ciphers: InlineMenuCipherData[] = [];
  private ciphersList: HTMLUListElement;
  private cipherListScrollIsDebounced = false;
  private cipherListScrollDebounceTimeout: number | NodeJS.Timeout;
  private currentCipherIndex = 0;
  private filledByCipherType: CipherType;
  // Cozy customization
  private lastFilledContactCipherId: string;
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
      paperList: ({ message }) =>
        this.paperList(
          message.inlineMenuCipherId,
          message.contactName,
          message.availablePapers,
          message.fieldHtmlIDToFill,
        ),
      loadPageOfCiphers: () => this.loadPageOfCiphers(),
      focusAutofillInlineMenuList: () => this.focusInlineMenuList(),
      createEmptyNameList: ({ message }) =>
        this.createEmptyNameList(
          message.inlineMenuCipherId,
          message.contactName,
          message.fieldHtmlIDToFill,
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
      COZY_ATTRIBUTES_MAPPING[this.fieldQualifier].name === "address" ||
      addressFieldNames.includes(
        COZY_ATTRIBUTES_MAPPING[this.fieldQualifier].name as AddressContactSubFieldName,
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
        COZY_ATTRIBUTES_MAPPING[this.fieldQualifier].name as AmbiguousContactFieldName,
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

    const inputRefs = [
      {
        key: COZY_ATTRIBUTES_MAPPING[this.fieldQualifier].name,
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
      this.updateListItems(this.ciphers);
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
    lastFilledContactCipherId,
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
    this.lastFilledContactCipherId = lastFilledContactCipherId;
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
    isBack?: boolean,
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
    if (COZY_ATTRIBUTES_MAPPING[this.fieldQualifier].name === ambiguousKey) {
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
    name: string,
    value: string,
  ) {
    const cozyAutofillOptions = { value };
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
    radio.style.marginRight = "2rem";

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

    let actionMenuButtonElement;

    if (actionMenuData) {
      const cipherId = isContactActionMenuData(actionMenuData)
        ? actionMenuData.cipher.id
        : actionMenuData.inlineMenuCipherId;
      actionMenuButtonElement = this.buildActionButton(penIcon, () =>
        this.editContactMessage(cipherId),
      );
    }

    return this.buildListHeaderContainer(this.newItemButtonElement, actionMenuButtonElement);
  }

  private backToCipherList = () => {
    this.updateListItems(this.ciphers, undefined, undefined, true);
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
    title: string,
  ) {
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
    iconElement.style.margin = "0 2rem 0 0.5rem";

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
  ) {
    this.inlineMenuListContainer.innerHTML = "";
    this.inlineMenuListContainer.classList.remove(
      "inline-menu-list-container--with-new-item-button",
    );

    const addNewLoginButtonContainer = this.buildNewListHeader(contactName, this.backToCipherList);

    const ulElement = globalThis.document.createElement("ul");
    ulElement.classList.add("inline-menu-list-actions");
    ulElement.setAttribute("role", "list");

    const emptyLiTitle = this.getTranslation(`empty_name`);
    const emptyLi = this.createEmptyListItem(emptyLiTitle);
    ulElement.appendChild(emptyLi);

    const newButtonTitle = this.getTranslation("newName");
    const newButton = this.createNewButton(
      inlineMenuCipherId,
      fieldHtmlIDToFill,
      contactName,
      newButtonTitle,
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
    ulElement.addEventListener(EVENTS.SCROLL, this.handleCiphersListScrollEvent, {
      passive: true,
    });

    const firstAmbiguousFieldEntries = Object.entries(ambiguousFields)?.[0];
    const firstAmbiguousFieldName =
      (firstAmbiguousFieldEntries?.[0] as AmbiguousContactFieldName) ||
      (COZY_ATTRIBUTES_MAPPING[this.fieldQualifier].name as AmbiguousContactFieldName);

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
      const emptyLiTitle = this.getTranslation(`empty_ambiguous_${firstAmbiguousFieldName}`);
      const emptyLi = this.createEmptyListItem(emptyLiTitle);
      ulElement.appendChild(emptyLi);
    }

    if (isAmbiguousFieldFocused) {
      let newButtonTitle;
      switch (firstAmbiguousFieldName) {
        case "phone":
          newButtonTitle = this.getTranslation("newPhone");
          break;
        case "email":
          newButtonTitle = this.getTranslation("newEmail");
          break;
        case "address":
          newButtonTitle = this.getTranslation("newAddress");
          break;
        default:
          newButtonTitle = this.getTranslation("newName");
          break;
      }

      const newButton = this.createNewButton(
        inlineMenuCipherId,
        fieldHtmlIDToFill,
        contactName,
        newButtonTitle,
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
    ulElement.addEventListener(EVENTS.SCROLL, this.handleCiphersListScrollEvent, {
      passive: true,
    });

    if (availablePapers.length > 0) {
      for (const paper of availablePapers) {
        const li = this.createPaperListItem(
          inlineMenuCipherId,
          contactName,
          paper.name,
          paper.value,
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
      this.getTranslation(`new_${this.fieldQualifier}`),
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
    // Cozy customization - Add the bottom class to the new item button if the form is filled by a contact cipher
    if (this.isFilledByContactCipher()) {
      this.newItemButtonElement.classList.add("inline-menu-list-button--bottom");
    }
    // Cozy customization end
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
    // Cozy customization - Add the translation for the new item button when the form is filled by a contact cipher
    if (this.isFilledByContactCipher()) {
      return this.getTranslation("newContact");
    }
    // Cozy customization end
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
            lastFilledContactCipherId: this.lastFilledContactCipherId,
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
    ulElement.addEventListener(EVENTS.SCROLL, this.handleCiphersListScrollEvent, {
      passive: true,
    });

    if (actionMenuData.type === "contact") {
      const { cipher } = actionMenuData;

      actionMenuHeader = this.buildNewListHeader(this.buildCipherName(cipher), () =>
        onBack(cipher),
      );

      const viewCipherActionElement = this.createViewCipherAction(cipher);
      ulElement.appendChild(viewCipherActionElement);

      const modifyCipherActionElement = this.createModifyCipherAction(cipher);
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

  private editContactMessage = (cipherId: string) => {
    this.postMessageToParent({
      command: "redirectToCozy",
      to: "contacts",
      hash: "<id>/edit",
      inlineMenuCipherId: cipherId,
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

  private createModifyCipherAction(cipher: InlineMenuCipherData) {
    const li = this.createActionMenuItem(this.getTranslation("edit"), penIcon, () =>
      this.editContactMessage(cipher.id),
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
