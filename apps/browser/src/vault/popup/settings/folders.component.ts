import { Component, HostListener } from "@angular/core";
import { Router } from "@angular/router";
import { map, Observable } from "rxjs";

import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

@Component({
  selector: "app-folders",
  templateUrl: "folders.component.html",
})
export class FoldersComponent {
  folders$: Observable<FolderView[]>;

  constructor(
    private folderService: FolderService,
    private router: Router,
  ) {
    this.folders$ = this.folderService.folderViews$.pipe(
      map((folders) => {
        if (folders.length > 0) {
          folders = folders.slice(0, folders.length - 1);
        }

        return folders;
      }),
    );
  }

  folderSelected(folder: FolderView) {
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.router.navigate(["/edit-folder"], { queryParams: { folderId: folder.id } });
  }

  addFolder() {
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.router.navigate(["/add-folder"]);
  }

  // Cozy custo
  @HostListener("window:keydown", ["$event"])
  handleKeyDown(event: KeyboardEvent) {
    this.router.navigate(["/tabs/settings"]);
    event.preventDefault();
  }
  // end custo
}
