import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { CipherType } from "@bitwarden/common/vault/enums";

import { InlineMenuCipherData } from "../../../background/abstractions/overlay.background";

/* start Cozy imports */
/* eslint-disable */
import { AmbiguousContactFields } from "src/autofill/types";
import { AutofillFieldQualifierType } from "src/autofill/enums/autofill-field.enums";
import { IOCozyContact } from "cozy-client/types/types";
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
// Cozy customization end

export type InitAutofillInlineMenuListMessage = AutofillInlineMenuListMessage & {
  authStatus: AuthenticationStatus;
  styleSheetUrl: string;
  theme: string;
  translations: Record<string, string>;
  ciphers?: InlineMenuCipherData[];
  // Cozy customization
  lastFilledCipherId?: string;
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
  editContactFields: ({
    message,
  }: {
    message: UpdateAutofillInlineMenuListAmbiguousMessage;
  }) => void;
  // Cozy customization end
  focusAutofillInlineMenuList: () => void;
};
