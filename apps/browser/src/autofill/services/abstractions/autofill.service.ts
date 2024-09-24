import { Observable } from "rxjs";

import { UriMatchStrategySetting } from "@bitwarden/common/models/domain/domain-service";
import { CommandDefinition } from "@bitwarden/common/platform/messaging";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { AutofillMessageCommand } from "../../enums/autofill-message.enums";
import AutofillField from "../../models/autofill-field";
import AutofillForm from "../../models/autofill-form";
import AutofillPageDetails from "../../models/autofill-page-details";

export interface PageDetail {
  frameId: number;
  tab: chrome.tabs.Tab;
  details: AutofillPageDetails;
  sender?: any;
}

// Cozy customization
export interface CozyAutofillOptions {
  type?: string;
  label?: "work" | "home";
  value?: string;
  fillOnlyThisFieldHtmlID?: string;
}
// Cozy customization end

export interface AutoFillOptions {
  cipher: CipherView;
  pageDetails: PageDetail[];
  doc?: typeof self.document;
  tab: chrome.tabs.Tab;
  skipUsernameOnlyFill?: boolean;
  onlyEmptyFields?: boolean;
  onlyVisibleFields?: boolean;
  fillNewPassword?: boolean;
  skipLastUsed?: boolean;
  allowUntrustedIframe?: boolean;
  allowTotpAutofill?: boolean;
  // Cozy customization
  cozyAutofillOptions?: CozyAutofillOptions;
  // Cozy customization end
}

export interface FormData {
  form: AutofillForm;
  password: AutofillField;
  username: AutofillField;
  passwords: AutofillField[];
}

export interface GenerateFillScriptOptions {
  skipUsernameOnlyFill: boolean;
  onlyEmptyFields: boolean;
  onlyVisibleFields: boolean;
  fillNewPassword: boolean;
  allowTotpAutofill: boolean;
  cipher: CipherView;
  tabUrl: string;
  defaultUriMatch: UriMatchStrategySetting;
  // Cozy customization
  cozyAutofillOptions?: CozyAutofillOptions;
  // Cozy customization end
}

export type CollectPageDetailsResponseMessage = {
  tab: chrome.tabs.Tab;
  details: AutofillPageDetails;
  sender?: string;
  webExtSender: chrome.runtime.MessageSender;
};

export const COLLECT_PAGE_DETAILS_RESPONSE_COMMAND =
  new CommandDefinition<CollectPageDetailsResponseMessage>(
    AutofillMessageCommand.collectPageDetailsResponse,
  );

export abstract class AutofillService {
  collectPageDetailsFromTab$: (tab: chrome.tabs.Tab) => Observable<PageDetail[]>;
  loadAutofillScriptsOnInstall: () => Promise<void>;
  reloadAutofillScripts: () => Promise<void>;
  injectAutofillScripts: (
    tab: chrome.tabs.Tab,
    frameId?: number,
    triggeringOnPageLoad?: boolean,
  ) => Promise<void>;
  getFormsWithPasswordFields: (pageDetails: AutofillPageDetails) => FormData[];
  doAutoFill: (options: AutoFillOptions) => Promise<string | null>;
  doAutoFillOnTab: (
    pageDetails: PageDetail[],
    tab: chrome.tabs.Tab,
    fromCommand: boolean,
  ) => Promise<string | null>;
  doAutoFillActiveTab: (
    pageDetails: PageDetail[],
    fromCommand: boolean,
    cipherType?: CipherType,
  ) => Promise<string | null>;
  setAutoFillOnPageLoadOrgPolicy: () => Promise<void>;
  isPasswordRepromptRequired: (cipher: CipherView, tab: chrome.tabs.Tab) => Promise<boolean>;
  getDefaultUriMatchStrategy: () => Promise<UriMatchStrategySetting>;
}
