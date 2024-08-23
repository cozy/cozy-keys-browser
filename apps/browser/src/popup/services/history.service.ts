import { Injectable } from "@angular/core";
import { Router, NavigationEnd } from "@angular/router";

import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

/*

This class is added by Cozy

It is in charge to manage a navigation history and to persist some contextual data
so that when the popup is closed the user can find back its navigation when re-opening
the popup.
This navigation state is used only two minutes after closing the popup. Beyond 2 mn the
popup will be opened on the default homePage.

The persistence is operated by BW stateService, in memory, thus is cleared
on logout and on lock.

*/

@Injectable()
export class HistoryService {
  private hist: string[] = [undefined];
  private homepage = "tabs/current";
  private defaultHist: string[] = ["/tabs/current", "/tabs/vault"];
  private defaultLoggedOutHistory: string[] = ["/home"];
  private rootPaths: string[] = ["/tabs/vault", "/tabs/generator", "/tabs/settings"];
  private currentUrlInProgress = false;
  private previousUrlInProgress = false;
  private initPromiseRef: Promise<void> | undefined;

  constructor(
    private router: Router,
    private stateService: StateService,
    private cipherService: CipherService,
  ) {
    /** for debug */
    // // @ts-ignore
    // window["hist"] = this;
    /** end custo */
  }

  async init() {
    if (this.initPromiseRef !== undefined) {
      return this.initPromiseRef;
    }
    this.initPromiseRef = this.initPromise();

    return this.initPromiseRef;
  }

  async initPromise() {
    await this.initHist();
    await this.initRouteListener();
  }

  async initHist() {
    // console.log("historyService.init()");
    const histStr: string = await this.stateService.getHistoryState();
    if (histStr === "/" || !histStr) {
      this.hist = this.defaultHist.slice();
      return;
    }

    const retrievedData = JSON.parse(histStr);
    const time = new Date().valueOf();
    if (retrievedData.hist === undefined || retrievedData.timestamp + 2 * 60 * 1000 < time) {
      // reset history if it is more than 2mn old
      this.hist = this.defaultHist.slice();
      this.saveHistoryState();
      return;
    }
    this.hist = retrievedData.hist;
    // if in last url in history is a "/generator", then simulate an AddEditCipherInfo (it has been
    // deleted when closing the popup)
    if (this.hist[0].startsWith("/generator")) {
      await this.cipherService.setAddEditCipherInfo({
        cipher: new CipherView(),
        collectionIds: [],
      });
    }
  }

  async initRouteListener() {
    // listen to router to feed the history
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        // console.log("navigationEnd event on url", event.url);
        if (this.currentUrlInProgress) {
          this.currentUrlInProgress = false;
        } else if (this.previousUrlInProgress) {
          this.hist.shift();
          this.hist[0] = event.url;
          this.previousUrlInProgress = false;
          this.saveHistoryState();
        } else {
          if (this.rootPaths.includes(event.url.split("?")[0])) {
            // back to a root of a tab : delete history
            this.hist = [event.url];
          } else if (event.url === "/lock") {
            this.hist = this.defaultHist.slice();
          } else if (event.url === this.hist[0] || event.url === "/restoreHistory") {
            return;
          } else {
            this.hist.unshift(event.url);
          }
          this.saveHistoryState();
        }
      }
    });
  }

  setLoggedOutHistory() {
    this.hist = this.defaultLoggedOutHistory.slice();
  }

  gotoPreviousUrl(steps = 1) {
    this.previousUrlInProgress = true;
    if (steps > 1) {
      this.hist.shift();
      this.gotoPreviousUrl(steps - 1);
      return;
    }
    if (this.hist.length < 2) {
      // should not happen, added for robustness
      this.gotoToUrl(this.homepage);
    } else {
      this.gotoToUrl(this.hist[1]);
    }
  }

  gotoCurrentUrl() {
    this.currentUrlInProgress = true;
    this.gotoToUrl(this.hist[0]);
  }

  private gotoToUrl(urlStr: any) {
    if (typeof urlStr !== "string") {
      urlStr = urlStr.url;
    }
    if (!urlStr) {
      this.gotoToUrl(this.homepage);
      return;
    }
    const words = urlStr.split("?");
    if (words.length === 1) {
      // no query params
      this.router.navigate([urlStr]);
    } else {
      const params = new URLSearchParams(words[1]);
      const queryParamsObj: any = {};
      for (const [key, value] of params) {
        queryParamsObj[key] = value;
      }
      this.router.navigate([words[0]], { queryParams: queryParamsObj });
    }
  }

  private async saveHistoryState() {
    await this.stateService.setHistoryState(
      JSON.stringify({
        hist: this.hist,
        timestamp: new Date().valueOf(),
      }),
    );
  }

  saveTempCipherInHistory(cipher: CipherView, step = 0) {
    const jsonCleanedCipher: string = jsonCleanedObject(cipher);
    this.updateQueryParamInHistory("tempCipher", jsonCleanedCipher, step);
  }

  updateQueryParamInHistory(key: string, value: string, step = 0) {
    const words = this.hist[step].split("?"); // words[0]=>url | words[1] => queryParams string
    const params = new URLSearchParams(words[1]);
    const queryParamsObj: any = {};
    for (const [key, value] of params) {
      queryParamsObj[key] = value;
    }
    if (!value || value == "") {
      delete queryParamsObj[key];
    } else {
      queryParamsObj[key] = value;
    }
    const queryParamSt: string = new URLSearchParams(queryParamsObj).toString();
    this.updateUrlAtStep(words[0] + (queryParamSt !== "" ? "?" + queryParamSt : ""), step);
  }

  private async updateUrlAtStep(url: string, step: number) {
    this.hist[step] = url;
    await this.saveHistoryState();
  }

  async updateTimeStamp() {
    await this.saveHistoryState();
  }

  async updatePreviousAddEditCipher(cipher: CipherView) {
    await this.saveTempCipherInHistory(cipher, 1);
  }
}

// Cozy Helper

/*
Remove all null properties to shorten the stored url in history (recursive)
*/
function jsonCleanedObject(obj: any): any {
  for (const key in obj) {
    if (obj[key] === null) {
      delete obj[key];
    } else if (typeof obj[key] === "object") {
      jsonCleanedObject(obj[key]);
    }
  }
  return JSON.stringify(obj);
}
// END Cozy helper
