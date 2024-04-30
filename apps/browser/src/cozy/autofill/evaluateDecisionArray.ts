  const ATTRIBUTES_AMBIGUITY: any = {
    identity: {
      title: 1,
      firstName: 1,
      middleName: 1,
      lastName: 1,
      address1: 1,
      address2: 1,
      address3: 1,
      city: 1,
      state: 1,
      postalCode: 1,
      country: 1,
      company: 1,
      email: 0,
      phone: 0,
      ssn: 0,
      username: 1,
      passportNumber: 1,
      licenseNumber: 1,
    },
    card: {
      cardholderName: 1,
      brand: 1,
      number: 1,
      expMonth: 0,
      expYear: 0,
      code: 1,
    },
    login: {
      uris: 1,
      username: 1,
      password: 1,
      passwordRevisionDate: 1,
      totp: 1,
    },
    contact: {
      title: 1,
      firstName: 1,
      middleName: 1,
      lastName: 1,
      address1: 1,
      address2: 1,
      address3: 1,
      city: 1,
      state: 1,
      postalCode: 1,
      country: 1,
      company: 1,
      email: 0,
      phone: 0,
      ssn: 0,
      username: 1,
      passportNumber: 1,
      licenseNumber: 1,
    }
  };

  export const makeDecisionArray = (scriptContext: any): DecisionArray => {
    // check if the field is associated to an ambiguous attribute of a cipher
    const ambiguity = ATTRIBUTES_AMBIGUITY[scriptContext.cipher.type][scriptContext.cipher.fieldType] ?? 0;
    // prepare decision array used to decide if the script should be run for this field
    const decisionArray: DecisionArray = {
      connected: scriptContext.connected,
      hasExistingCipher: scriptContext.hasExistingCipher,
      hasLoginCipher: scriptContext.hasLoginCipher,
      hasCardCipher: scriptContext.hasCardCipher,
      hasIdentityCipher: scriptContext.hasIdentityCipher,
      hasContactCipher: scriptContext.hasContactCipher,
      ambiguity: ambiguity,
      loginFellows: scriptContext.loginFellows,
      cardFellows: scriptContext.cardFellows,
      identityFellows: scriptContext.identityFellows,
      contactFellows: scriptContext.contactFellows,
      field_isInForm: scriptContext.field.isInForm,
      field_isInSearchForm: scriptContext.field.isInSearchForm,
      field_isInloginForm: scriptContext.field.isInloginForm,
      field_isInSignupForm: scriptContext.field.isInSignupForm,
      hasMultipleScript: scriptContext.hasMultipleScript,
      field_visible: scriptContext.field.visible,
      field_viewable: scriptContext.field.viewableOri, // use the original value
    };

    return decisionArray;
  }
  
  /* -------------------------------------------------------------------------------- */
  // Evaluate if a decision array is valid to activate a menu for the field in the page.
  export const evaluateDecisionArray = (action: any) => {
    const da = action[3].decisionArray as DecisionArray;
    // selection conditions
    if (
      da.hasExistingCipher === true &&
      da.field_isInForm === true &&
      da.field_isInSearchForm === false
    ) {
      return true;
    }
    if (da.field_isInSearchForm === true) {
      return false;
    }
    if (
      da.connected === true &&
      da.hasExistingCipher === true &&
      da.loginFellows > 1 &&
      da.field_visible === true
    ) {
      return true;
    }
    if (da.ambiguity === 1 && da.cardFellows > 1 && da.field_isInForm === true) {
      return true;
    }
    if (da.ambiguity === 0 && da.cardFellows > 3 && da.field_isInForm === true) {
      return true;
    }
    if (
      da.connected === true &&
      da.hasIdentityCipher === true &&
      da.identityFellows > 1 &&
      da.field_visible === true
    ) {
      return true;
    }
    if (
      da.connected === true &&
      da.hasContactCipher === true &&
      da.contactFellows > 1 &&
      da.field_visible === true
    ) {
      return true;
    }
    if (da.connected === false && da.loginFellows === 2) {
      return true;
    }
    if (da.connected === false && da.hasLoginCipher === true && da.field_isInloginForm === true) {
      return true;
    }
    if (da.connected === false && da.hasLoginCipher === true && da.field_isInSignupForm === true) {
      return true;
    }
    if (da.ambiguity === 0 && da.identityFellows > 0 && da.field_isInForm === true) {
      return true;
    }
    if (da.ambiguity === 1 && da.identityFellows > 1 && da.field_isInForm === true) {
      return true;
    }
    if (da.ambiguity === 0 && da.contactFellows > 0 && da.field_isInForm === true) {
      return true;
    }
    if (da.ambiguity === 1 && da.contactFellows > 1 && da.field_isInForm === true) {
      return true;
    }
    if (da.connected === true && da.hasExistingCipher === undefined && da.hasLoginCipher === true) {
      return false;
    }
    // end selection conditions
    return false;
  }

  export interface DecisionArray {
    /** If the extension is logged in */
    connected: boolean
    /** At least one field in the page corresponds to a field in an existing cipher */
    hasExistingCipher: boolean
    /** The field corresponds to at least 1 field of a generic Login cipher */
    hasLoginCipher: boolean
    /** The field corresponds to at least 1 field of a generic Card cipher */
    hasCardCipher: boolean
    /** The field corresponds to at least 1 field of a generic Identity cipher */
    hasIdentityCipher: boolean
    /** The field corresponds to at least 1 field of a generic Contact cipher */
    hasContactCipher: boolean
    /** Ambiguity level, for now we handle 0 or 1 */
    ambiguity: number
    /** Number of fields in the page corresponding to a generic Login cipher */
    loginFellows: number
    /** Number of fields in the page corresponding to a generic Card cipher */
    cardFellows: number
    /** Number of fields in the page corresponding to a generic Identity cipher */
    identityFellows: number
    /** Number of fields in the page corresponding to a generic Contact cipher */
    contactFellows: number
    /** If the field is inside a `<form>` element */
    field_isInForm: boolean
    /** If the field is inside a `<form>` element that contains search related terms (i.e. `search`, `recherche`) */
    field_isInSearchForm: boolean
    /** If the field is inside a `<form>` element that contains login related terms (i.e. `login`, `signin`) */
    field_isInloginForm: boolean
    /** If the field is inside a `<form>` element that contains signup related terms (i.e. `signup`, `register`) */
    field_isInSignupForm: boolean
    /** If the `<form>` has multiple fields with the same `fieldType` (i.e. `login_email`, `login_password`) */
    hasMultipleScript: boolean
    /** If none of the field's parents is `display=none` or `visibility=hidden` */
    field_visible: boolean
    /** If the field is visible AND the user doesn't have to scroll to have it displayed in the viewport */
    field_viewable: boolean
  }
