require("./loginMenu.scss");

import { Utils } from "../../../../libs/common/src/platform/misc/utils.ts";
import { CozySanitizeUrlService } from "../popup/services/cozySanitizeUrl.service";

/* --------------------------------------------------------------------- */
// Globals
// UI elements
var panel,
  arrow,
  title,
  closeIcon,
  visiPwdBtn,
  visi2faBtn,
  urlInput,
  pwdInput,
  twoFaInput,
  urlLabelTxt,
  pwdLabelTxt,
  twoFaLabelTxt,
  errorLabel,
  submitBtn,
  isPwdHidden = true,
  is2faHidden = true,
  isIn2FA = false,
  isLocked,
  isPinLocked,
  currentArrowD,
  lastSentHeight;

/* --------------------------------------------------------------------- */
// initialization of the login menu
document.addEventListener("DOMContentLoaded", () => {
  // 0- ask rememberedCozyUrl
  chrome.runtime.sendMessage({
    command: "bgAnswerMenuRequest",
    subcommand: "getRememberedCozyUrl",
    sender: "loginMenu.js",
  });

  // 1- get elements references
  panel = document.querySelector(".panel");
  arrow = document.getElementById("arrow");
  title = document.getElementById("title-content");
  urlInput = document.getElementById("cozy-url");
  pwdInput = document.getElementById("master-password");
  twoFaInput = document.getElementById("two-fa-input");
  visiPwdBtn = document.getElementById("visi-pwd-btn");
  visi2faBtn = document.getElementById("visi-2fa-btn");
  closeIcon = document.querySelector(".close-icon");
  submitBtn = document.querySelector("#submit-btn");
  errorLabel = document.querySelector("#error-label");

  // 2- set isLocked & isPinLocked
  isLocked = window.location.search.indexOf("isLocked=true") === -1 ? false : true;
  isPinLocked = window.location.search.indexOf("isPinLocked=true") === -1 ? false : true;

  // 3- close iframe when it looses focus
  document.addEventListener("focusout", () => {
    close(false);
  });

  // 4- detect when to apply the fadeIn effect
  window.addEventListener("hashchange", _testHash);
  _testHash();

  // 5- prepare i18n and apply
  if (typeof safari !== "undefined") {
    const responseCommand = "notificationBarFrameDataResponse"; // to be adapted to loginMenu
    // eslint-disable-next-line no-undef
    sendPlatformMessage({
      command: "bgGetDataForTab",
      responseCommand: responseCommand,
    });
    // eslint-disable-next-line no-undef
    safari.self.addEventListener(
      "message",
      (msgEvent) => {
        const msg = JSON.parse(msgEvent.message.msg);
        if (msg.command === responseCommand && msg.data) {
          // eslint-disable-next-line no-undef
          load();
        }
      },
      false,
    );
  } else {
    // retrieve i18n values and set elements textcontent
    const i18nGetMessage = chrome.i18n.getMessage;
    urlLabelTxt = i18nGetMessage("cozyUrl");
    twoFaLabelTxt = i18nGetMessage("verificationCode");
    visiPwdBtn.title = i18nGetMessage("toggleVisibility");
    visi2faBtn.title = i18nGetMessage("toggleVisibility");
    submitBtn.textContent = i18nGetMessage("login");
    if (isPinLocked) {
      title.textContent = i18nGetMessage("unlockWithPin");
      pwdLabelTxt = i18nGetMessage("pin");
      urlInput.disabled = true;
      document.getElementById("url-row").classList.add("disabled");
    } else {
      title.textContent = i18nGetMessage("loginInPageMenuTitle");
      pwdLabelTxt = i18nGetMessage("masterPass");
    }
  }

  // 5- activate material inputs
  _turnIntoMaterialInput(urlInput, urlLabelTxt);
  _turnIntoMaterialInput(pwdInput, pwdLabelTxt);
  _turnIntoMaterialInput(twoFaInput, twoFaLabelTxt);

  // 6- request to adjust the menu height
  adjustMenuHeight();

  // 7- update the height each time the iframe window is resized
  window.addEventListener("resize", () => {
    adjustMenuHeight();
  });

  // 8- listen to the commands sent by the addon
  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    /* For debug
    console.log('loginMenu heared msg', msg);
    */
    if (msg.command !== "menuAnswerRequest") {
      return;
    }
    switch (msg.subcommand) {
      case "loginNOK":
        // console.log("loginNOK heard in loginInPageMenu");
        setError(chrome.i18n.getMessage("inPageMenuLoginError"));
        break;
      case "2faCheckNOK":
        // console.log("2faCheckNOK heard in loginInPageMenu");
        setError(chrome.i18n.getMessage("inPageMenuLogin2FACheckError"));
        adjustMenuHeight();
        break;
      case "setRememberedCozyUrl":
        urlInput.value = msg.rememberedCozyUrl;
        // input event not triggered in Chrome by the previous instruction... so we triger event manually...
        urlInput.dispatchEvent(new Event("input", { bubbles: true }));
        break;
      case "menuFocus":
        setTimeout(() => {
          setFocusOnEmptyField();
        }, 50);
        break;
    }
  });

  // 9- listen to UI events (close, visibility toggle and click to submit)
  closeIcon.addEventListener("click", () => {
    close(true);
  });

  visiPwdBtn.addEventListener("click", (e) => {
    _togglePwdVisibility();
    pwdInput.focus();
  });

  visi2faBtn.addEventListener("click", (e) => {
    if (is2faHidden) {
      twoFaInput.type = "text";
      visi2faBtn.firstElementChild.classList.replace("fa-eye", "fa-eye-slash");
    } else {
      twoFaInput.type = "password";
      visi2faBtn.firstElementChild.classList.replace("fa-eye-slash", "fa-eye");
    }
    is2faHidden = !is2faHidden;
    pwdInput.focus();
  });

  submitBtn.addEventListener("click", (e) => {
    if (isIn2FA) {
      submit2fa();
    } else {
      submit();
    }
  });

  panel.addEventListener("keydown", (event) => {
    if (!event.isTrusted) {
      return;
    }
    const keyName = event.key;
    if (keyName === "Enter") {
      if (isIn2FA) {
        submit2fa();
      } else {
        submit();
      }
    } else if (keyName === "Escape") {
      close(true);
    }
  });
});

/* --------------------------------------------------------------------- */
// Ask parent page to adjuste iframe height
// Width is constraint by the parent page, but height is decided by the
// iframe content
function adjustMenuHeight() {
  if (lastSentHeight === panel.offsetHeight) {
    return;
  }
  lastSentHeight = panel.offsetHeight;
  chrome.runtime.sendMessage({
    command: "bgAnswerMenuRequest",
    subcommand: "setMenuHeight",
    height: lastSentHeight,
    sender: "loginMenu.js",
  });
}

function setError(errorMsg) {
  errorLabel.innerHTML = errorMsg;
  _setErrorMode();
}

/* --------------------------------------------------------------------- */
// Submit the credentials
async function submit() {
  try {
    // console.log('loginMenu.submit()');
    // sanitize url
    const loginUrl = sanitizeUrlInput(urlInput.value);
    urlInput.value = loginUrl;
    if (pwdInput.value == null || pwdInput.value === "") {
      pwdInput.focus();
      return; // empty password, nothing to do
    }
    // remove possible lognin error message
    _setWaitingMode();
    // The email is based on the URL and necessary for login
    const hostname = Utils.getHostname(loginUrl);
    const email = "me@" + hostname;
    // decide if it's a login or pinLogin
    var subcommand = "login";
    if (isPinLocked) {
      subcommand = "unPinlock";
    } else if (isLocked) {
      subcommand = "unlock";
    }

    chrome.runtime.sendMessage({
      command: "bgAnswerMenuRequest",
      subcommand: subcommand,
      sender: "loginMenu.js",
      email: email,
      pwd: pwdInput.value,
      loginUrl: loginUrl,
    });
  } catch (e) {
    const translatableMessages = ["cozyUrlRequired", "noEmailAsCozyUrl", "hasMispelledCozy"];

    if (translatableMessages.includes(e.message)) {
      setError(chrome.i18n.getMessage(e.message));
    } else {
      setError(chrome.i18n.getMessage("errorOccurred"));
    }
  }
}

/* --------------------------------------------------------------------- */
// Submit 2FA code
async function submit2fa() {
  _setWaitingMode();

  if (twoFaInput.value == null || twoFaInput.value === "") {
    // console.log('Code 2FA vide');
    return;
  }

  chrome.runtime.sendMessage({
    command: "bgAnswerMenuRequest",
    subcommand: "2faCheck",
    sender: "loginMenu.js",
    token: twoFaInput.value,
  });
}

/* --------------------------------------------------------------------- */
// try to find a valid Cozy URL
// this function is copied from Security src/popup/accounts/login.component.ts
//
function sanitizeUrlInput(inputUrl) {
  // Prevent empty url
  if (!inputUrl) {
    throw new Error("cozyUrlRequired");
  }
  // Prevent email input
  if (inputUrl.includes("@")) {
    throw new Error("noEmailAsCozyUrl");
  }

  const cozySanitizeUrlService = new CozySanitizeUrlService();

  // Prevent mycosy instead of mycozy
  if (cozySanitizeUrlService.hasMispelledCozy(inputUrl)) {
    throw new Error("hasMispelledCozy");
  }

  return cozySanitizeUrlService.normalizeURL(inputUrl, cozySanitizeUrlService.cozyDomain);
}

/* --------------------------------------------------------------------- */
// set the menu content in error mode
function _setErrorMode() {
  panel.classList.remove("waiting");
  panel.classList.add("error");
  urlInput.disabled = false;
  pwdInput.disabled = false;
  twoFaInput.disabled = false;
  submitBtn.disabled = false;
  pwdInput.focus();
  adjustMenuHeight();
}

/* --------------------------------------------------------------------- */
// rmeove the menu content from waiting mode
function _removeWaitingMode() {
  panel.classList.remove("waiting");
  urlInput.disabled = false;
  pwdInput.disabled = false;
  twoFaInput.disabled = false;
  submitBtn.disabled = false;
  errorLabel.innerHTML = "";
  adjustMenuHeight();
}

/* --------------------------------------------------------------------- */
// set the menu content in waiting mode
function _setWaitingMode() {
  panel.classList.add("waiting");
  panel.classList.remove("error");
  _hidePwdVisibility();
  urlInput.disabled = true;
  pwdInput.disabled = true;
  twoFaInput.disabled = true;
  submitBtn.disabled = true;
  errorLabel.innerHTML = "";
  adjustMenuHeight();
}

/* --------------------------------------------------------------------- */
// Test if iframe content should fadeIn or not
// and display rows corresponding to the fieldtypes of the focused field
// content of the hash = {
//    login:"username",
//    identity:"email",
//    card: "",
//    applyFadeIn:[boolean],
//    arrowD:[Float],
// }
function _testHash() {
  // console.log('loginMenu._testHash()');
  let hash = window.location.hash;
  if (hash) {
    hash = JSON.parse(decodeURIComponent(hash).slice(1));
  }
  if (hash.applyFadeIn) {
    adjustMenuHeight();
    panel.classList.add("fade-in");
  } else {
    panel.className = "panel";
  }
  if (hash.isIn2FA) {
    isIn2FA = true;
    panel.classList.add("twoFa-mode");
    panel.classList.remove("error");
    _removeWaitingMode();
  } else {
    panel.classList.remove("twoFa-mode");
    isIn2FA = false;
  }

  if (hash.arrowD !== undefined && hash.arrowD !== currentArrowD) {
    currentArrowD = hash.arrowD;
    arrow.style.right = 10 - hash.arrowD + "px";
  }
}

/* --------------------------------------------------------------------- */
//
function setFocusOnEmptyField() {
  if (urlInput.value) {
    pwdInput.focus();
  } else {
    urlInput.focus();
  }
}

/* --------------------------------------------------------------------- */
// Request the menu controler to close the iframe of the menu
function close(force) {
  chrome.runtime.sendMessage({
    command: "bgAnswerMenuRequest",
    force: force,
    subcommand: "closeMenu",
    sender: "loginMenu.js",
  });
}

/* --------------------------------------------------------------------- */
// Prepare an input element to have a material UX
function _turnIntoMaterialInput(inputEl, labelText) {
  // BJA : labelEL to be removed
  const container = inputEl.closest(".material-input");
  container.querySelectorAll("label").forEach((label) => (label.textContent = labelText));
  container.addEventListener("click", () => {
    inputEl.focus();
  });
  let isFocusedOrFilled = false;
  const initialPlaceholder = inputEl.placeholder;
  // init input state
  if (document.activeElement !== inputEl) {
    inputEl.placeholder = "";
  }
  if (inputEl.value) {
    container.classList.add("focused-or-filled");
    inputEl.placeholder = initialPlaceholder;
    isFocusedOrFilled = true;
  }
  inputEl.addEventListener("focus", (e) => {
    container.classList.add("focused-or-filled");
    setTimeout(() => {
      inputEl.placeholder = initialPlaceholder;
    }, 100);
    isFocusedOrFilled = true;
  });
  inputEl.addEventListener("blur", (e) => {
    // console.log('blur to transition a meterial UI Input');
    if (!inputEl.value) {
      container.classList.remove("focused-or-filled");
      inputEl.placeholder = "";
      isFocusedOrFilled = false;
    }
  });
  inputEl.addEventListener("input", (e) => {
    // console.log('input HEARD !!!');
    if (!isFocusedOrFilled && inputEl.value) {
      container.classList.add("focused-or-filled");
      inputEl.placeholder = initialPlaceholder;
      isFocusedOrFilled = true;
    }
  });
}

/* --------------------------------------------------------------------- */
// Toggle the visibility of the password
function _togglePwdVisibility() {
  if (isPwdHidden) {
    pwdInput.type = "text";
    visiPwdBtn.firstElementChild.classList.replace("icon-eye", "icon-hide");
  } else {
    pwdInput.type = "password";
    visiPwdBtn.firstElementChild.classList.replace("icon-hide", "icon-eye");
  }
  isPwdHidden = !isPwdHidden;
}

/* --------------------------------------------------------------------- */
// Hide the visibility of the password
function _hidePwdVisibility() {
  pwdInput.type = "password";
  visiPwdBtn.firstElementChild.classList.replace("icon-hide", "icon-eye");
  isPwdHidden = true;
}
