import { Component, Input, OnChanges } from "@angular/core";
import { nameToColor } from "cozy-ui/transpiled/react/legacy/Avatar/helpers";

@Component({
  selector: "app-vault-contact-avatar",
  templateUrl: "./contact-avatar.component.html",
})
export class ContactAvatarComponent implements OnChanges {
  @Input() initials: string;
  @Input() size: number;

  background: string;

  ngOnChanges() {
    this.background = nameToColor(this.initials);
  }
}
