// This content script acts as a bridge between the app and the main.background
// that is capable of telling if the extension is connected or not.
// See https://krasimirtsonev.com/blog/article/Send-message-from-web-page-to-chrome-extensions-background-script
//
document.addEventListener("cozy.passwordextension.check-status", () => {
  // This will not work in Safari. It's OK for now as we don't have a Safari
  // extension, but we should find a way to send messages in Safari.
  chrome.runtime.sendMessage({ command: "checkextensionstatus" }, (response: any) => {
    const eventType = "cozy.passwordextension." + response;
    const event = document.createEvent("Event");

    event.initEvent(eventType);
    document.dispatchEvent(event);
  });
});
