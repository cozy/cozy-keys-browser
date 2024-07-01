import { Directive, Input, OnDestroy, OnInit, TemplateRef, ViewContainerRef } from "@angular/core";
import * as uuid from "uuid";

import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";

const BroadcasterSubscriptionId = "IfFlagDirective";

/**
 * A directive that allows to render a component only if the correct flag is set to TRUE
 *
 * usage: <div *ifFlag="some.flag.name"></div>
 */
@Directive({ selector: "[ifFlag]" })
export class IfFlagDirective implements OnInit, OnDestroy {
  private isFlagEnabled = false;
  private hasView = false;
  private flagName: string;
  private broadcasterSubscriptionId = "";

  @Input() set ifFlag(flagName: string) {
    this.flagName = flagName;
    this.flagChanged();
  }

  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
    protected messagingService: MessagingService,
    protected broadcasterService: BroadcasterService,
  ) {}

  ngOnDestroy(): void {
    this.broadcasterService.unsubscribe(this.broadcasterSubscriptionId);
  }

  ngOnInit() {
    this.broadcasterSubscriptionId = BroadcasterSubscriptionId + uuid.v1();

    this.broadcasterService.subscribe(this.broadcasterSubscriptionId, (message: any) => {
      if (message.command === "flagChange" && message.flagName === this.flagName) {
        this.flagChanged(message.flagValue);
      }
    });

    this.messagingService.send("queryFlag", { flagName: this.flagName });
  }

  flagChanged(flagValue?: boolean) {
    this.isFlagEnabled = flagValue === true;

    if (this.isFlagEnabled && !this.hasView) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.hasView = true;
    } else if (!this.isFlagEnabled && this.hasView) {
      this.viewContainer.clear();
      this.hasView = false;
    }
  }
}
