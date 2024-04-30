import { DecisionArray, evaluateDecisionArray } from "./evaluateDecisionArray"

const makeAction = (decisionArray: DecisionArray) => {
  return [
    null,
    null,
    null,
    {
      decisionArray
    }
  ]
}

describe("Autofill Service", () => {
  it("Extension is logged in, has an existing cipher for website, we are in a form that's not a search => We should display the menu (e.g. assurance retraite)", () => {
    const decisionArray: DecisionArray = {
      connected: true, // SET
      hasExistingCipher: true, // SET
      hasLoginCipher: true,
      hasCardCipher: true,
      hasIdentityCipher: true,
      ambiguity: 1,
      loginFellows: 3,
      cardFellows: 3,
      identityFellows: 3,
      field_isInForm: true, // SET
      field_isInSearchForm: false, // SET
      field_isInloginForm: true,
      field_isInSignupForm: false,
      hasMultipleScript: false,
      field_visible: true,
      field_viewable: true, 
    }
    expect(evaluateDecisionArray(makeAction(decisionArray))).toBe(true)
  })

  it("We are in a search form => We should never display the menu", () => {
    const decisionArray: DecisionArray = {
      connected: true,
      hasExistingCipher: true,
      hasLoginCipher: true,
      hasCardCipher: true,
      hasIdentityCipher: true,
      ambiguity: 0,
      loginFellows: 0,
      cardFellows: 0,
      identityFellows: 0,
      field_isInForm: false,
      field_isInSearchForm: true, // SET
      field_isInloginForm: false,
      field_isInSignupForm: false,
      hasMultipleScript: true,
      field_visible: true,
      field_viewable: true, 
    }
    expect(evaluateDecisionArray(makeAction(decisionArray))).toBe(false)
  })

  it("Extension is logged in, has an existing cipher for website, we are NOT in a form but there are at least 2 Login fields => We should display menu (e.g. EDF)", () => {
    const decisionArray: DecisionArray = {
      connected: true, // SET
      hasExistingCipher: true, // SET
      hasLoginCipher: false,
      hasCardCipher: false,
      hasIdentityCipher: false,
      ambiguity: 0,
      loginFellows: 2, // SET
      cardFellows: 0,
      identityFellows: 0,
      field_isInForm: false,
      field_isInForm: false, // SET
      field_isInSearchForm: false,
      field_isInloginForm: false,
      field_isInSignupForm: false,
      hasMultipleScript: false,
      field_visible: true, // SET
      field_viewable: false,
    }
    expect(evaluateDecisionArray(makeAction(decisionArray))).toBe(true)
  })

  it("Extension is logged in (or not), no ambiguity, there are at least 2 Card fields, we are in a form => We should display menu", () => {
    const decisionArray: DecisionArray = {
      connected: true, // VARY
      hasExistingCipher: true,
      hasLoginCipher: false,
      hasCardCipher: false,
      hasIdentityCipher: false,
      ambiguity: 1, // SET
      loginFellows: 0,
      cardFellows: 2, // SET
      identityFellows: 0,
      field_isInForm: true, // SET
      field_isInSearchForm: false,
      field_isInloginForm: false,
      field_isInSignupForm: false,
      hasMultipleScript: false,
      field_visible: true,
      field_viewable: false,
    }

    decisionArray.connected = true
    expect(evaluateDecisionArray(makeAction(decisionArray))).toBe(true)
    
    decisionArray.connected = false
    expect(evaluateDecisionArray(makeAction(decisionArray))).toBe(true)
  })

  it("Extension is logged in (or not), ambiguity, but there are at least 4 Card fields, we are in a form => We should display menu", () => {
    const decisionArray: DecisionArray = {
      connected: true, // VARY
      hasExistingCipher: true,
      hasLoginCipher: false,
      hasCardCipher: false,
      hasIdentityCipher: false,
      ambiguity: 0, // SET
      loginFellows: 0,
      cardFellows: 4, // SET
      identityFellows: 0,
      field_isInForm: true, // SET
      field_isInSearchForm: false,
      field_isInloginForm: false,
      field_isInSignupForm: false,
      hasMultipleScript: false,
      field_visible: true,
      field_viewable: false,
    }

    decisionArray.connected = true
    expect(evaluateDecisionArray(makeAction(decisionArray))).toBe(true)
    
    decisionArray.connected = false
    expect(evaluateDecisionArray(makeAction(decisionArray))).toBe(true)
  })

  it("Extension is logged in, there are at least 2 Identity fields, we are in a form => We should display menu (i.e. EDF account creation)", () => {
    const decisionArray: DecisionArray = {
      connected: true, // SET
      hasExistingCipher: false,
      hasLoginCipher: false,
      hasCardCipher: false,
      hasIdentityCipher: true, // SET
      ambiguity: 0,
      loginFellows: 0,
      cardFellows: 0,
      identityFellows: 2, // SET
      field_isInForm: true, // SET
      field_isInSearchForm: false,
      field_isInloginForm: false,
      field_isInSignupForm: false,
      hasMultipleScript: false,
      field_visible: true, // SET
      field_viewable: false,
    }

    expect(evaluateDecisionArray(makeAction(decisionArray))).toBe(true)
  })

  it("Extension is logged out, enough Login fields, we are in a login form (or not) => We should display the menu (i.e. login Cozy or Fnac)", () => {
    const decisionArray: DecisionArray = {
      connected: false, // SET
      hasExistingCipher: false,
      hasLoginCipher: true, // SET
      hasCardCipher: false,
      hasIdentityCipher: false,
      ambiguity: 0,
      loginFellows: 2, // SET
      cardFellows: 0,
      identityFellows: 0,
      field_isInForm: true, // VARY
      field_isInSearchForm: false,
      field_isInloginForm: true, // SET
      field_isInSignupForm: false,
      hasMultipleScript: false,
      field_visible: true,
      field_viewable: false,
    }

    decisionArray.field_isInForm = true
    expect(evaluateDecisionArray(makeAction(decisionArray))).toBe(true)
    
    decisionArray.field_isInForm = false
    expect(evaluateDecisionArray(makeAction(decisionArray))).toBe(true)
  })

  it("Extension is logged out, there is a generic login, we are in a signup form => We should display the menu (i.e. signup form CCM)", () => {
    const decisionArray: DecisionArray = {
      connected: false, // SET
      hasExistingCipher: false,
      hasLoginCipher: true, // SET
      hasCardCipher: false,
      hasIdentityCipher: false,
      ambiguity: 0,
      loginFellows: 2, // SET
      cardFellows: 0,
      identityFellows: 0,
      field_isInForm: true,
      field_isInSearchForm: false,
      field_isInloginForm: false,
      field_isInSignupForm: true, // SET
      hasMultipleScript: false,
      field_visible: true,
      field_viewable: false,
    }

    expect(evaluateDecisionArray(makeAction(decisionArray))).toBe(true)
  })

  it("Extension is logged in (or not), no ambiguity, there are at least 2 Identiy fields => We should display menu (i.e. Netflix)", () => {
    const decisionArray: DecisionArray = {
      connected: false, // VARY
      hasExistingCipher: false,
      hasLoginCipher: false,
      hasCardCipher: false,
      hasIdentityCipher: true,
      ambiguity: 0, // SET
      loginFellows: 0,
      cardFellows: 0,
      identityFellows: 1, // SET
      field_isInForm: true, // SET
      field_isInSearchForm: false,
      field_isInloginForm: false,
      field_isInSignupForm: false,
      hasMultipleScript: false,
      field_visible: true,
      field_viewable: false,
    }

    decisionArray.connected = true
    expect(evaluateDecisionArray(makeAction(decisionArray))).toBe(true)
    
    decisionArray.connected = false
    expect(evaluateDecisionArray(makeAction(decisionArray))).toBe(true)
  })

  it("Extension is logged in (or not), with ambiguity, there are at least 3 Identiy fields => We should display menu (i.e. CCM)", () => {
    const decisionArray: DecisionArray = {
      connected: false, // VARY
      hasExistingCipher: false,
      hasLoginCipher: false,
      hasCardCipher: false,
      hasIdentityCipher: true,
      ambiguity: 1, // SET
      loginFellows: 0,
      cardFellows: 0,
      identityFellows: 2, // SET
      field_isInForm: true, // SET
      field_isInSearchForm: false,
      field_isInloginForm: false,
      field_isInSignupForm: false,
      hasMultipleScript: false,
      field_visible: true,
      field_viewable: false,
    }

    decisionArray.connected = true
    expect(evaluateDecisionArray(makeAction(decisionArray))).toBe(true)
    
    decisionArray.connected = false
    expect(evaluateDecisionArray(makeAction(decisionArray))).toBe(true)
  })

  it("Logged in, no existing cipher, a login field => We should NOT display menu (i.e. trainline)", () => {
    const decisionArray: DecisionArray = {
      connected: true, // SET
      hasExistingCipher: false, // SET
      hasLoginCipher: true, // SET
      hasCardCipher: false,
      hasIdentityCipher: true,
      ambiguity: 0,
      loginFellows: 0,
      cardFellows: 0,
      identityFellows: 0,
      field_isInForm: false,
      field_isInSearchForm: false,
      field_isInloginForm: false,
      field_isInSignupForm: false,
      hasMultipleScript: false,
      field_visible: true,
      field_viewable: false,
    }

    expect(evaluateDecisionArray(makeAction(decisionArray))).toBe(false)
  
  })
})
