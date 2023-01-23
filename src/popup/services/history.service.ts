import { Injectable } from "@angular/core";
import { Router, NavigationEnd } from "@angular/router";
import { CipherView } from "jslib-common/models/view/cipherView";
import { BrowserApi } from "../../browser/browserApi";
import { StateService } from "../../services/state.service";

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
  private hist: any[] = [undefined];
  private homepage = "tabs/current";
  private defaultHist: string[] = ["/tabs/current", "/tabs/vault"];
  private rootPaths: string[] = ["/tabs/vault", "/tabs/generator", "/tabs/settings"];
  private currentUrlInProgress: boolean = false;
  private previousUrlInProgress: boolean = false;
  private stateService: StateService;

  constructor(private router: Router) {
    // retrieve the stateService (standard injection was not working ?)
    const page = BrowserApi.getBackgroundPage();
    this.stateService = page.bitwardenMain["stateService"];

    // listen to router to feed the history
    router.events.subscribe(async (event) => {
      if (event instanceof NavigationEnd) {
        if (this.currentUrlInProgress) {
          this.currentUrlInProgress = false;
        } else if (this.previousUrlInProgress) {
          this.hist.shift();
          this.hist[0] = event.url;
          this.previousUrlInProgress = false;
          await this.stateService.setHistoryState(
            JSON.stringify({
              hist: this.hist,
              timestamp: new Date().valueOf(),
            })
          );
        } else {
          if (this.rootPaths.includes(event.url)) {
            // back to a root of a tab : delete history
            this.hist = [event.url];
          } else if (event.url === "/lock") {
            this.hist = this.defaultHist.slice();
          } else if (event.url === this.hist[0]) {
            return;
          } else {
            this.hist.unshift(event.url);
          }
          await this.stateService.setHistoryState(
            JSON.stringify({
              hist: this.hist,
              timestamp: new Date().valueOf(),
            })
          );
        }
      }
    });
  }

  public async init() {
    const histStr: string = await this.stateService.getHistoryState();

    if (histStr === "/" || !histStr) {
      this.hist = this.defaultHist.slice();
      return;
    }

    const retrievedData = JSON.parse(histStr);

    const time = new Date().valueOf();
    if (retrievedData.hist === undefined || retrievedData.timestamp + 120000 < time) {
      // reset history if it is more than 2mn old
      this.hist = this.defaultHist.slice();
      this.clear();
      return;
    }
    this.hist = retrievedData.hist;
  }

  public gotoPreviousUrl(steps: number = 1) {
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

  public gotoCurrentUrl() {
    this.currentUrlInProgress = true;
    this.gotoToUrl(this.hist[0]);
  }

  private gotoToUrl(urlStr: any) {
    var tempCipher: CipherView = undefined;
    if (typeof urlStr !== "string") {
      tempCipher = urlStr.tempCipher;
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

  private async clear() {
    this.hist = [];
    await this.stateService.setHistoryState(null);
  }

  public saveTempCipherInHistory(cipher: CipherView) {
    const cleanedCipher: any = cleanCipher(cipher);
    this.updateQueryParamInCurrentUrl("tempCipher", JSON.stringify(cleanedCipher));
  }

  public updateQueryParamInCurrentUrl(key: string, value: string) {
    const words = this.hist[0].split("?"); // words[0]=>url | words[1] => queryParams string
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
    this.updateCurrentUrl(words[0] + (queryParamSt !== "" ? "?" + queryParamSt : ""));
  }

  public async updateCurrentUrl(url: string) {
    this.hist[0] = url;
    await this.stateService.setHistoryState(
      JSON.stringify({
        hist: this.hist,
        timestamp: new Date().valueOf(),
      })
    );
  }
}

// Cozy Helper

/* 
Remove all null properties to shorten the stored url in history (recursive)
*/
function cleanCipher(cipher: any) {
  for (const key in cipher) {
    if (cipher[key] === null) {
      delete cipher[key];
    } else if (typeof cipher[key] === "object") {
      cleanCipher(cipher[key]);
    }
  }
  return cipher;
}
// END Cozy helper
