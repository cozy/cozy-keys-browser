require("./bar.scss");

/** This file is haevyly personnalized by Cozy
 * do not try to merge upstream.
 * See original file:
 * https://github.com/bitwarden/browser/blob/3e1e05ab4ffabbf180972650818a3ae3468dbdfb/src/notification/bar.js
 */
document.addEventListener("DOMContentLoaded", () => {
  let i18n = {};
  let lang = window.navigator.language;

  i18n.appName = chrome.i18n.getMessage("appName");
  i18n.close = chrome.i18n.getMessage("close");
  i18n.yes = chrome.i18n.getMessage("yes");
  i18n.never = chrome.i18n.getMessage("never");
  i18n.notificationAddSave = chrome.i18n.getMessage("notificationAddSave");
  i18n.notificationDontSave = chrome.i18n.getMessage("notificationDontSave");
  i18n.notificationAddDesc = chrome.i18n.getMessage("notificationAddDesc");
  i18n.notificationChangeSave = chrome.i18n.getMessage("notificationChangeSave");
  i18n.notificationChangeDesc = chrome.i18n.getMessage("notificationChangeDesc");
  i18n.notificationTOTP = chrome.i18n.getMessage("notificationTOTP");
  lang = chrome.i18n.getUILanguage(); // eslint-disable-line

  // delay 50ms so that we get proper body dimensions
  setTimeout(load, 50);

  function load() {
    const body = document.querySelector("body");

    // i18n
    body.classList.add("lang-" + lang.slice(0, 2));

    document.getElementById("logo-link").title = i18n.appName;

    // Set text in popup
    document.querySelector("#template-notif .dont-save").textContent = i18n.notificationDontSave;

    // NOTE: the info context was removed in absence of use-case yet.
    // See original file commit at the beggining of this fine.
    const addContext = getQueryVariable("add");
    const changeContext = getQueryVariable("change");
    const totpContext = getQueryVariable("totp");

    if (addContext) {
      document.querySelector("#template-notif .add-or-change").textContent =
        i18n.notificationAddSave;
      document.querySelector("#template-notif .desc-text").textContent = i18n.notificationAddDesc;
      // Set DOM content
      setContent(document.getElementById("template-notif"));
    } else if (changeContext) {
      document.querySelector("#template-notif .add-or-change").textContent =
        i18n.notificationChangeSave;
      document.querySelector("#template-notif .desc-text").textContent =
        i18n.notificationChangeDesc;
      // Set DOM content
      setContent(document.getElementById("template-notif"));
    } else if (totpContext) {
      document.querySelector("#template-totp-copied .desc-text").textContent =
        i18n.notificationTOTP;
      // Set DOM content
      setContent(document.getElementById("template-totp-copied"));
      window.setTimeout(() => {
        sendPlatformMessage({
          command: "bgCloseNotificationBar",
        });
      }, 5000);
    } else {
      return;
    }

    // Set listeners
    // TODO: the checkboxes options are not active yet
    const addOrChangeButton = document.querySelector("#content .add-or-change");
    const dontSaveButton = document.querySelector("#content .dont-save");

    addOrChangeButton?.addEventListener("click", (e) => {
      e.preventDefault();
      const command = changeContext ? "bgChangeSave" : "bgAddSave";
      sendPlatformMessage({
        command: command,
      });
    });

    dontSaveButton?.addEventListener("click", (e) => {
      e.preventDefault();
      sendPlatformMessage({
        command: "bgCloseNotificationBar",
      });
    });

    sendAdjustBodyHeight(body);
  }

  // Adjust height dynamically
  function sendAdjustBodyHeight(body) {
    sendPlatformMessage({
      command: "bgAdjustNotificationBar",
      data: {
        height: body.scrollHeight + 15, // Add 15px for margin
      },
    });
  }

  function getQueryVariable(variable) {
    var query = window.location.search.substring(1);
    var vars = query.split("&");

    for (var i = 0; i < vars.length; i++) {
      var pair = vars[i].split("=");
      if (pair[0] === variable) {
        return pair[1];
      }
    }

    return null;
  }

  function setContent(element) {
    const content = document.getElementById("content");
    while (content.firstChild) {
      content.removeChild(content.firstChild);
    }

    var newElement = element.cloneNode(true);
    newElement.id = newElement.id + "-clone";
    content.appendChild(newElement);
  }

  function sendPlatformMessage(msg) {
    chrome.runtime.sendMessage(msg);
  }
});
