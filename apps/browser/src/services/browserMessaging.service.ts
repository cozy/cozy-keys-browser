import { MessagingService } from "@bitwarden/common/abstractions/messaging.service";

import { BrowserApi } from "../browser/browserApi";
/** Start Cozy imports */
/* eslint-disable */
import RuntimeBackground from "../background/runtime.background";
/* eslint-enable */
/** End Cozy imports */

function debounce(fnToDebounce: () => any, delay: number, context: any) {
  let timeout: any;
  return (...args: any[]) => {
    const effect = () => {
      timeout = null;
      return fnToDebounce.apply(context, args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(effect, delay);
  };
}

export default class BrowserMessagingService implements MessagingService {
  private runtimeBackground: RuntimeBackground;
  private syncCounter = 0;

  constructor() {
    this.debouncedCountSync = debounce(this.debouncedCountSync, 1000, this);
  }

  send(subscriber: string, arg: any = {}) {
    return BrowserApi.sendMessage(subscriber, arg);
  }

  /*
    @cozy override
    some messages must be sent to the runtimeBackground, and not only to frames (popup & content scripts)
    */
  setRuntimeBackground(runtimeBackground: RuntimeBackground) {
    this.runtimeBackground = runtimeBackground;
  }

  /*
    @override by Cozy
    In case of a quick serie of mors than 2 syncCompleted, we debounce a full sync of all the ciphers.
    This could be avoided if bulk operations were done in bulk with the proper server call, but currently
    (2021/04/05) the server doesn't implement these routes.
    */
  private countSync() {
    // console.log(`countSync()`, this.syncCounter + 1);
    this.syncCounter += 1;
    if (this.syncCounter < 3) {
      // console.log(' a chrome.runtime.sendMessage(syncCompleted) is broadcasted');
      chrome.runtime.sendMessage({ command: "syncCompleted", successfully: true });
    }
    this.debouncedCountSync();
  }

  private debouncedCountSync() {
    // console.log(`debouncedCountSync() after a delay grouped`, this.syncCounter, 'syncCompleted messages');
    if (this.syncCounter > 2) {
      // console.log(`therefore a fullSync() is trigered on the addon`);
      this.runtimeBackground.processMessage(
        { command: "fullSync" },
        "syncService" as chrome.runtime.MessageSender,
        null
      );
    }
    this.syncCounter = 0;
  }
}
