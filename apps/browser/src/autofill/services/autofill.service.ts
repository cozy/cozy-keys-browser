import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { LogService } from "@bitwarden/common/abstractions/log.service";
import { SettingsService } from "@bitwarden/common/abstractions/settings.service";
import { TotpService } from "@bitwarden/common/abstractions/totp.service";
import { EventType } from "@bitwarden/common/enums/eventType";
import { FieldType } from "@bitwarden/common/enums/fieldType";
import { UriMatchType } from "@bitwarden/common/enums/uriMatchType";
import { Utils } from "@bitwarden/common/misc/utils";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FieldView } from "@bitwarden/common/vault/models/view/field.view";
import { IdentityView } from "@bitwarden/common/vault/models/view/identity.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";

import { generateIdentityViewFromCipherView } from "../../../../../libs/cozy/contact.helper";
import { BrowserApi } from "../../browser/browserApi";
import {
  evaluateDecisionArray,
  makeDecisionArray,
} from "../../cozy/autofill/evaluateDecisionArray";
import { BrowserStateService } from "../../services/abstractions/browser-state.service";
import AutofillField from "../models/autofill-field";
import AutofillPageDetails from "../models/autofill-page-details";
import AutofillScript from "../models/autofill-script";

import {
  AutoFillOptions,
  AutofillService as AutofillServiceInterface,
  PageDetail,
  FormData,
} from "./abstractions/autofill.service";
import {
  AutoFillConstants,
  CreditCardAutoFillConstants,
  IdentityAutoFillConstants,
} from "./autofill-constants";

export interface GenerateFillScriptOptions {
  skipUsernameOnlyFill: boolean;
  onlyEmptyFields: boolean;
  onlyVisibleFields: boolean;
  fillNewPassword: boolean;
  cipher: CipherView;
  tabUrl: string;
  defaultUriMatch: UriMatchType;
  sender?: string; // Cozy custo
}

export default class AutofillService implements AutofillServiceInterface {
  constructor(
    private cipherService: CipherService,
    private stateService: BrowserStateService,
    private totpService: TotpService,
    private eventCollectionService: EventCollectionService,
    private logService: LogService,
    private settingsService: SettingsService
  ) {}

  getFormsWithPasswordFields(pageDetails: AutofillPageDetails): FormData[] {
    const formData: FormData[] = [];

    const passwordFields = AutofillService.loadPasswordFields(
      pageDetails,
      true,
      true,
      false,
      false
    );
    if (passwordFields.length === 0) {
      return formData;
    }

    for (const formKey in pageDetails.forms) {
      // eslint-disable-next-line
      if (!pageDetails.forms.hasOwnProperty(formKey)) {
        continue;
      }

      const formPasswordFields = passwordFields.filter((pf) => formKey === pf.form);
      if (formPasswordFields.length > 0) {
        let uf = this.findUsernameField(pageDetails, formPasswordFields[0], false, false, false);
        if (uf == null) {
          // not able to find any viewable username fields. maybe there are some "hidden" ones?
          uf = this.findUsernameField(pageDetails, formPasswordFields[0], true, true, false);
        }
        formData.push({
          form: pageDetails.forms[formKey],
          password: formPasswordFields[0],
          username: uf,
          passwords: formPasswordFields,
        });
      }
    }

    return formData;
  }

  /**
   * Autofills a given tab with a given login item
   * @param options Instructions about the autofill operation, including tab and login item
   * @returns The TOTP code of the successfully autofilled login, if any
   */
  async doAutoFill(options: AutoFillOptions): Promise<string> {
    /*
    @override by Cozy : when the user logins into the addon, all tabs requests a pageDetail in order to
    activate the in-page-menu : then the tab to take into account is not the active tab, but the tab sent with
    the pageDetails.
    If the request doesn't come from notificationBar, then it is the current tab to use as a target.
    */
    let tab: any;
    let fillScripts: any[];
    if (options.tab) {
      tab = options.tab;
    } else if (options.pageDetails[0].sender === "notifBarForInPageMenu") {
      tab = options.pageDetails[0].tab;
    } else {
      tab = await this.getActiveTab();
    }
    /* END @override by Cozy */
    if (!tab || !options.cipher || !options.pageDetails || !options.pageDetails.length) {
      throw new Error("Nothing to auto-fill.");
    }

    let totpPromise: Promise<string> = null;

    const canAccessPremium = true;
    const defaultUriMatch = (await this.stateService.getDefaultUriMatch()) ?? UriMatchType.Domain;

    let didAutofill = false;
    options.pageDetails.forEach((pd: any) => {
      // make sure we're still on correct tab
      if (pd.tab.id !== tab.id || pd.tab.url !== tab.url) {
        return;
      }

      const fillScript = this.generateFillScript(pd.details, {
        skipUsernameOnlyFill: options.skipUsernameOnlyFill || false,
        onlyEmptyFields: options.onlyEmptyFields || false,
        onlyVisibleFields: options.onlyVisibleFields || false,
        fillNewPassword: options.fillNewPassword || false,
        cipher: options.cipher,
        tabUrl: tab.url,
        defaultUriMatch: defaultUriMatch,
        sender: pd.sender,
      });

      if (!fillScript || !fillScript.script || !fillScript.script.length) {
        return;
      }

      if (
        fillScript.untrustedIframe &&
        options.allowUntrustedIframe != undefined &&
        !options.allowUntrustedIframe
      ) {
        this.logService.info("Auto-fill on page load was blocked due to an untrusted iframe.");
        return;
      }

      // Add a small delay between operations
      fillScript.properties.delay_between_operations = 20;

      /* Cozy insertion */
      if (options.fieldsForInPageMenuScripts) {
        // means we are preparing a script to activate menu into page fields
        if (fillScript) {
          fillScript.script = fillScript.script.filter((action: any) => {
            if (action[0] !== "fill_by_opid") {
              return false;
            }
            action[0] = "add_menu_btn_by_opid";
            action[3].hasExistingCipher = true;
            action[3].connected = true;
            return true;
          });
          fillScripts = [fillScript, ...options.fieldsForInPageMenuScripts];
        } else {
          fillScripts = options.fieldsForInPageMenuScripts;
        }
        this.postFilterFieldsForInPageMenu(fillScripts, pd.details.forms, pd.details.fields);
      } else {
        fillScripts = fillScript ? [fillScript] : [];
      }
      /* END Cozy insertion */

      didAutofill = true;
      if (!options.skipLastUsed && options.cipher && !options.fieldsForInPageMenuScripts) {
        this.cipherService.updateLastUsedDate(options.cipher.id);
      }

      BrowserApi.tabSendMessage(
        tab,
        {
          command: "fillForm",
          fillScripts: fillScripts, // Cozy
          url: tab.url,
          frameId: pd.frameId,
        },
        { frameId: pd.frameId }
      );

      if (!fillScript) {
        return;
      }
      if (
        options.cipher.type !== CipherType.Login ||
        totpPromise ||
        !options.cipher.login.totp ||
        (!canAccessPremium && !options.cipher.organizationUseTotp)
      ) {
        return;
      }

      totpPromise = this.stateService.getDisableAutoTotpCopy().then((disabled) => {
        if (!disabled) {
          return this.totpService.getCode(options.cipher.login.totp);
        }
        return null;
      });
    });

    if (didAutofill) {
      this.eventCollectionService.collect(EventType.Cipher_ClientAutofilled, options.cipher.id);
      if (totpPromise != null) {
        return await totpPromise;
      } else {
        return null;
      }
    } else {
      throw new Error("Did not auto-fill.");
    }
  }

  /**
   * Autofills the specified tab with the next login item from the cache
   * @param pageDetails The data scraped from the page
   * @param tab The tab to be autofilled
   * @param fromCommand Whether the autofill is triggered by a keyboard shortcut (`true`) or autofill on page load (`false`)
   * @returns The TOTP code of the successfully autofilled login, if any
   */
  async doAutoFillOnTab(
    pageDetails: PageDetail[],
    tab: chrome.tabs.Tab,
    fromCommand: boolean
  ): Promise<string> {
    let cipher: CipherView;
    /* *
    @override by Cozy : when the user logins into the addon, all tabs request a pageDetail in order to
    activate the in-page-menu :
      * then the tab to take into account is not the active tab, but the tab sent with the pageDetails
      * and if there is no cipher for the tab, then request to close in page menu
    */
    let hasFieldsForInPageMenu = false;
    if (pageDetails[0].sender === "notifBarForInPageMenu") {
      cipher = await this.cipherService.getLastUsedForUrl(tab.url, false);
      hasFieldsForInPageMenu =
        pageDetails[0].fieldsForInPageMenuScripts.findIndex((s: any) => {
          s.script.length > 0;
        }) > -1;
      tab = pageDetails[0].tab;
      if (!cipher && !hasFieldsForInPageMenu) {
        // there is no cipher for this URL : deactivate in page menu
        BrowserApi.tabSendMessage(
          tab,
          {
            command: "autofillAnswerRequest",
            subcommand: "inPageMenuDeactivate",
            frameId: pageDetails[0].frameId,
          },
          {
            frameId: pageDetails[0].frameId,
          }
        );
        return;
      }
    } else {
      if (!tab || !tab.url) {
        return;
      }
      /* END @override by Cozy */
      if (fromCommand) {
        cipher = await this.cipherService.getNextCipherForUrl(tab.url);
      } else {
        const lastLaunchedCipher = await this.cipherService.getLastLaunchedForUrl(tab.url, true);
        if (
          lastLaunchedCipher &&
          Date.now().valueOf() - lastLaunchedCipher.localData?.lastLaunched?.valueOf() < 30000
        ) {
          cipher = lastLaunchedCipher;
        } else {
          cipher = await this.cipherService.getLastUsedForUrl(tab.url, true);
        }
      }
      /** Cozy custo
    }
    if (cipher == null || cipher.reprompt !== CipherRepromptType.None) {
      return null;
    }
    */
    }
    if (
      (cipher == null || cipher.reprompt !== CipherRepromptType.None) &&
      !hasFieldsForInPageMenu
    ) {
      return null;
    }
    /** end custo */

    const totpCode = await this.doAutoFill({
      tab: tab,
      cipher: cipher,
      pageDetails: pageDetails,
      skipLastUsed: !fromCommand,
      skipUsernameOnlyFill: !fromCommand,
      onlyEmptyFields: !fromCommand,
      onlyVisibleFields: !fromCommand,
      fillNewPassword: fromCommand,
      allowUntrustedIframe: fromCommand,
      fieldsForInPageMenuScripts: pageDetails[0].fieldsForInPageMenuScripts,
    });

    // Update last used index as autofill has succeed
    if (fromCommand) {
      this.cipherService.updateLastUsedIndexForUrl(tab.url);
    }

    return totpCode;
  }

  /**
   * Autofills the active tab with the next login item from the cache
   * @param pageDetails The data scraped from the page
   * @param fromCommand Whether the autofill is triggered by a keyboard shortcut (`true`) or autofill on page load (`false`)
   * @returns The TOTP code of the successfully autofilled login, if any
   */
  async doAutoFillActiveTab(pageDetails: PageDetail[], fromCommand: boolean): Promise<string> {
    const tab = await this.getActiveTab();
    if (!tab || !tab.url) {
      return;
    }

    return await this.doAutoFillOnTab(pageDetails, tab, fromCommand);
  }

  /* ----------------------------------------------------------------------------- */
  // Select in pageDetails the inputs where the inPageMenu (login or autofill)
  // should be displayed.
  // The selection creteria here a the one common to both login and autofill menu.
  // Add prefilters and postFilters depending on the type of menu.
  async generateFieldsForInPageMenuScripts(pageDetails: any, connected: boolean) {
    if (!pageDetails) {
      return null;
    }
    const scriptForFieldsMenu: any[] = [];

    /*
    Info : for the data structure of ciphers, logins, cards, identities... go there :
      * cipher   : jslib\src\models\data\cipherData.ts
      * login    : jslib\src\models\data\loginData.ts
      * card     : jslib\src\models\data\cardData.ts
      * identity : jslib\src\models\data\identityData.ts
      * ...
    */

    // A] Prepare the model of cipher (wiht a card, identity and login)
    const cipherModel = JSON.parse(`{
      "id": "b9a67ec355b1e5bbe672d6632955bd31",
      "organizationId": null,
      "folderId": null,
      "name": "bbox - Verdon - box",
      "notes": "dd",
      "type": 1,
      "favorite": false,
      "organizationUseTotp": false,
      "edit": true,
      "viewPassword": true,
      "login": {
        "username": "login_username_admin",
        "password": "login_pwd_1234",
        "passwordRevisionDate": null,
        "totp": null,
        "uris": [
         {
          "match": null,
          "uri": "http://gestionbbox.lan/",
          "domain": "gestionbbox.lan",
          "hostname": "gestionbbox.lan",
          "host": null,
          "canLaunch": null
         }
        ]
      },
      "identity": {
        "title": "M.",
        "middleName": "Thim",
        "address1": "13, rue de Verdon, 93100 Lyon",
        "address2": "adress ligne 2",
        "address3": "adress ligne 3",
        "city": "Lyon",
        "state": null,
        "postalCode": "93100",
        "country": "France",
        "company": "Cozy Cloud",
        "email": "mail@dude.com",
        "phone": "+33606205636",
        "ssn": "1 78 12 77 010 065   -   13",
        "username": "identity_username_jojo",
        "passportNumber": "21343245",
        "licenseNumber": "678678678",
        "firstName": "identity_firstName",
        "lastName": "identity_lastName",
        "subTitle": "Josh SMITH"
      },
      "card": {
        "cardholderName": "SMITH",
        "expMonth": "6",
        "expYear": "2028",
        "code": "346",
        "brand": "Mastercard",
        "number": "5581692893367425",
        "subTitle": "Mastercard, *7425"
      },
      "secureNote": {
        "type": null
      },
      "attachments": null,
      "fields": [
        {
         "name": "Clé Wifi SSID : benbox",
         "value": "4567",
         "type": 0,
         "newField": false
        }
      ],
      "passwordHistory": null,
      "collectionIds": null,
      "revisionDate": "2020-09-07T13:32:53.543Z",
      "deletedDate": null,
      "localData": null
    }`);

    const options = {
      skipUsernameOnlyFill: false,
      onlyEmptyFields: false,
      onlyVisibleFields: false,
      cipher: cipherModel,
      fillNewPassword: true,
      tabUrl: "",
      defaultUriMatch: UriMatchType.Never,
    };

    // B1] pre filter the fields into which a login menu should be inserted
    // (field of search forms, field outside any form, include even not viewable fields )
    this.prepareFieldsForInPageMenu(pageDetails);

    // B2] if connected, check if there are ciphers
    let hasIdentities = false;
    let hasContacts = false;
    let hasLogins = false;
    let hasCards = false;
    if (connected) {
      const allCiphers = await this.cipherService.getAllDecrypted();
      for (const cipher of allCiphers) {
        if (cipher.isDeleted) {
          continue;
        }
        hasCards = hasCards || cipher.type === CipherType.Card;
        hasLogins = hasLogins || cipher.type === CipherType.Login;
        hasIdentities = hasIdentities || cipher.type === CipherType.Identity;
        hasContacts = hasContacts || cipher.type === CipherType.Contact;
        if (hasCards && hasLogins && hasIdentities && hasContacts) {
          break;
        }
      }
    } else {
      hasIdentities = true;
      hasContacts = true;
      hasLogins = true;
      hasCards = true;
    }

    // C] generate a standard login fillscript for the generic cipher
    if (hasLogins) {
      let loginLoginMenuFillScript: any = [];
      const loginFS = new AutofillScript(pageDetails.documentUUID);
      const loginFilledFields: { [id: string]: AutofillField } = {};
      loginLoginMenuFillScript = this.generateLoginFillScript(
        loginFS,
        pageDetails,
        loginFilledFields,
        options
      );
      loginLoginMenuFillScript.type = "loginFieldsForInPageMenuScript";
      loginLoginMenuFillScript.script = loginLoginMenuFillScript.script.filter((action: any) => {
        // only 'fill_by_opid' are relevant for the fields wher to add a menu
        if (action[0] !== "fill_by_opid") {
          return false;
        }
        action[0] = "add_menu_btn_by_opid";
        action[3].hasLoginCipher = true;
        action[3].connected = connected;
        return true;
      });
      scriptForFieldsMenu.push(loginLoginMenuFillScript);
    }

    // D] generate a standard card fillscript for the generic cipher
    if (hasCards) {
      let cardLoginMenuFillScript: any = [];
      const cardFS = new AutofillScript(pageDetails.documentUUID);
      const cardFilledFields: { [id: string]: AutofillField } = {};
      cardLoginMenuFillScript = this.generateCardFillScript(
        cardFS,
        pageDetails,
        cardFilledFields,
        options
      );
      cardLoginMenuFillScript.type = "cardFieldsForInPageMenuScript";
      cardLoginMenuFillScript.script = cardLoginMenuFillScript.script.filter((action: any) => {
        // only 'fill_by_opid' are relevant for the fields wher to add a menu
        if (action[0] !== "fill_by_opid") {
          return false;
        }
        action[0] = "add_menu_btn_by_opid";
        action[3].hasCardCipher = true;
        action[3].connected = connected;
        return true;
      });
      scriptForFieldsMenu.push(cardLoginMenuFillScript);
    }

    // E] generate a standard identity fillscript for the generic cipher
    if (hasIdentities) {
      let identityLoginMenuFillScript: any = [];
      const idFS = new AutofillScript(pageDetails.documentUUID);
      const idFilledFields: { [id: string]: AutofillField } = {};
      identityLoginMenuFillScript = this.generateIdentityFillScript(
        idFS,
        pageDetails,
        idFilledFields,
        options
      );
      identityLoginMenuFillScript.type = "identityFieldsForInPageMenuScript";
      identityLoginMenuFillScript.script = identityLoginMenuFillScript.script.filter(
        (action: any) => {
          // only 'fill_by_opid' are relevant for the fields wher to add a menu
          if (action[0] !== "fill_by_opid") {
            return false;
          }
          action[0] = "add_menu_btn_by_opid";
          action[3].hasIdentityCipher = true;
          action[3].connected = connected;
          return true;
        }
      );
      scriptForFieldsMenu.push(identityLoginMenuFillScript);
    }

    // F] generate a standard contact fillscript for the generic cipher
    if (hasContacts) {
      let contactLoginMenuFillScript: any = [];
      const idFS = new AutofillScript(pageDetails.documentUUID);
      const idFilledFields: { [id: string]: AutofillField } = {};

      // For contacts, we create an IdentityView with the contact content to leverage the generateIdentityFillScript.
      try {
        if (options.cipher.type === CipherType.Contact) {
          options.cipher.identity = generateIdentityViewFromCipherView(options.cipher);
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.log("Failed to convert CipherView to IdentityView", e);
      }

      contactLoginMenuFillScript = this.generateIdentityFillScript(
        idFS,
        pageDetails,
        idFilledFields,
        options
      );
      contactLoginMenuFillScript.type = "contactFieldsForInPageMenuScript";
      contactLoginMenuFillScript.script = contactLoginMenuFillScript.script.filter(
        (action: any) => {
          // only 'fill_by_opid' are relevant for the fields wher to add a menu
          if (action[0] !== "fill_by_opid") {
            return false;
          }
          action[0] = "add_menu_btn_by_opid";
          action[3].hasContactCipher = true;
          action[3].connected = connected;
          return true;
        }
      );
      scriptForFieldsMenu.push(contactLoginMenuFillScript);
    }

    return scriptForFieldsMenu;
  }

  /* ----------------------------------------------------------------------------- */
  // Enrich fields of a page detail so that proper filters can be applied  for
  // the login menu.
  // Information added :
  //     * isInForm
  //     * isInSearchForm :
  //           fields into a form which look like a search form.
  //           a form is a "search form" if any of its attibutes includes some keywords such as 'search'
  //     * isInLoginForm :
  //           fields into a form which look like a login form.
  //           a form is a "login form" if any of its attibutes includes some keywords such as 'login'
  //
  prepareFieldsForInPageMenu(pageDetails: any) {
    // enrich each fields
    pageDetails.fields.forEach((field: any) => {
      // 1- test if the forms into the page might be a search, a login or a signup form
      field.isInSearchForm = field.form
        ? this.isSpecificElementHelper(
            pageDetails.forms[field.form],
            ["search", "recherche"],
            ["htmlClass", "htmlAction", "htmlMethod", "htmlID"]
          )
        : false;
      field.isInloginForm = field.form
        ? this.isSpecificElementHelper(
            pageDetails.forms[field.form],
            ["login", "signin"],
            ["htmlAction", "htmlID"]
          )
        : false;
      field.isInSignupForm = field.form
        ? this.isSpecificElementHelper(
            pageDetails.forms[field.form],
            ["signup", "register"],
            ["htmlAction", "htmlID"]
          )
        : false;
      field.isInForm = !!field.form;
      field.formObj = pageDetails.forms[field.form];
      // force to true the viewable property so that the BW process doesn't take this parameter into
      // account for the menu scripts. Original value must be restored afterwhat.
      field.viewableOri = field.viewable;
      field.viewable = true;
    });
  }

  /* -------------------------------------------------------------------------------- */
  // Test if an element (field or form) contains specific markers
  isSpecificElementHelper(element: string, markers: any, attributesToCheck: any) {
    for (const attr of attributesToCheck) {
      // eslint-disable-next-line no-prototype-builtins
      if (!element.hasOwnProperty(attr) || !element[attr]) {
        continue;
      }
      if (AutofillService.isFieldMatch(element[attr], markers)) {
        return true;
      }
    }
    return false;
  }

  /* -------------------------------------------------------------------------------- */
  // Test if a field might correspond to a one time password
  isOtpField(field: any) {
    return this.isSpecificElementHelper(field, ["otp"], ["htmlName", "htmlID"]);
  }

  /* -------------------------------------------------------------------------------- */
  // Filter scripts on different rules to limit the inputs where to add the loginMenu
  postFilterFieldsForInPageMenu(scriptObjs: any, forms: any, fields: any) {
    let actions: any = [];
    scriptObjs.forEach((scriptObj: any) => {
      actions = actions.concat(scriptObj.script);
    });
    // prepare decision array for each action
    for (const action of actions) {
      // count how many actions are linked to a field which are in the same form
      // and are identified to the same cipher.type
      const scriptContext: any = action[3];
      const fieldForm: string = scriptContext.field.form;
      const cipherType: string = scriptContext.cipher.type;
      let nFellows = 1;
      for (const a of actions) {
        if (
          a[3].field.form === fieldForm &&
          a[3].cipher.type === cipherType &&
          a[1] !== action[1]
        ) {
          nFellows += 1;
        }
      }
      switch (scriptContext.cipher.type) {
        case "login":
          scriptContext.loginFellows = nFellows;
          break;
        case "card":
          scriptContext.cardFellows = nFellows;
          break;
        case "identity":
          scriptContext.identityFellows = nFellows;
          break;
        default:
          break;
      }

      const decisionArray = makeDecisionArray(scriptContext);
      scriptContext.ambiguity = decisionArray.ambiguity;
      scriptContext.decisionArray = decisionArray;
    }
    // filter according to decisionArray
    scriptObjs.forEach((scriptObj: any) => {
      scriptObj.script = scriptObj.script.filter((action: any) => {
        if (!evaluateDecisionArray(action)) {
          /* @override by Cozy : this log is required for debug and analysis
          const fieldStr = `${action[1]}, ${action[3].cipher.type}:${action[3].cipher.fieldType}`
          console.log("!! ELIMINATE menu for field", {
            action: fieldStr,
            field: action[3].field,
            cipher: action[3].cipher,
            form: action[3].field.formObj,
          });
          console.log({a_field: fieldStr, ...action[3].decisionArray});
          */

          return false; // remove unwanted action
        }
        /* @override by Cozy : this log is required for debug and analysis
        const fieldStr = `${action[1]}, ${action[3].cipher.type}:${action[3].cipher.fieldType}`
        console.log("ACTIVATE menu for field", {
            action: `${action[1]}, ${action[3].cipher.type}:${action[3].cipher.fieldType}`,
            field: action[3].field,
            cipher: action[3].cipher,
            form: action[3].field.formObj,
          });
        console.log({a_field: fieldStr, ...action[3].decisionArray});
        */

        // finalise the action to send to autofill.js
        const scriptCipher = action[3].cipher;
        const fieldTypeToSend: any = {};
        fieldTypeToSend[scriptCipher.type] = scriptCipher.fieldType;
        if (scriptCipher.fieldFormat) {
          fieldTypeToSend.fieldFormat = scriptCipher.fieldFormat;
        }
        action[3] = fieldTypeToSend;
        return true;
      });
    });

    // in the end, restore the modified fields' attributes so that the BW process continues without modifications
    fields.forEach((f: any) => {
      f.viewable = f.viewableOri;
    });
  }

  // Helpers
  private async getActiveTab(): Promise<chrome.tabs.Tab> {
    const tab = await BrowserApi.getTabFromCurrentWindow();
    if (!tab) {
      throw new Error("No tab found.");
    }

    return tab;
  }

  private generateFillScript(
    pageDetails: AutofillPageDetails,
    options: GenerateFillScriptOptions
  ): AutofillScript {
    if (!pageDetails || !options.cipher) {
      return null;
    }

    let fillScript = new AutofillScript(pageDetails.documentUUID);
    const filledFields: { [id: string]: AutofillField } = {};
    const fields = options.cipher.fields;

    if (fields && fields.length) {
      const fieldNames: string[] = [];

      fields.forEach((f) => {
        if (AutofillService.hasValue(f.name)) {
          fieldNames.push(f.name.toLowerCase());
        }
      });

      pageDetails.fields.forEach((field) => {
        // eslint-disable-next-line
        if (filledFields.hasOwnProperty(field.opid)) {
          return;
        }

        if (!field.viewable && field.tagName !== "span") {
          return;
        }

        const matchingIndex = this.findMatchingFieldIndex(field, fieldNames);
        if (matchingIndex > -1) {
          const matchingField: FieldView = fields[matchingIndex];
          let val: string;
          if (matchingField.type === FieldType.Linked) {
            // Assumption: Linked Field is not being used to autofill a boolean value
            val = options.cipher.linkedFieldValue(matchingField.linkedId) as string;
          } else {
            val = matchingField.value;
            if (val == null && matchingField.type === FieldType.Boolean) {
              val = "false";
            }
          }

          filledFields[field.opid] = field;
          let cipher: any;
          switch (options.cipher.type) {
            case CipherType.Login:
              cipher = { type: "login", fieldType: "customField" };
              break;
            case CipherType.Card:
              cipher = { type: "card", fieldType: "customField" };
              break;
            case CipherType.Identity:
              field.fieldType = "customField";
              cipher = { type: "identity", fieldType: "customField" };
              break;
            case CipherType.Contact:
              field.fieldType = "customField";
              cipher = { type: "contact", fieldType: "customField" };
              break;
          }
          AutofillService.fillByOpid(fillScript, field, val, cipher);
        }
      });
    }

    switch (options.cipher.type) {
      case CipherType.Login:
        fillScript = this.generateLoginFillScript(fillScript, pageDetails, filledFields, options);
        break;
      case CipherType.Card:
        fillScript = this.generateCardFillScript(fillScript, pageDetails, filledFields, options);
        break;
      case CipherType.Identity:
        fillScript = this.generateIdentityFillScript(
          fillScript,
          pageDetails,
          filledFields,
          options
        );
        break;
      case CipherType.Paper:
        /*
          For papers, we only use the custom fields matching.
        */
        break;
      case CipherType.Contact:
        /*
          For contacts, we create an IdentityView with the contact content to leverage the generateIdentityFillScript.
        */
        try {
          options.cipher.identity = generateIdentityViewFromCipherView(options.cipher);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.log("Failed to convert CipherView to IdentityView", e);
        }

        fillScript = this.generateIdentityFillScript(
          fillScript,
          pageDetails,
          filledFields,
          options
        );

        options.cipher.identity = new IdentityView();
        break;
      default:
        return null;
    }

    return fillScript;
  }

  private generateLoginFillScript(
    fillScript: AutofillScript,
    pageDetails: AutofillPageDetails,
    filledFields: { [id: string]: AutofillField },
    options: GenerateFillScriptOptions
  ): AutofillScript {
    if (!options.cipher.login) {
      return null;
    }

    let passwords: AutofillField[] = [];
    let usernames: AutofillField[] = [];
    let pf: AutofillField = null;
    let username: AutofillField = null;
    const login = options.cipher.login;
    fillScript.savedUrls =
      login?.uris?.filter((u) => u.match != UriMatchType.Never).map((u) => u.uri) ?? [];

    const inIframe = pageDetails.url !== options.tabUrl;
    fillScript.untrustedIframe =
      inIframe && !this.iframeUrlMatches(pageDetails.url, options.cipher, options.defaultUriMatch);

    if (!login.password || login.password === "") {
      // No password for this login. Maybe they just wanted to auto-fill some custom fields?
      fillScript = AutofillService.setFillScriptForFocus(filledFields, fillScript);
      return fillScript;
    }

    let passwordFields = AutofillService.loadPasswordFields(
      pageDetails,
      false,
      false,
      options.onlyEmptyFields,
      options.fillNewPassword
    );
    if (!passwordFields.length && !options.onlyVisibleFields) {
      // not able to find any viewable password fields. maybe there are some "hidden" ones?
      passwordFields = AutofillService.loadPasswordFields(
        pageDetails,
        true,
        true,
        options.onlyEmptyFields,
        options.fillNewPassword
      );
    }

    for (const formKey in pageDetails.forms) {
      // eslint-disable-next-line
      if (!pageDetails.forms.hasOwnProperty(formKey)) {
        continue;
      }

      const passwordFieldsForForm: AutofillField[] = [];
      passwordFields.forEach((passField) => {
        if (formKey === passField.form) {
          passwordFieldsForForm.push(passField);
        }
      });

      passwordFields.forEach((passField) => {
        pf = passField;
        passwords.push(pf);

        if (login.username) {
          username = this.findUsernameField(pageDetails, pf, false, false, false);

          if (!username && !options.onlyVisibleFields) {
            // not able to find any viewable username fields. maybe there are some "hidden" ones?
            username = this.findUsernameField(pageDetails, pf, true, true, false);
          }

          if (username) {
            usernames.push(username);
          }
        }
      });
    }

    if (passwordFields.length && !passwords.length) {
      // The page does not have any forms with password fields. Use the first password field on the page and the
      // input field just before it as the username.

      pf = passwordFields[0];
      passwords.push(pf);

      if (login.username && pf.elementNumber > 0) {
        username = this.findUsernameField(pageDetails, pf, false, false, true);

        if (!username && !options.onlyVisibleFields) {
          // not able to find any viewable username fields. maybe there are some "hidden" ones?
          username = this.findUsernameField(pageDetails, pf, true, true, true);
        }

        if (username) {
          usernames.push(username);
        }
      }
    }

    if (!passwordFields.length && !options.skipUsernameOnlyFill) {
      // No password fields on this page. Let's try to just fuzzy fill the username.
      pageDetails.fields.forEach((f) => {
        if (
          f.viewable &&
          (f.type === "text" || f.type === "email" || f.type === "tel") &&
          AutofillService.fieldIsFuzzyMatch(f, AutoFillConstants.UsernameFieldNames)
        ) {
          usernames.push(f);
        }
      });
    }

    /* @override by Cozy : remove otp fields */
    usernames = usernames.filter((field) => {
      return !this.isOtpField(field);
    });
    passwords = passwords.filter((field) => {
      return !this.isOtpField(field);
    });
    /* END @override by Cozy                  */

    usernames.forEach((u) => {
      // eslint-disable-next-line
      if (filledFields.hasOwnProperty(u.opid)) {
        return;
      }

      filledFields[u.opid] = u;
      const cipher = { type: "login", fieldType: "username" };
      AutofillService.fillByOpid(fillScript, u, login.username, cipher);
    });

    passwords.forEach((p) => {
      // eslint-disable-next-line
      if (filledFields.hasOwnProperty(p.opid)) {
        return;
      }

      filledFields[p.opid] = p;
      const cipher = { type: "login", fieldType: "password" };
      AutofillService.fillByOpid(fillScript, p, login.password, cipher);
    });

    fillScript = AutofillService.setFillScriptForFocus(filledFields, fillScript);
    return fillScript;
  }

  private generateCardFillScript(
    fillScript: AutofillScript,
    pageDetails: AutofillPageDetails,
    filledFields: { [id: string]: AutofillField },
    options: GenerateFillScriptOptions
  ): AutofillScript {
    if (!options.cipher.card) {
      return null;
    }

    const fillFields: { [id: string]: AutofillField } = {};

    pageDetails.fields.forEach((f) => {
      if (AutofillService.forCustomFieldsOnly(f)) {
        return;
      }

      if (this.isExcludedType(f.type, AutoFillConstants.ExcludedAutofillTypes)) {
        return;
      }

      for (let i = 0; i < CreditCardAutoFillConstants.CardAttributes.length; i++) {
        const attr = CreditCardAutoFillConstants.CardAttributes[i];
        // eslint-disable-next-line
        if (!f.hasOwnProperty(attr) || !f[attr] || !f.viewable) {
          continue;
        }

        // ref https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill
        // ref https://developers.google.com/web/fundamentals/design-and-ux/input/forms/
        if (
          !fillFields.cardholderName &&
          AutofillService.isFieldMatch(
            f[attr],
            CreditCardAutoFillConstants.CardHolderFieldNames,
            CreditCardAutoFillConstants.CardHolderFieldNameValues
          )
        ) {
          fillFields.cardholderName = f;
          break;
        } else if (
          !fillFields.number &&
          AutofillService.isFieldMatch(
            f[attr],
            CreditCardAutoFillConstants.CardNumberFieldNames,
            CreditCardAutoFillConstants.CardNumberFieldNameValues
          )
        ) {
          fillFields.number = f;
          break;
        } else if (
          !fillFields.exp &&
          AutofillService.isFieldMatch(
            f[attr],
            CreditCardAutoFillConstants.CardExpiryFieldNames,
            CreditCardAutoFillConstants.CardExpiryFieldNameValues
          )
        ) {
          fillFields.exp = f;
          break;
        } else if (
          !fillFields.expMonth &&
          AutofillService.isFieldMatch(f[attr], CreditCardAutoFillConstants.ExpiryMonthFieldNames)
        ) {
          fillFields.expMonth = f;
          break;
        } else if (
          !fillFields.expYear &&
          AutofillService.isFieldMatch(f[attr], CreditCardAutoFillConstants.ExpiryYearFieldNames)
        ) {
          fillFields.expYear = f;
          break;
        } else if (
          !fillFields.code &&
          AutofillService.isFieldMatch(f[attr], CreditCardAutoFillConstants.CVVFieldNames)
        ) {
          fillFields.code = f;
          break;
        } else if (
          !fillFields.brand &&
          AutofillService.isFieldMatch(f[attr], CreditCardAutoFillConstants.CardBrandFieldNames)
        ) {
          fillFields.brand = f;
          break;
        }
      }
    });

    const card = options.cipher.card;
    this.makeScriptAction(fillScript, card, fillFields, filledFields, "cardholderName", "card");
    this.makeScriptAction(fillScript, card, fillFields, filledFields, "number", "card");
    this.makeScriptAction(fillScript, card, fillFields, filledFields, "code", "card");
    this.makeScriptAction(fillScript, card, fillFields, filledFields, "brand", "card");

    if (fillFields.expMonth && AutofillService.hasValue(card.expMonth)) {
      let expMonth: string = card.expMonth;

      if (fillFields.expMonth.selectInfo && fillFields.expMonth.selectInfo.options) {
        let index: number = null;
        const siOptions = fillFields.expMonth.selectInfo.options;
        if (siOptions.length === 12) {
          index = parseInt(card.expMonth, null) - 1;
        } else if (siOptions.length === 13) {
          if (
            siOptions[0][0] != null &&
            siOptions[0][0] !== "" &&
            (siOptions[12][0] == null || siOptions[12][0] === "")
          ) {
            index = parseInt(card.expMonth, null) - 1;
          } else {
            index = parseInt(card.expMonth, null);
          }
        }

        if (index != null) {
          const option = siOptions[index];
          if (option.length > 1) {
            expMonth = option[1];
          }
        }
      } else if (
        (this.fieldAttrsContain(fillFields.expMonth, "mm") ||
          fillFields.expMonth.maxLength === 2) &&
        expMonth.length === 1
      ) {
        expMonth = "0" + expMonth;
      }

      filledFields[fillFields.expMonth.opid] = fillFields.expMonth;
      const cipher = { type: "card", fieldType: "expMonth" };
      AutofillService.fillByOpid(fillScript, fillFields.expMonth, expMonth, cipher);
    }

    if (fillFields.expYear && AutofillService.hasValue(card.expYear)) {
      let expYear: string = card.expYear;
      if (fillFields.expYear.selectInfo && fillFields.expYear.selectInfo.options) {
        for (let i = 0; i < fillFields.expYear.selectInfo.options.length; i++) {
          const o: [string, string] = fillFields.expYear.selectInfo.options[i];
          if (o[0] === card.expYear || o[1] === card.expYear) {
            expYear = o[1];
            break;
          }
          if (
            o[1].length === 2 &&
            card.expYear.length === 4 &&
            o[1] === card.expYear.substring(2)
          ) {
            expYear = o[1];
            break;
          }
          const colonIndex = o[1].indexOf(":");
          if (colonIndex > -1 && o[1].length > colonIndex + 1) {
            const val = o[1].substring(colonIndex + 2);
            if (val != null && val.trim() !== "" && val === card.expYear) {
              expYear = o[1];
              break;
            }
          }
        }
      } else if (
        this.fieldAttrsContain(fillFields.expYear, "yyyy") ||
        fillFields.expYear.maxLength === 4
      ) {
        if (expYear.length === 2) {
          expYear = "20" + expYear;
        }
      } else if (
        this.fieldAttrsContain(fillFields.expYear, "yy") ||
        fillFields.expYear.maxLength === 2
      ) {
        if (expYear.length === 4) {
          expYear = expYear.substr(2);
        }
      }

      filledFields[fillFields.expYear.opid] = fillFields.expYear;
      const cipher = { type: "card", fieldType: "expYear" };
      AutofillService.fillByOpid(fillScript, fillFields.expYear, expYear, cipher);
    }

    if (
      fillFields.exp &&
      AutofillService.hasValue(card.expMonth) &&
      AutofillService.hasValue(card.expYear)
    ) {
      const fullMonth = ("0" + card.expMonth).slice(-2);

      let fullYear: string = card.expYear;
      let partYear: string = null;
      if (fullYear.length === 2) {
        partYear = fullYear;
        fullYear = "20" + fullYear;
      } else if (fullYear.length === 4) {
        partYear = fullYear.substr(2, 2);
      }

      let exp: string = null;
      let format: any; // Cozy
      for (let i = 0; i < CreditCardAutoFillConstants.MonthAbbr.length; i++) {
        /* commented by Cozy : BW testings order is not optimum. Kept in comment to ease modif tracking
        if (
          this.fieldAttrsContain(
            fillFields.exp,
            CreditCardAutoFillConstants.MonthAbbr[i] +
              "/" +
              CreditCardAutoFillConstants.YearAbbrLong[i]
          ) &&
          partYear != null
        ) {
          exp = fullMonth + "/" + partYear;
        } else if (
          this.fieldAttrsContain(
            fillFields.exp,
            CreditCardAutoFillConstants.MonthAbbr[i] +
              "/" +
              CreditCardAutoFillConstants.YearAbbrLong[i]
          )
        ) {
          exp = fullMonth + "/" + fullYear;
        } else if (
          this.fieldAttrsContain(
            fillFields.exp,
            CreditCardAutoFillConstants.YearAbbrShort[i] +
              "/" +
              CreditCardAutoFillConstants.MonthAbbr[i]
          ) &&
          partYear != null
        ) {
          exp = partYear + "/" + fullMonth;
        } else if (
          this.fieldAttrsContain(
            fillFields.exp,
            CreditCardAutoFillConstants.YearAbbrLong[i] +
              "/" +
              CreditCardAutoFillConstants.MonthAbbr[i]
          )
        ) {
          exp = fullYear + "/" + fullMonth;
        } else if (
          this.fieldAttrsContain(
            fillFields.exp,
            CreditCardAutoFillConstants.MonthAbbr[i] +
              "-" +
              CreditCardAutoFillConstants.YearAbbrShort[i]
          ) &&
          partYear != null
        ) {
          exp = fullMonth + "-" + partYear;
        } else if (
          this.fieldAttrsContain(
            fillFields.exp,
            CreditCardAutoFillConstants.MonthAbbr[i] +
              "-" +
              CreditCardAutoFillConstants.YearAbbrLong[i]
          )
        ) {
          exp = fullMonth + "-" + fullYear;
        } else if (
          this.fieldAttrsContain(
            fillFields.exp,
            CreditCardAutoFillConstants.YearAbbrShort[i] +
              "-" +
              CreditCardAutoFillConstants.MonthAbbr[i]
          ) &&
          partYear != null
        ) {
          exp = partYear + "-" + fullMonth;
        } else if (
          this.fieldAttrsContain(
            fillFields.exp,
            CreditCardAutoFillConstants.YearAbbrLong[i] +
              "-" +
              CreditCardAutoFillConstants.MonthAbbr[i]
          )
        ) {
          exp = fullYear + "-" + fullMonth;
        } else if (
          this.fieldAttrsContain(
            fillFields.exp,
            CreditCardAutoFillConstants.YearAbbrShort[i] + CreditCardAutoFillConstants.MonthAbbr[i]
          ) &&
          partYear != null
        ) {
          exp = partYear + fullMonth;
        } else if (
          this.fieldAttrsContain(
            fillFields.exp,
            CreditCardAutoFillConstants.YearAbbrLong[i] + CreditCardAutoFillConstants.MonthAbbr[i]
          )
        ) {
          exp = fullYear + fullMonth;
        } else if (
          this.fieldAttrsContain(
            fillFields.exp,
            CreditCardAutoFillConstants.MonthAbbr[i] + CreditCardAutoFillConstants.YearAbbrShort[i]
          ) &&
          partYear != null
        ) {
          exp = fullMonth + partYear;
        } else if (
          this.fieldAttrsContain(
            fillFields.exp,
            CreditCardAutoFillConstants.MonthAbbr[i] + CreditCardAutoFillConstants.YearAbbrLong[i]
          )
        ) {
          exp = fullMonth + fullYear;
        }
        END Cozy comment */

        /* Cozy testing version */
        if (
          this.fieldAttrsContain(
            fillFields.exp,
            CreditCardAutoFillConstants.MonthAbbr[i] +
              "/" +
              CreditCardAutoFillConstants.YearAbbrLong[i]
          )
        ) {
          exp = fullMonth + "/" + fullYear;
          format = {
            type: "expDate",
            separator: "/",
            isFullYear: true,
            isMonthFirst: true,
          };
        } else if (
          this.fieldAttrsContain(
            fillFields.exp,
            CreditCardAutoFillConstants.MonthAbbr[i] +
              "/" +
              CreditCardAutoFillConstants.YearAbbrShort[i]
          ) &&
          partYear != null
        ) {
          exp = fullMonth + "/" + partYear;
          format = {
            type: "expDate",
            separator: "/",
            isFullYear: false,
            isMonthFirst: true,
          };
        } else if (
          this.fieldAttrsContain(
            fillFields.exp,
            CreditCardAutoFillConstants.YearAbbrLong[i] +
              "/" +
              CreditCardAutoFillConstants.MonthAbbr[i]
          )
        ) {
          exp = fullYear + "/" + fullMonth;
          format = {
            type: "expDate",
            separator: "/",
            isFullYear: true,
            isMonthFirst: false,
          };
        } else if (
          this.fieldAttrsContain(
            fillFields.exp,
            CreditCardAutoFillConstants.YearAbbrShort[i] +
              "/" +
              CreditCardAutoFillConstants.MonthAbbr[i]
          ) &&
          partYear != null
        ) {
          exp = partYear + "/" + fullMonth;
          format = {
            type: "expDate",
            separator: "/",
            isFullYear: false,
            isMonthFirst: false,
          };
        } else if (
          this.fieldAttrsContain(
            fillFields.exp,
            CreditCardAutoFillConstants.MonthAbbr[i] +
              "-" +
              CreditCardAutoFillConstants.YearAbbrLong[i]
          )
        ) {
          exp = fullMonth + "-" + fullYear;
          format = {
            type: "expDate",
            separator: "-",
            isFullYear: true,
            isMonthFirst: true,
          };
        } else if (
          this.fieldAttrsContain(
            fillFields.exp,
            CreditCardAutoFillConstants.MonthAbbr[i] +
              "-" +
              CreditCardAutoFillConstants.YearAbbrShort[i]
          ) &&
          partYear != null
        ) {
          exp = fullMonth + "-" + partYear;
          format = {
            type: "expDate",
            separator: "-",
            isFullYear: false,
            isMonthFirst: true,
          };
        } else if (
          this.fieldAttrsContain(
            fillFields.exp,
            CreditCardAutoFillConstants.YearAbbrLong[i] +
              "-" +
              CreditCardAutoFillConstants.MonthAbbr[i]
          )
        ) {
          exp = fullYear + "-" + fullMonth;
          format = {
            type: "expDate",
            separator: "-",
            isFullYear: true,
            isMonthFirst: false,
          };
        } else if (
          this.fieldAttrsContain(
            fillFields.exp,
            CreditCardAutoFillConstants.YearAbbrShort[i] +
              "-" +
              CreditCardAutoFillConstants.MonthAbbr[i]
          ) &&
          partYear != null
        ) {
          exp = partYear + "-" + fullMonth;
          format = {
            type: "expDate",
            separator: "-",
            isFullYear: false,
            isMonthFirst: false,
          };
        } else if (
          this.fieldAttrsContain(
            fillFields.exp,
            CreditCardAutoFillConstants.YearAbbrLong[i] + CreditCardAutoFillConstants.MonthAbbr[i]
          )
        ) {
          exp = fullYear + fullMonth;
          format = {
            type: "expDate",
            separator: "",
            isFullYear: true,
            isMonthFirst: false,
          };
        } else if (
          this.fieldAttrsContain(
            fillFields.exp,
            CreditCardAutoFillConstants.YearAbbrShort[i] + CreditCardAutoFillConstants.MonthAbbr[i]
          ) &&
          partYear != null
        ) {
          exp = partYear + fullMonth;
          format = {
            type: "expDate",
            separator: "",
            isFullYear: false,
            isMonthFirst: false,
          };
        } else if (
          this.fieldAttrsContain(
            fillFields.exp,
            CreditCardAutoFillConstants.MonthAbbr[i] + CreditCardAutoFillConstants.YearAbbrLong[i]
          )
        ) {
          exp = fullMonth + fullYear;
          format = {
            type: "expDate",
            separator: "",
            isFullYear: true,
            isMonthFirst: true,
          };
        } else if (
          this.fieldAttrsContain(
            fillFields.exp,
            CreditCardAutoFillConstants.MonthAbbr[i] + CreditCardAutoFillConstants.YearAbbrShort[i]
          ) &&
          partYear != null
        ) {
          exp = fullMonth + partYear;
          format = {
            type: "expDate",
            separator: "",
            isFullYear: false,
            isMonthFirst: true,
          };
        }
        /* END Cozy testing version */

        if (exp != null) {
          break;
        }
      }

      if (exp == null) {
        exp = fullYear + "-" + fullMonth;
        format = { type: "expDate", separator: "/", isFullYear: true, isMonthFirst: true };
      }

      this.makeScriptActionWithValue(fillScript, exp, fillFields.exp, filledFields, {
        type: "card",
        fieldType: "expiration",
        fieldFormat: format,
      });
    }

    fillScript.type = "autofillScript";
    return fillScript;
  }

  /**
   * Determines whether to warn the user about filling an iframe
   * @param pageUrl The url of the page/iframe, usually from AutofillPageDetails
   * @param tabUrl The url of the tab, usually from the message sender (should not come from a content script because
   *  that is likely to be incorrect in the case of iframes)
   * @param loginItem The cipher to be filled
   * @returns `true` if the iframe is untrusted and the warning should be shown, `false` otherwise
   */
  iframeUrlMatches(pageUrl: string, loginItem: CipherView, defaultUriMatch: UriMatchType): boolean {
    // Check the pageUrl against cipher URIs using the configured match detection.
    // If we are in this function at all, it is assumed that the tabUrl already matches a URL for `loginItem`,
    // need to verify the pageUrl also matches one of the saved URIs using the match detection selected.
    const uriMatched = loginItem.login.uris?.some((uri) =>
      this.uriMatches(uri, pageUrl, defaultUriMatch)
    );

    return uriMatched;
  }

  // TODO should this be put in a common place (Utils maybe?) to be used both here and by CipherService?
  private uriMatches(uri: LoginUriView, url: string, defaultUriMatch: UriMatchType): boolean {
    const matchType = uri.match ?? defaultUriMatch;

    const matchDomains = [Utils.getDomain(url)];
    const equivalentDomains = this.settingsService.getEquivalentDomains(url);
    if (equivalentDomains != null) {
      matchDomains.push(...equivalentDomains);
    }

    switch (matchType) {
      case UriMatchType.Domain:
        if (url != null && uri.domain != null && matchDomains.includes(uri.domain)) {
          if (Utils.DomainMatchBlacklist.has(uri.domain)) {
            const domainUrlHost = Utils.getHost(url);
            if (!Utils.DomainMatchBlacklist.get(uri.domain).has(domainUrlHost)) {
              return true;
            }
          } else {
            return true;
          }
        }
        break;
      case UriMatchType.Host: {
        const urlHost = Utils.getHost(url);
        if (urlHost != null && urlHost === Utils.getHost(uri.uri)) {
          return true;
        }
        break;
      }
      case UriMatchType.Exact:
        if (url === uri.uri) {
          return true;
        }
        break;
      case UriMatchType.StartsWith:
        if (url.startsWith(uri.uri)) {
          return true;
        }
        break;
      case UriMatchType.RegularExpression:
        try {
          const regex = new RegExp(uri.uri, "i");
          if (regex.test(url)) {
            return true;
          }
        } catch (e) {
          this.logService.error(e);
          return false;
        }
        break;
      case UriMatchType.Never:
      default:
        break;
    }

    return false;
  }

  private fieldAttrsContain(field: AutofillField, containsVal: string) {
    if (!field) {
      return false;
    }

    let doesContain = false;
    CreditCardAutoFillConstants.CardAttributesExtended.forEach((attr) => {
      // eslint-disable-next-line
      if (doesContain || !field.hasOwnProperty(attr) || !field[attr]) {
        return;
      }

      let val = field[attr];
      val = val.replace(/ /g, "").toLowerCase();
      doesContain = val.indexOf(containsVal) > -1;
    });

    return doesContain;
  }

  private generateIdentityFillScript(
    fillScript: AutofillScript,
    pageDetails: AutofillPageDetails,
    filledFields: { [id: string]: AutofillField },
    options: GenerateFillScriptOptions,
    // Cozy customization, allow to call `generateIdentityFillScript` for contacts
    //*
    cipherType: "identity" | "contact" = "identity"
    //*/
  ): AutofillScript {
    if (!options.cipher.identity) {
      return null;
    }

    const fillFields: { [id: string]: AutofillField } = {};

    pageDetails.fields.forEach((f) => {
      if (AutofillService.forCustomFieldsOnly(f)) {
        return;
      }

      if (this.isExcludedType(f.type, AutoFillConstants.ExcludedAutofillTypes)) {
        return;
      }

      // if viewableOri is undefined, means we are building a script for an autofil (and not a menu)
      // in this case, only viewable fields will be taken into account, so we force all of them.
      if (f.viewableOri === undefined) {
        f.viewableOri = true;
      }

      for (let i = 0; i < IdentityAutoFillConstants.IdentityAttributes.length; i++) {
        const attr = IdentityAutoFillConstants.IdentityAttributes[i];
        // eslint-disable-next-line
        if (!f.hasOwnProperty(attr) || !f[attr] || !f.viewable) {
          continue;
        }

        // ref https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill
        // ref https://developers.google.com/web/fundamentals/design-and-ux/input/forms/

        /* ---------------------------------------------------------------
        Scheme of the selection of the mapping between page fields
        and cipher attributes

        A field for :

          1- autofill                  2- menu
              │                         │
              │                   force viewable=1
              │                         │
              ▼                         ▼
            viewable                  viewable
              │ │                       │ │
              │ └──0───►  out           │ └──0───►  out
              │                         │           (never happens)
              ▼                         ▼
            match                     match
              │ │                       │ │
              │ └──0───► out            │ └──0───► out
              │                         │
              ▼                         ▼
            already_one_field         already_one_field
            for this property         for this property
              │ │                       │ │
              │ └──0───►  select        │ └──0───►  Select the field
              │           the field     │
              ▼                         ▼
            viewableOri               viewableOri
              │ │                      │ │
              │ └──0───►  out          │ └──0───►  out
              |          (never        │
              ▼           happen)      ▼
            select the field          select the field
        ------------------------------------------------------------------*/
        /* BW testing logic is modified, do not try to merge upstream
        // Just observe their evolutions to check if some are relevant
        if (
          !fillFields.name &&
          AutofillService.isFieldMatch(
            f[attr],
            IdentityAutoFillConstants.FullNameFieldNames,
            IdentityAutoFillConstants.FullNameFieldNameValues
          )
        ) {
          fillFields.name = f;
          break;
        } else if (
          !fillFields.firstName &&
          AutofillService.isFieldMatch(f[attr], IdentityAutoFillConstants.FirstnameFieldNames)
        ) {
          fillFields.firstName = f;
          break;
        } else if (
          !fillFields.middleName &&
          AutofillService.isFieldMatch(f[attr], IdentityAutoFillConstants.MiddlenameFieldNames)
        ) {
          fillFields.middleName = f;
          break;
        } else if (
          !fillFields.lastName &&
          AutofillService.isFieldMatch(f[attr], IdentityAutoFillConstants.LastnameFieldNames)
        ) {
          fillFields.lastName = f;
          break;
        } else if (
          !fillFields.title &&
          AutofillService.isFieldMatch(f[attr], IdentityAutoFillConstants.TitleFieldNames)
        ) {
          fillFields.title = f;
          break;
        } else if (
          !fillFields.email &&
          AutofillService.isFieldMatch(f[attr], IdentityAutoFillConstants.EmailFieldNames)
        ) {
          fillFields.email = f;
          break;
        } else if (
          !fillFields.address &&
          AutofillService.isFieldMatch(
            f[attr],
            IdentityAutoFillConstants.AddressFieldNames,
            IdentityAutoFillConstants.AddressFieldNameValues
          )
        ) {
          fillFields.address = f;
          break;
        } else if (
          !fillFields.address1 &&
          AutofillService.isFieldMatch(f[attr], IdentityAutoFillConstants.Address1FieldNames)
        ) {
          fillFields.address1 = f;
          break;
        } else if (
          !fillFields.address2 &&
          AutofillService.isFieldMatch(f[attr], IdentityAutoFillConstants.Address2FieldNames)
        ) {
          fillFields.address2 = f;
          break;
        } else if (
          !fillFields.address3 &&
          AutofillService.isFieldMatch(f[attr], IdentityAutoFillConstants.Address3FieldNames)
        ) {
          fillFields.address3 = f;
          break;
        } else if (
          !fillFields.postalCode &&
          AutofillService.isFieldMatch(f[attr], IdentityAutoFillConstants.PostalCodeFieldNames)
        ) {
          fillFields.postalCode = f;
          break;
        } else if (
          !fillFields.city &&
          AutofillService.isFieldMatch(f[attr], IdentityAutoFillConstants.CityFieldNames)
        ) {
          fillFields.city = f;
          break;
        } else if (
          !fillFields.state &&
          AutofillService.isFieldMatch(f[attr], IdentityAutoFillConstants.StateFieldNames)
        ) {
          fillFields.state = f;
          break;
        } else if (
          !fillFields.country &&
          AutofillService.isFieldMatch(f[attr], IdentityAutoFillConstants.CountryFieldNames)
        ) {
          fillFields.country = f;
          break;
        } else if (
          !fillFields.phone &&
          AutofillService.isFieldMatch(f[attr], IdentityAutoFillConstants.PhoneFieldNames)
        ) {
          fillFields.phone = f;
          break;
        } else if (
          !fillFields.username &&
          AutofillService.isFieldMatch(f[attr], IdentityAutoFillConstants.UserNameFieldNames)
        ) {
          fillFields.username = f;
          break;
        } else if (
          !fillFields.company &&
          AutofillService.isFieldMatch(f[attr], IdentityAutoFillConstants.CompanyFieldNames)
        ) {
          fillFields.company = f;
          break;
        }
        END BW testings */

        /* Cozy specific testings   */
        if (
          AutofillService.isFieldMatch(
            f[attr],
            IdentityAutoFillConstants.FullNameFieldNames,
            IdentityAutoFillConstants.FullNameFieldNameValues
          ) &&
          (!fillFields.name || f.viewableOri)
        ) {
          fillFields.name = f;
          break;
        } else if (
          AutofillService.isFieldMatch(f[attr], IdentityAutoFillConstants.FirstnameFieldNames) &&
          (!fillFields.firstName || f.viewableOri)
        ) {
          switch (this.isFirstNameFirst(f[attr])) {
            case true:
              fillFields.firstNameLastName = f;
              break;
            case false:
              fillFields.lastNameFirstName = f;
              break;
            default:
              fillFields.firstName = f;
              break;
          }
          break;
        } else if (
          AutofillService.isFieldMatch(f[attr], IdentityAutoFillConstants.MiddlenameFieldNames) &&
          (!fillFields.middleName || f.viewableOri)
        ) {
          fillFields.middleName = f;
          break;
        } else if (
          AutofillService.isFieldMatch(f[attr], IdentityAutoFillConstants.LastnameFieldNames) &&
          (!fillFields.lastName || f.viewableOri)
        ) {
          fillFields.lastName = f;
          break;
        } else if (
          AutofillService.isFieldMatch(f[attr], IdentityAutoFillConstants.TitleFieldNames) &&
          (!fillFields.title || f.viewableOri)
        ) {
          fillFields.title = f;
          break;
        } else if (
          AutofillService.isFieldMatch(f[attr], IdentityAutoFillConstants.EmailFieldNames) &&
          (!fillFields.email || f.viewableOri)
        ) {
          fillFields.email = f;
          break;
        } else if (
          AutofillService.isFieldMatch(
            f[attr],
            IdentityAutoFillConstants.AddressFieldNames,
            IdentityAutoFillConstants.AddressFieldNameValues
          ) &&
          (!fillFields.address || f.viewableOri)
        ) {
          fillFields.address = f;
          break;
        } else if (
          AutofillService.isFieldMatch(f[attr], IdentityAutoFillConstants.Address1FieldNames) &&
          (!fillFields.address1 || f.viewableOri)
        ) {
          fillFields.address1 = f;
          break;
        } else if (
          AutofillService.isFieldMatch(f[attr], IdentityAutoFillConstants.Address2FieldNames) &&
          (!fillFields.address2 || f.viewableOri)
        ) {
          fillFields.address2 = f;
          break;
        } else if (
          AutofillService.isFieldMatch(f[attr], IdentityAutoFillConstants.Address3FieldNames) &&
          (!fillFields.address3 || f.viewableOri)
        ) {
          fillFields.address3 = f;
          break;
        } else if (
          AutofillService.isFieldMatch(f[attr], IdentityAutoFillConstants.PostalCodeFieldNames) &&
          (!fillFields.postalCode || f.viewableOri)
        ) {
          fillFields.postalCode = f;
          break;
        } else if (
          AutofillService.isFieldMatch(f[attr], IdentityAutoFillConstants.CityFieldNames) &&
          (!fillFields.city || f.viewableOri)
        ) {
          fillFields.city = f;
          break;
        } else if (
          AutofillService.isFieldMatch(f[attr], IdentityAutoFillConstants.StateFieldNames) &&
          (!fillFields.state || f.viewableOri)
        ) {
          fillFields.state = f;
          break;
        } else if (
          AutofillService.isFieldMatch(f[attr], IdentityAutoFillConstants.CountryFieldNames) &&
          (!fillFields.country || f.viewableOri)
        ) {
          fillFields.country = f;
          break;
        } else if (
          AutofillService.isFieldMatch(f[attr], IdentityAutoFillConstants.PhoneFieldNames) &&
          (!fillFields.phone || f.viewableOri)
        ) {
          fillFields.phone = f;
          break;
        } else if (
          AutofillService.isFieldMatch(f[attr], IdentityAutoFillConstants.UserNameFieldNames) &&
          (!fillFields.username || f.viewableOri)
        ) {
          fillFields.username = f;
          break;
        } else if (
          AutofillService.isFieldMatch(f[attr], IdentityAutoFillConstants.CompanyFieldNames) &&
          (!fillFields.company || f.viewableOri)
        ) {
          fillFields.company = f;
          break;
        }
        /* END Cozy testings */
      }
    });

    const identity = options.cipher.identity;
    this.makeScriptAction(fillScript, identity, fillFields, filledFields, "title", cipherType); // Cozy customization: `"identity"` replaced by `cipherType`
    this.makeScriptAction(fillScript, identity, fillFields, filledFields, "firstName", cipherType); // Cozy customization: `"identity"` replaced by `cipherType`
    this.makeScriptAction(fillScript, identity, fillFields, filledFields, "middleName", cipherType); // Cozy customization: `"identity"` replaced by `cipherType`
    this.makeScriptAction(fillScript, identity, fillFields, filledFields, "lastName", cipherType); // Cozy customization: `"identity"` replaced by `cipherType`
    this.makeScriptAction(fillScript, identity, fillFields, filledFields, "address1", cipherType); // Cozy customization: `"identity"` replaced by `cipherType`
    this.makeScriptAction(fillScript, identity, fillFields, filledFields, "address2", cipherType); // Cozy customization: `"identity"` replaced by `cipherType`
    this.makeScriptAction(fillScript, identity, fillFields, filledFields, "address3", cipherType); // Cozy customization: `"identity"` replaced by `cipherType`
    this.makeScriptAction(fillScript, identity, fillFields, filledFields, "city", cipherType); // Cozy customization: `"identity"` replaced by `cipherType`
    this.makeScriptAction(fillScript, identity, fillFields, filledFields, "postalCode", cipherType); // Cozy customization: `"identity"` replaced by `cipherType`
    this.makeScriptAction(fillScript, identity, fillFields, filledFields, "company", cipherType); // Cozy customization: `"identity"` replaced by `cipherType`
    this.makeScriptAction(fillScript, identity, fillFields, filledFields, "email", cipherType); // Cozy customization: `"identity"` replaced by `cipherType`
    this.makeScriptAction(fillScript, identity, fillFields, filledFields, "phone", cipherType); // Cozy customization: `"identity"` replaced by `cipherType`
    this.makeScriptAction(fillScript, identity, fillFields, filledFields, "username", cipherType); // Cozy customization: `"identity"` replaced by `cipherType`

    let filledState = false;
    if (fillFields.state && identity.state && identity.state.length > 2) {
      const stateLower = identity.state.toLowerCase();
      const isoState =
        IdentityAutoFillConstants.IsoStates[stateLower] ||
        IdentityAutoFillConstants.IsoProvinces[stateLower];
      if (isoState) {
        filledState = true;
        const cipher = { type: cipherType, fieldType: "state" }; // Cozy customization: `"identity"` replaced by `cipherType`
        this.makeScriptActionWithValue(
          fillScript,
          isoState,
          fillFields.state,
          filledFields,
          cipher
        );
      }
    }

    if (!filledState) {
      this.makeScriptAction(fillScript, identity, fillFields, filledFields, "state", cipherType); // Cozy customization: `"identity"` replaced by `cipherType`
    }

    let filledCountry = false;
    if (fillFields.country && identity.country && identity.country.length > 2) {
      const countryLower = identity.country.toLowerCase();
      const isoCountry = IdentityAutoFillConstants.IsoCountries[countryLower];
      const cipher = { type: cipherType, fieldType: "country" }; // Cozy customization: `"identity"` replaced by `cipherType`
      if (isoCountry) {
        filledCountry = true;
        this.makeScriptActionWithValue(
          fillScript,
          isoCountry,
          fillFields.country,
          filledFields,
          cipher
        );
      }
    }

    if (!filledCountry) {
      this.makeScriptAction(fillScript, identity, fillFields, filledFields, "country", cipherType); // Cozy customization: `"identity"` replaced by `cipherType`
    }

    if (fillFields.name && (identity.firstName || identity.lastName)) {
      let fullName = "";
      if (AutofillService.hasValue(identity.firstName)) {
        fullName = identity.firstName;
      }
      if (AutofillService.hasValue(identity.middleName)) {
        if (fullName !== "") {
          fullName += " ";
        }
        fullName += identity.middleName;
      }
      if (AutofillService.hasValue(identity.lastName)) {
        if (fullName !== "") {
          fullName += " ";
        }
        fullName += identity.lastName;
      }

      const cipher = { type: cipherType, fieldType: "fullName" }; // Cozy customization: `"identity"` replaced by `cipherType`
      this.makeScriptActionWithValue(fillScript, fullName, fillFields.name, filledFields, cipher);
    }

    if (fillFields.lastNameFirstName) {
      const cipher = { type: cipherType, fieldType: "lastNameFirstName" }; // Cozy customization: `"identity"` replaced by `cipherType`
      const nameToDisplay = identity.lastName + " " + identity.firstName;
      this.makeScriptActionWithValue(
        fillScript,
        nameToDisplay,
        fillFields.lastNameFirstName,
        filledFields,
        cipher
      );
    } else if (fillFields.firstNameLastName) {
      const cipher = { type: cipherType, fieldType: "firstNameLastName" }; // Cozy customization: `"identity"` replaced by `cipherType`
      const nameToDisplay = identity.firstName + " " + identity.lastName;
      this.makeScriptActionWithValue(
        fillScript,
        nameToDisplay,
        fillFields.firstNameLastName,
        filledFields,
        cipher
      );
    }

    if (fillFields.address && AutofillService.hasValue(identity.address1)) {
      let address = "";
      if (AutofillService.hasValue(identity.address1)) {
        address = identity.address1;
      }
      if (AutofillService.hasValue(identity.address2)) {
        if (address !== "") {
          address += ", ";
        }
        address += identity.address2;
      }
      if (AutofillService.hasValue(identity.address3)) {
        if (address !== "") {
          address += ", ";
        }
        address += identity.address3;
      }

      const cipher = { type: cipherType, fieldType: "fullAddress" }; // Cozy customization: `"identity"` replaced by `cipherType`
      this.makeScriptActionWithValue(fillScript, address, fillFields.address, filledFields, cipher);
    }

    fillScript.type = "autofillScript";
    return fillScript;
  }

  private isExcludedType(type: string, excludedTypes: string[]) {
    return excludedTypes.indexOf(type) > -1;
  }

  /*  isFieldMatch(value, options, containsOptions)
      Test if a value matches some criteria
        * value : String : the value to test
        * options : [String] : array of strings to compare with the value.
        * containsOptions : [String] : subset of options strings : those repeated strings
          will be searched into the value
        * notes :
          * containsOptions is a subset of options ... not intuitive nor classic...
          * in the value string, all non letter and non digits caracters are removed
          * in the strings (both options & containsOptions), you should use a `-` for spaces
            and all non [a-zA-Z0-9] caracters.
  */
  private static isFieldMatch(
    value: string,
    options: string[],
    containsOptions?: string[]
  ): boolean {
    value = value
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "");
    /*  @override by Cozy : don't take into account too long values :
        A long string is not coherent with the description of a form to fill. It is likely a search form where
        the element before the input ("label-left") is a select for the user to choose the category where to run
        the search. */
    if (value.length > 100) {
      return false;
    }
    /* end override by Cozy */

    for (let i = 0; i < options.length; i++) {
      let option = options[i];
      const checkValueContains = containsOptions == null || containsOptions.indexOf(option) > -1;
      option = option.toLowerCase().replace(/-/g, "");
      if (value === option || (checkValueContains && value.indexOf(option) > -1)) {
        return true;
      }
    }

    return false;
  }

  /*  Added by Cozy
      value :
        * a string where firstname is mentionned
        * and where to search if lastname appears and if it is after Firstname
      returns :
        * true : Lastname appears and is after Firstname
        * false : Lastname appears and is before Firstname
        * null : Lastname doesn't appear
   */
  private isFirstNameFirst(value: string) {
    value = value
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    value = value.replace(/[^a-zA-Z0-9]+/g, "");
    let firstNameStart: number;
    let firstNameEnd: number;
    // search for the occurence of the firstname
    for (let firstNameStr of IdentityAutoFillConstants.FirstnameFieldNames) {
      firstNameStr = firstNameStr.replace(/-/g, "");
      firstNameStart = value.indexOf(firstNameStr);
      if (firstNameStart > -1) {
        firstNameEnd = firstNameStart + firstNameStr.length;
        break;
      }
    }
    // search for the lastName occurrence after firstName
    const valueAfterFirstName: string = value.slice(firstNameEnd);
    for (let lastNameStr of IdentityAutoFillConstants.LastnameFieldNames) {
      lastNameStr = lastNameStr.replace(/-/g, "");
      if (valueAfterFirstName.indexOf(lastNameStr) > -1) {
        return true;
      }
    }
    // search for the lastName occurrence before firstName
    const valueBeforeFirstName: string = value.slice(0, firstNameStart);
    for (let lastNameStr of IdentityAutoFillConstants.LastnameFieldNames) {
      lastNameStr = lastNameStr.replace(/-/g, "");
      if (valueBeforeFirstName.indexOf(lastNameStr) > -1) {
        return false;
      }
    }
    // lastName has not been found, neither before nor after firstName
    return null;
  }

  private makeScriptAction(
    fillScript: AutofillScript,
    cipherData: any,
    fillFields: { [id: string]: AutofillField },
    filledFields: { [id: string]: AutofillField },
    dataProp: string,
    cipherType: string,
    fieldProp?: string
  ) {
    fieldProp = fieldProp || dataProp;
    const cipher = { type: cipherType, fieldType: dataProp };
    this.makeScriptActionWithValue(
      fillScript,
      cipherData[dataProp],
      fillFields[fieldProp],
      filledFields,
      cipher
    );
  }

  private makeScriptActionWithValue(
    fillScript: AutofillScript,
    dataValue: any,
    field: AutofillField,
    filledFields: { [id: string]: AutofillField },
    cipher: any
  ) {
    let doFill = false;
    if (AutofillService.hasValue(dataValue) && field) {
      if (field.type === "select-one" && field.selectInfo && field.selectInfo.options) {
        for (let i = 0; i < field.selectInfo.options.length; i++) {
          const option = field.selectInfo.options[i];
          for (let j = 0; j < option.length; j++) {
            if (
              AutofillService.hasValue(option[j]) &&
              option[j].toLowerCase() === dataValue.toLowerCase()
            ) {
              doFill = true;
              if (option.length > 1) {
                dataValue = option[1];
              }
              break;
            }
          }

          if (doFill) {
            break;
          }
        }
      } else {
        doFill = true;
      }
    }

    if (doFill) {
      filledFields[field.opid] = field;
      AutofillService.fillByOpid(fillScript, field, dataValue, cipher);
    }
  }

  static loadPasswordFields(
    pageDetails: AutofillPageDetails,
    canBeHidden: boolean,
    canBeReadOnly: boolean,
    mustBeEmpty: boolean,
    fillNewPassword: boolean
  ) {
    const arr: AutofillField[] = [];
    pageDetails.fields.forEach((f) => {
      if (AutofillService.forCustomFieldsOnly(f)) {
        return;
      }

      const isPassword = f.type === "password";
      const valueIsLikePassword = (value: string) => {
        if (value == null) {
          return false;
        }
        // Removes all whitespace, _ and - characters
        // eslint-disable-next-line
        const cleanedValue = value.toLowerCase().replace(/[\s_\-]/g, "");

        if (cleanedValue.indexOf("password") < 0) {
          return false;
        }

        if (AutoFillConstants.PasswordFieldIgnoreList.some((i) => cleanedValue.indexOf(i) > -1)) {
          return false;
        }

        return true;
      };
      const isLikePassword = () => {
        if (f.type !== "text") {
          return false;
        }
        if (valueIsLikePassword(f.htmlID)) {
          return true;
        }
        if (valueIsLikePassword(f.htmlName)) {
          return true;
        }
        if (valueIsLikePassword(f.placeholder)) {
          return true;
        }
        return false;
      };
      if (
        !f.disabled &&
        (canBeReadOnly || !f.readonly) &&
        (isPassword || isLikePassword()) &&
        (canBeHidden || f.viewable) &&
        (!mustBeEmpty || f.value == null || f.value.trim() === "") &&
        (fillNewPassword || f.autoCompleteType !== "new-password")
      ) {
        arr.push(f);
      }
    });
    return arr;
  }

  private findUsernameField(
    pageDetails: AutofillPageDetails,
    passwordField: AutofillField,
    canBeHidden: boolean,
    canBeReadOnly: boolean,
    withoutForm: boolean
  ) {
    let usernameField: AutofillField = null;
    for (let i = 0; i < pageDetails.fields.length; i++) {
      const f = pageDetails.fields[i];
      if (AutofillService.forCustomFieldsOnly(f)) {
        continue;
      }

      if (f.elementNumber >= passwordField.elementNumber) {
        break;
      }

      if (
        !f.disabled &&
        (canBeReadOnly || !f.readonly) &&
        (withoutForm || f.form === passwordField.form) &&
        (canBeHidden || f.viewable) &&
        (f.type === "text" || f.type === "email" || f.type === "tel")
      ) {
        usernameField = f;

        if (this.findMatchingFieldIndex(f, AutoFillConstants.UsernameFieldNames) > -1) {
          // We found an exact match. No need to keep looking.
          break;
        }
      }
    }

    return usernameField;
  }

  private findMatchingFieldIndex(field: AutofillField, names: string[]): number {
    for (let i = 0; i < names.length; i++) {
      if (names[i].indexOf("=") > -1) {
        if (this.fieldPropertyIsPrefixMatch(field, "htmlID", names[i], "id")) {
          return i;
        }
        if (this.fieldPropertyIsPrefixMatch(field, "htmlName", names[i], "name")) {
          return i;
        }
        if (this.fieldPropertyIsPrefixMatch(field, "label-tag", names[i], "label")) {
          return i;
        }
        if (this.fieldPropertyIsPrefixMatch(field, "label-aria", names[i], "label")) {
          return i;
        }
        if (this.fieldPropertyIsPrefixMatch(field, "placeholder", names[i], "placeholder")) {
          return i;
        }
      }

      if (this.fieldPropertyIsMatch(field, "htmlID", names[i])) {
        return i;
      }
      if (this.fieldPropertyIsMatch(field, "htmlName", names[i])) {
        return i;
      }
      if (this.fieldPropertyIsMatch(field, "label-tag", names[i])) {
        return i;
      }
      if (this.fieldPropertyIsMatch(field, "label-aria", names[i])) {
        return i;
      }
      if (this.fieldPropertyIsMatch(field, "placeholder", names[i])) {
        return i;
      }
      if (this.fieldPropertyIsMatch(field, "label-left", names[i])) {
        return i;
      }
    }

    return -1;
  }

  private fieldPropertyIsPrefixMatch(
    field: any,
    property: string,
    name: string,
    prefix: string,
    separator = "="
  ): boolean {
    if (name.indexOf(prefix + separator) === 0) {
      const sepIndex = name.indexOf(separator);
      const val = name.substring(sepIndex + 1);
      return val != null && this.fieldPropertyIsMatch(field, property, val);
    }
    return false;
  }

  private fieldPropertyIsMatch(field: any, property: string, name: string): boolean {
    let fieldVal = field[property] as string;
    if (!AutofillService.hasValue(fieldVal)) {
      return false;
    }

    fieldVal = fieldVal.trim().replace(/(?:\r\n|\r|\n)/g, "");
    if (name.startsWith("regex=")) {
      try {
        const regexParts = name.split("=", 2);
        if (regexParts.length === 2) {
          const regex = new RegExp(regexParts[1], "i");
          return regex.test(fieldVal);
        }
      } catch (e) {
        this.logService.error(e);
      }
    } else if (name.startsWith("csv=")) {
      const csvParts = name.split("=", 2);
      if (csvParts.length === 2) {
        const csvVals = csvParts[1].split(",");
        for (let i = 0; i < csvVals.length; i++) {
          const val = csvVals[i];
          if (val != null && val.trim().toLowerCase() === fieldVal.toLowerCase()) {
            return true;
          }
        }
        return false;
      }
    }

    return fieldVal.toLowerCase() === name.toLowerCase();
  }

  static fieldIsFuzzyMatch(field: AutofillField, names: string[]): boolean {
    if (AutofillService.hasValue(field.htmlID) && this.fuzzyMatch(names, field.htmlID)) {
      return true;
    }
    if (AutofillService.hasValue(field.htmlName) && this.fuzzyMatch(names, field.htmlName)) {
      return true;
    }
    if (
      AutofillService.hasValue(field["label-tag"]) &&
      this.fuzzyMatch(names, field["label-tag"])
    ) {
      return true;
    }
    if (AutofillService.hasValue(field.placeholder) && this.fuzzyMatch(names, field.placeholder)) {
      return true;
    }
    if (
      AutofillService.hasValue(field["label-left"]) &&
      this.fuzzyMatch(names, field["label-left"])
    ) {
      return true;
    }
    if (
      AutofillService.hasValue(field["label-top"]) &&
      this.fuzzyMatch(names, field["label-top"])
    ) {
      return true;
    }
    if (
      AutofillService.hasValue(field["label-aria"]) &&
      this.fuzzyMatch(names, field["label-aria"])
    ) {
      return true;
    }

    return false;
  }

  private static fuzzyMatch(options: string[], value: string): boolean {
    if (options == null || options.length === 0 || value == null || value === "") {
      return false;
    }

    value = value
      .replace(/(?:\r\n|\r|\n)/g, "")
      .trim()
      .toLowerCase();

    for (let i = 0; i < options.length; i++) {
      if (value.indexOf(options[i]) > -1) {
        return true;
      }
    }

    return false;
  }

  static hasValue(str: string): boolean {
    return str && str !== "";
  }

  static setFillScriptForFocus(
    filledFields: { [id: string]: AutofillField },
    fillScript: AutofillScript
  ): AutofillScript {
    let lastField: AutofillField = null;
    let lastPasswordField: AutofillField = null;

    for (const opid in filledFields) {
      // eslint-disable-next-line
      if (filledFields.hasOwnProperty(opid) && filledFields[opid].viewable) {
        lastField = filledFields[opid];

        if (filledFields[opid].type === "password") {
          lastPasswordField = filledFields[opid];
        }
      }
    }

    // Prioritize password field over others.
    if (lastPasswordField) {
      fillScript.script.push(["focus_by_opid", lastPasswordField.opid]);
    } else if (lastField) {
      fillScript.script.push(["focus_by_opid", lastField.opid]);
    }

    return fillScript;
  }

  static fillByOpid(
    fillScript: AutofillScript,
    field: AutofillField,
    value: string,
    cipher: any
  ): void {
    if (field.maxLength && value && value.length > field.maxLength) {
      value = value.substr(0, value.length);
    }
    if (field.tagName !== "span") {
      fillScript.script.push(["click_on_opid", field.opid]);
      fillScript.script.push(["focus_by_opid", field.opid]);
    }
    fillScript.script.push(["fill_by_opid", field.opid, value, { field: field, cipher: cipher }]);
  }

  static forCustomFieldsOnly(field: AutofillField): boolean {
    return field.tagName === "span";
  }
}
