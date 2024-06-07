import { Component, Input, OnDestroy, OnInit, ViewEncapsulation } from "@angular/core";
import * as uuid from "uuid";

import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";

const BroadcasterSubscriptionId = "FlagConditionalComponent";

/**
 * A component that renders its children only if the correct flag is set to TRUE
 *
 * usage: <app-flag-conditional flagname="some.flag.name"></app-flag-conditional>
 */
@Component({
  selector: "app-flag-conditional",
  templateUrl: "./flag-conditional.component.html",
  encapsulation: ViewEncapsulation.None,
})
export class FlagConditionalComponent implements OnInit, OnDestroy {
  @Input() flagname: string;
  private broadcasterSubscriptionId = "";

  isFlagEnabled = false;

  constructor(
    protected messagingService: MessagingService,
    protected broadcasterService: BroadcasterService,
  ) {}

  ngOnDestroy(): void {
    this.broadcasterService.unsubscribe(this.broadcasterSubscriptionId);
  }

  ngOnInit() {
    this.broadcasterSubscriptionId = BroadcasterSubscriptionId + uuid.v1();

    this.broadcasterService.subscribe(this.broadcasterSubscriptionId, (message: any) => {
      if (message.command === "flagChange" && message.flagName === this.flagname) {
        this.flagChanged(message.flagValue);
      }
    });

    this.messagingService.send("queryFlag", { flagName: this.flagname });
  }

  flagChanged(flagValue?: boolean) {
    this.isFlagEnabled = flagValue === true;
  }
}
