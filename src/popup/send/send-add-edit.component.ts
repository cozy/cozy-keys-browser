import { DatePipe, Location } from "@angular/common";
import { Component } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { first } from "rxjs/operators";

import { AddEditComponent as BaseAddEditComponent } from "jslib-angular/components/send/add-edit.component";
import { EnvironmentService } from "jslib-common/abstractions/environment.service";
import { I18nService } from "jslib-common/abstractions/i18n.service";
import { LogService } from "jslib-common/abstractions/log.service";
import { MessagingService } from "jslib-common/abstractions/messaging.service";
import { PlatformUtilsService } from "jslib-common/abstractions/platformUtils.service";
import { PolicyService } from "jslib-common/abstractions/policy.service";
import { SendService } from "jslib-common/abstractions/send.service";

import { StateService } from "../../services/abstractions/state.service";
import { PopupUtilsService } from "../services/popup-utils.service";
/** Start Cozy imports */
/* eslint-disable */
import { HistoryService } from "../services/history.service";
/* eslint-enable */
/** End Cozy imports */

@Component({
  selector: "app-send-add-edit",
  templateUrl: "send-add-edit.component.html",
})
export class SendAddEditComponent extends BaseAddEditComponent {
  // Options header
  showOptions = false;
  // File visibility
  isFirefox = false;
  inPopout = false;
  inSidebar = false;
  isLinux = false;
  isUnsupportedMac = false;

  constructor(
    i18nService: I18nService,
    platformUtilsService: PlatformUtilsService,
    stateService: StateService,
    messagingService: MessagingService,
    policyService: PolicyService,
    environmentService: EnvironmentService,
    datePipe: DatePipe,
    sendService: SendService,
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private popupUtilsService: PopupUtilsService,
    logService: LogService,
    private historyService: HistoryService
  ) {
    super(
      i18nService,
      platformUtilsService,
      environmentService,
      datePipe,
      sendService,
      messagingService,
      policyService,
      logService,
      stateService
    );
  }

  get showFileSelector(): boolean {
    return !(this.editMode || this.showFilePopoutMessage);
  }

  get showFilePopoutMessage(): boolean {
    return (
      !this.editMode &&
      (this.showFirefoxFileWarning || this.showSafariFileWarning || this.showChromiumFileWarning)
    );
  }

  get showFirefoxFileWarning(): boolean {
    return this.isFirefox && !(this.inSidebar || this.inPopout);
  }

  get showSafariFileWarning(): boolean {
    return this.isSafari && !this.inPopout;
  }

  // Only show this for Chromium based browsers in Linux and Mac > Big Sur
  get showChromiumFileWarning(): boolean {
    return (
      (this.isLinux || this.isUnsupportedMac) &&
      !this.isFirefox &&
      !(this.inSidebar || this.inPopout)
    );
  }

  popOutWindow() {
    this.popupUtilsService.popOut(window);
  }

  async ngOnInit() {
    // File visilibity
    this.isFirefox = this.platformUtilsService.isFirefox();
    this.inPopout = this.popupUtilsService.inPopout(window);
    this.inSidebar = this.popupUtilsService.inSidebar(window);
    this.isLinux = window?.navigator?.userAgent.indexOf("Linux") !== -1;
    this.isUnsupportedMac =
      this.platformUtilsService.isChrome() && window?.navigator?.appVersion.includes("Mac OS X 11");

    this.route.queryParams.pipe(first()).subscribe(async (params) => {
      if (params.sendId) {
        this.sendId = params.sendId;
      }
      if (params.type) {
        const type = parseInt(params.type, null);
        this.type = type;
      }
      await this.load();
    });

    window.setTimeout(() => {
      if (!this.editMode) {
        document.getElementById("name").focus();
      }
    }, 200);
  }

  async submit(): Promise<boolean> {
    if (await super.submit()) {
      this.cancel();
      return true;
    }

    return false;
  }

  async delete(): Promise<boolean> {
    if (await super.delete()) {
      this.cancel();
      return true;
    }

    return false;
  }

  cancel() {
    // // If true, the window was pop'd out on the add-send page. location.back will not work
    // if ((window as any).previousPopupUrl.startsWith("/add-send")) {
    //   this.router.navigate(["tabs/send"]);
    // } else {
    //   this.location.back();
    // }

    // note Cozy 1 : collections are not displayed in Cozy Pass Addon, but we modify nevertheless
    // this back in case one day we decide to use this component
    // note Cozy 2 : the routing pb mentionned above by BW is not relevant for the historyService
    this.historyService.gotoPreviousUrl();
  }
}
