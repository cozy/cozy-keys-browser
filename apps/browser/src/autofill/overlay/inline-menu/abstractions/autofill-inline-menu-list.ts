import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { CipherType } from "@bitwarden/common/vault/enums";

import { InlineMenuCipherData } from "../../../background/abstractions/overlay.background";

/* start Cozy imports */
/* eslint-disable */
import { AmbiguousContactFields, AvailablePapers } from "src/autofill/types";
import { AutofillFieldQualifierType } from "src/autofill/enums/autofill-field.enums";
import { IOCozyContact } from "cozy-client/types/types";
import { CozyContactFieldNames, CozyPaperFieldNames } from "../../../../../../../libs/cozy/mapping";
import { CozyAutofillOptions } from "src/autofill/services/abstractions/autofill.service";
/* eslint-enable */
/* end Cozy imports */

type AutofillInlineMenuListMessage = { command: string };

export type UpdateAutofillInlineMenuListCiphersMessage = AutofillInlineMenuListMessage & {
  ciphers: InlineMenuCipherData[];
  showInlineMenuAccountCreation?: boolean;
  searchValue?: string;
};

// Cozy customization
export type UpdateAutofillInlineMenuListAmbiguousMessage = AutofillInlineMenuListMessage & {
  inlineMenuCipherId: string;
  contactName: string;
  ambiguousFields: AmbiguousContactFields;
  isFocusedFieldAmbigous: boolean;
  fieldHtmlIDToFill: string;
};

export type UpdateAutofillInlineMenuListPaperMessage = AutofillInlineMenuListMessage & {
  inlineMenuCipherId: string;
  contactName: string;
  availablePapers: AvailablePapers[];
  fieldHtmlIDToFill: string;
};
// Cozy customization end

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
  filledByCipherType?: CipherType;
  showInlineMenuAccountCreation?: boolean;
  portKey: string;
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
  paperList: ({ message }: { message: UpdateAutofillInlineMenuListPaperMessage }) => void;
  createEmptyNameList: ({
    message,
  }: {
    message: UpdateAutofillInlineMenuListAmbiguousMessage;
  }) => void;
  // Cozy customization end
  focusAutofillInlineMenuList: () => void;
};

export type InputRef = {
  [key in CozyContactFieldNames]: HTMLInputElement;
};

export type InputRefValue = {
  [key in CozyContactFieldNames | CozyPaperFieldNames]: string;
} & {
  label: CozyAutofillOptions["label"];
  type: CozyAutofillOptions["type"];
};

export type EditContactButtonsParams = {
  inlineMenuCipherId: string;
  fieldHtmlIDToFill?: string;
  fieldQualifier?: string;
  selectElement?: HTMLSelectElement | null;
  inputRefs?: InputRef[];
};
