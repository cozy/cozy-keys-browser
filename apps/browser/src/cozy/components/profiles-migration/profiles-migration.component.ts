import { Component, Input, OnInit } from "@angular/core";

@Component({
  selector: "app-profiles-migration",
  templateUrl: "profiles-migration.component.html",
})
export class ProfilesMigrationComponent implements OnInit {
  @Input() profilesCount: number;
  remaining: string;
  deadline: string;
  ready = false;

  async ngOnInit() {
    this.remaining = "15 jours";
    this.deadline = "15/04/2024";
    this.ready = true;
  }

  moreInfo() {}
}
