import { Component, OnInit } from "@angular/core";

import { PopupUtilsService } from "./services/popup-utils.service"; // eslint-disable-line
/* COZY IMPORTS */
/* eslint-disable */
import { CozyClientService } from "./services/cozyClient.service";
import { Router, NavigationStart, Event as NavigationEvent, RouterOutlet } from "@angular/router";
import { routerTransition } from "./app-routing.animations";
/* eslint-enable */
/* END */

@Component({
  selector: "app-tabs",
  templateUrl: "tabs.component.html",
  animations: [routerTransition],
})
export class TabsComponent implements OnInit {
  showCurrentTab = true;
  cozyUrl: string;
  event$;
  isVaultTabActive = true;

  constructor(
    private popupUtilsService: PopupUtilsService,
    private cozyClientService: CozyClientService,
    private router: Router
  ) {
    this.event$ = this.router.events.subscribe((event: NavigationEvent) => {
      if (event instanceof NavigationStart) {
        if (event.url === "/tabs/current") {
          this.isVaultTabActive = true;
        } else {
          this.isVaultTabActive = false;
        }
      }
    });
  }

  ngOnInit() {
    this.showCurrentTab = !this.popupUtilsService.inPopout(window);
    this.cozyUrl = this.cozyClientService.getAppURL("", "");
  }

  getState(outlet: RouterOutlet) {
    if (outlet.activatedRouteData.state === "ciphers") {
      const routeDirection =
        (window as any).routeDirection != null ? (window as any).routeDirection : "";
      return (
        "ciphers_direction=" +
        routeDirection +
        "_" +
        (outlet.activatedRoute.queryParams as any).value.folderId +
        "_" +
        (outlet.activatedRoute.queryParams as any).value.collectionId
      );
    } else {
      return outlet.activatedRouteData.state;
    }
  }
}
