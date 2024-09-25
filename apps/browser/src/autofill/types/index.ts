import { ContactAddress, ContactEmail, ContactPhone } from "cozy-client/types/types";

import { Region } from "@bitwarden/common/platform/abstractions/environment.service";
import { VaultTimeoutAction } from "@bitwarden/common/src/enums/vault-timeout-action.enum";
import { VaultTimeout } from "@bitwarden/common/types/vault-timeout.type";
import { CipherType } from "@bitwarden/common/vault/enums";

import { InlineMenuCipherData } from "../background/abstractions/overlay.background";
import { AutofillFieldQualifierType } from "../enums/autofill-field.enums";
import { CozyAutofillOptions } from "../services/abstractions/autofill.service";

export type UserSettings = {
  avatarColor: string | null;
  environmentUrls: {
    api: string | null;
    base: string | null;
    events: string | null;
    icons: string | null;
    identity: string | null;
    keyConnector: string | null;
    notifications: string | null;
    webVault: string | null;
  };
  pinProtected: { [key: string]: any };
  region: Region;
  serverConfig: {
    environment: {
      api: string | null;
      cloudRegion: string | null;
      identity: string | null;
      notifications: string | null;
      sso: string | null;
      vault: string | null;
    };
    featureStates: { [key: string]: any };
    gitHash: string;
    server: { [key: string]: any };
    utcDate: string;
    version: string;
  };
  vaultTimeout: VaultTimeout;
  vaultTimeoutAction: VaultTimeoutAction;
};

/**
 * A HTMLElement (usually a form element) with additional custom properties added by this script
 */
export type ElementWithOpId<T> = T & {
  opid: string;
};

/**
 * A Form Element that we can set a value on (fill)
 */
export type FillableFormFieldElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/**
 * The autofill script's definition of a Form Element (only a subset of HTML form elements)
 */
export type FormFieldElement = FillableFormFieldElement | HTMLSpanElement;

export type FormElementWithAttribute = FormFieldElement & Record<string, string | null | undefined>;

export type AutofillCipherTypeId = CipherType.Login | CipherType.Card | CipherType.Identity;

// Cozy customization
export type AmbiguousContactFieldName = "phone" | "email" | "address";
export type AddressContactSubFieldName = "city" | "state" | "country" | "postalCode";

export type AmbiguousContactFields = {
  phone?: ContactPhone[];
  email?: ContactEmail[];
  address?: ContactAddress[];
};

export type AmbiguousContactFieldValue = ContactPhone[] | ContactEmail[] | ContactAddress[];

export type AvailablePapers = {
  name?: string; // the file name
  value?: string; // we are interested in only one value in the file metadata
};

type ContactActionMenuData = {
  type: "contact";
  cipher: InlineMenuCipherData;
};

type FieldActionMenuData = {
  type: "field";
  inlineMenuCipherId: string;
  fieldQualifier: AutofillFieldQualifierType;
  cozyAutofillOptions: CozyAutofillOptions;
};

export type ActionMenuData = ContactActionMenuData | FieldActionMenuData;
// Cozy customization end
