import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { CipherType } from "@bitwarden/common/vault/enums";

import { InlineMenuCipherData } from "../../../background/abstractions/overlay.background";

/* start Cozy imports */
/* eslint-disable */
import { AutofillFieldQualifierType } from "src/autofill/enums/autofill-field.enums";
/* eslint-enable */
/* end Cozy imports */

type AutofillInlineMenuListMessage = { command: string };

export type UpdateAutofillInlineMenuListCiphersMessage = AutofillInlineMenuListMessage & {
  ciphers: InlineMenuCipherData[];
  showInlineMenuAccountCreation?: boolean;
};

export type InitAutofillInlineMenuListMessage = AutofillInlineMenuListMessage & {
  authStatus: AuthenticationStatus;
  styleSheetUrl: string;
  theme: string;
  translations: Record<string, string>;
  ciphers?: InlineMenuCipherData[];
  // Cozy customization
  lastFilledCipherId?: string;
  fieldQualifier?: AutofillFieldQualifierType;
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
  focusAutofillInlineMenuList: () => void;
};
