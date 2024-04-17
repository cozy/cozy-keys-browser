import { Component, Input, OnChanges } from "@angular/core";
import { nameToColor } from "cozy-ui/transpiled/react/Avatar/helpers";

@Component({
  selector: "app-vault-contact-avatar",
  templateUrl: "./contact-avatar.component.html",
})
export class ContactAvatarComponent implements OnChanges {
  @Input() initials: string;
  @Input() size: number;

  backgroundColor: string;

  ngOnChanges() {
    this.backgroundColor = nameToColor(this.initials);
  }
}
