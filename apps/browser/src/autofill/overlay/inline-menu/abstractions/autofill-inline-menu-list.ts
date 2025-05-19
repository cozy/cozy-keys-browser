import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";

import { InlineMenuCipherData } from "../../../background/abstractions/overlay.background";
import { InlineMenuFillTypes } from "../../../enums/autofill-overlay.enum";

/* start Cozy imports */
/* eslint-disable */
import { AmbiguousContactFields } from "src/autofill/types";
import { AutofillFieldQualifierType } from "src/autofill/enums/autofill-field.enums";
import { CozyContactFieldNames } from "../../../../../../../libs/cozy/mapping";
import { CozyAutofillOptions } from "src/autofill/services/abstractions/autofill.service";
/* eslint-enable */
/* end Cozy imports */

type AutofillInlineMenuListMessage = { command: string };

export type UpdateAutofillInlineMenuListCiphersParams = {
  ciphers: InlineMenuCipherData[];
  showInlineMenuAccountCreation?: boolean;
  searchValue?: string;
  isBack?: boolean;
};

// Cozy customization
export type UpdateAutofillInlineMenuListAmbiguousMessage = AutofillInlineMenuListMessage & {
  inlineMenuCipherId: string;
  contactName: string;
  ambiguousFields: AmbiguousContactFields;
  isFocusedFieldAmbigous: boolean;
  fieldHtmlIDToFill: string;
  focusedFieldName: string;
};
// Cozy customization end

export type UpdateAutofillInlineMenuListCiphersMessage = AutofillInlineMenuListMessage &
  UpdateAutofillInlineMenuListCiphersParams;

export type UpdateAutofillInlineMenuGeneratedPasswordMessage = AutofillInlineMenuListMessage & {
  generatedPassword: string;
};

export type InitAutofillInlineMenuListMessage = AutofillInlineMenuListMessage & {
  authStatus: AuthenticationStatus;
  styleSheetUrl: string;
  theme: string;
  translations: Record<string, string>;
  ciphers?: InlineMenuCipherData[];
  // Cozy customization
  lastFilledContactCipherId?: string;
  fieldQualifier?: AutofillFieldQualifierType;
  fieldHtmlID?: string;
  fieldValue?: string;
  // Cozy customization end
  inlineMenuFillType?: InlineMenuFillTypes;
  showInlineMenuAccountCreation?: boolean;
  showPasskeysLabels?: boolean;
  portKey: string;
  generatedPassword?: string;
  showSaveLoginMenu?: boolean;
};

export type AutofillInlineMenuListWindowMessageHandlers = {
  [key: string]: CallableFunction;
  initAutofillInlineMenuList: ({ message }: { message: InitAutofillInlineMenuListMessage }) => void;
  checkAutofillInlineMenuListFocused: () => void;
  updateAutofillInlineMenuListCiphers: ({
    message,
  }: {
    message: UpdateAutofillInlineMenuListCiphersMessage;
  }) => void;
  // Cozy customization
  ambiguousFieldList: ({
    message,
  }: {
    message: UpdateAutofillInlineMenuListAmbiguousMessage;
  }) => void;
  createEmptyNameList: ({
    message,
  }: {
    message: UpdateAutofillInlineMenuListAmbiguousMessage;
  }) => void;
  // Cozy customization end
  updateAutofillInlineMenuGeneratedPassword: ({
    message,
  }: {
    message: UpdateAutofillInlineMenuGeneratedPasswordMessage;
  }) => void;
  focusAutofillInlineMenuList: () => void;
};

export type InputRef = {
  key: CozyContactFieldNames;
  element: HTMLInputElement;
  fieldQualifier: AutofillFieldQualifierType;
};

export type InputRefValue = {
  key: CozyContactFieldNames;
  value: string;
  fieldQualifier: AutofillFieldQualifierType;
};

export type InputValues = {
  values: InputRefValue[];
  label?: CozyAutofillOptions["label"];
  type?: CozyAutofillOptions["type"];
};

export type EditContactButtonsParams = {
  inlineMenuCipherId: string;
  fieldHtmlIDToFill?: string;
  fieldQualifier?: string;
  selectElement?: HTMLSelectElement | null;
  inputRefs?: InputRef[];
};
