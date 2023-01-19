import { Injectable } from "@angular/core";
import { Router, NavigationEnd } from "@angular/router";
import { CipherView } from "jslib-common/models/view/cipherView";

/* 

This class is added by Cozy

It is in charge to manage a navigation history and to persist some contextual data 
so that when the popup is closed the user can find back its navigation when re-opening
the popup.
This navigation state is taken only two minutes after closing the popup in order to come
back to the page displaying what is relevant for the current tab browser.

*/

@Injectable()
export class HistoryService {
  private hist: any[] = [undefined];
  private homepage = "tabs/current";
  private defaultHist: string[] = ["tabs/current", "tabs/vault"];
  private rootPaths: string[] = ["/tabs/vault", "/tabs/generator", "/tabs/settings"];
  private currentUrlInProgress: boolean = false;
  private previousUrlInProgress: boolean = false;

  constructor(private router: Router) {
    router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        if (this.currentUrlInProgress) {
          this.currentUrlInProgress = false;
        } else if (this.previousUrlInProgress) {
          this.hist.shift();
          this.hist[0] = event.url;
          this.previousUrlInProgress = false;
          localStorage.setItem(
            "popupHistory",
            JSON.stringify({
              hist: this.hist,
              timestamp: new Date().valueOf(),
            })
          );
        } else {
          if (this.rootPaths.includes(event.url)) {
            // back to a root of a tab : delete history
            this.hist = [event.url];
          } else {
            this.hist.unshift(event.url);
          }
          localStorage.setItem(
            "popupHistory",
            JSON.stringify({
              hist: this.hist,
              timestamp: new Date().valueOf(),
            })
          );
        }
      }
    });
  }

  public init() {
    const histStr = localStorage.getItem("popupHistory");

    if (histStr === "/" || !histStr) {
      this.hist = this.defaultHist.slice();
      return;
    }

    const retrievedData = JSON.parse(histStr);
    console.log("histroryService.init : retrievedData", retrievedData);

    const time = new Date().valueOf();
    if (retrievedData.hist === undefined || retrievedData.timestamp + 120000 < time) {
      // reset history if it is more than 2mn old
      this.hist = this.defaultHist.slice();
      this.clear();
      return;
    }
    this.hist = retrievedData.hist;
    console.log("oninit historyService history = ", this.hist);
  }

  public gotoPreviousUrl(steps: number = 1) {
    console.log("gotoPreviousUrl()");
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

  public clear() {
    // TODO BJA : à appeler au lock et logout
    // TODO BJA : use chrome.storage instead of localStorage
    localStorage.removeItem("popupHistory");
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

  public updateCurrentUrl(url: string) {
    this.hist[0] = url;
    localStorage.setItem(
      "popupHistory",
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
