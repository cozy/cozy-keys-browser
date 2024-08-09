import { Component, OnDestroy, OnInit } from "@angular/core";

import { HistoryService } from "../../popup/services/history.service";

@Component({
  selector: "app-restore-history",
  template: "<div></div>",
})
export class RestoreHistoryComponent implements OnInit, OnDestroy {
  constructor(
    private historyService: HistoryService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.historyService.init()
    this.historyService.gotoCurrentUrl()
  }

  ngOnDestroy(): void {
  }
}
