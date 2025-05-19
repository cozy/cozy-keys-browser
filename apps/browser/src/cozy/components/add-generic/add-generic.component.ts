import { Location } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { first } from "rxjs/operators";

import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";

import { CozyClientService } from "../../../popup/services/cozyClient.service";

@Component({
  selector: "app-vault-add-generic",
  templateUrl: "add-generic.component.html",
})
export class AddGenericComponent implements OnInit, OnDestroy {
  title: string;
  cipherType = CipherType;

  name: string;
  uri: string;
  selectedVault: string;
  folderId: string;
  collectionId: string;

  constructor(
    private cozyClientService: CozyClientService,
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
  ) {}

  ngOnInit() {
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.queryParams.pipe(first()).subscribe(async (params: any) => {
      if (params.name) {
        this.name = params.name;
      }
      if (params.uri) {
        this.uri = params.uri;
      }
      if (params.selectedVault) {
        this.selectedVault = params.selectedVault;
      }
      if (params.folderId) {
        this.folderId = params.folderId;
      }
      if (params.collectionId) {
        this.collectionId = params.collectionId;
      }
    });
  }

  ngOnDestroy() {
    //
  }

  back() {
    this.location.back();
  }

  async selectType(type: CipherType) {
    if (type === CipherType.Contact) {
      await this.cozyClientService.getClientInstance();

      await this.back();
      // window.open will instantaneously close the popup which may prevent the
      // router navigation to happens (called inside the `back()` method)
      // by calling it inside a `setTimeout()` we ensure the call will be done after
      // the current Angular's loop tick and so we ensure navigation did occure
      // (the 1ms value doesn't really matter here)
      setTimeout(() => {
        const appUrl = this.cozyClientService.getAppURL("contacts", "new");
        // eslint-disable-next-line no-restricted-globals
        window.open(appUrl);
      }, 1);
      return;
    }

    this.router.navigate(["/add-cipher"], {
      queryParams: {
        cloneMode: true, // we need this in order to go back twice after creation
        collectionId: this.collectionId,
        folderId: this.folderId,
        name: this.name,
        selectedVault: this.selectedVault,
        type: type,
        uri: this.uri,
      },
    });
  }
}
