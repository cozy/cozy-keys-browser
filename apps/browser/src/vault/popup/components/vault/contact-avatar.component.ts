import { Component, Input } from "@angular/core";
import { nameToColor } from "cozy-ui/transpiled/react/Avatar/helpers";

@Component({
  selector: "app-vault-contact-avatar",
  templateUrl: "./contact-avatar.component.html",
})
export class ContactAvatarComponent {
  @Input() initials: string;
  @Input() size: number;

  backgroundColor: string;

  async ngOnInit() {
    this.backgroundColor = nameToColor(this.initials);
  }
}
