import { Location } from "@angular/common";
/* Cozy custo
import { ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit } from "@angular/core";
*/
import {
  ChangeDetectorRef,
  Component,
  NgZone,
  OnDestroy,
  OnInit,
  HostListener,
} from "@angular/core";
/* end custo */
import { ActivatedRoute, Router } from "@angular/router";
import { first } from "rxjs/operators";

import { VaultItemsComponent as BaseVaultItemsComponent } from "@bitwarden/angular/vault/components/vault-items.component";
import { VaultFilter } from "@bitwarden/angular/vault/vault-filter/models/vault-filter.model";
import { BroadcasterService } from "@bitwarden/common/abstractions/broadcaster.service";
import { CollectionService } from "@bitwarden/common/abstractions/collection.service";
import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { OrganizationService } from "@bitwarden/common/abstractions/organization/organization.service.abstraction";
import { PlatformUtilsService } from "@bitwarden/common/abstractions/platformUtils.service";
import { SearchService } from "@bitwarden/common/abstractions/search.service";
import { TreeNode } from "@bitwarden/common/models/domain/tree-node";
import { CollectionView } from "@bitwarden/common/models/view/collection.view";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

import { BrowserApi } from "../../../../browser/browserApi";
import { BrowserComponentState } from "../../../../models/browserComponentState";
import { PopupUtilsService } from "../../../../popup/services/popup-utils.service";
import { BrowserStateService } from "../../../../services/abstractions/browser-state.service";
import { VaultFilterService } from "../../../services/vault-filter.service";
/** Start Cozy imports */
/* eslint-disable */
import { AutofillService } from "../../../../autofill/services/abstractions/autofill.service";
import { CozyClientService } from "../../../../popup/services/cozyClient.service";
import { KonnectorsService } from "../../../../popup/services/konnectors.service";
import { HistoryService } from "../../../../popup/services/history.service";
import { UriMatchType } from "@bitwarden/common/enums/uriMatchType";
/* eslint-enable */
/** End Cozy imports */

const ComponentId = "VaultItemsComponent";

@Component({
  selector: "app-vault-items",
  templateUrl: "vault-items.component.html",
})
export class VaultItemsComponent extends BaseVaultItemsComponent implements OnInit, OnDestroy {
  groupingTitle: string;
  state: BrowserComponentState;
  folderId: string = null;
  collectionId: string = null;
  type: CipherType = null;
  nestedFolders: TreeNode<FolderView>[];
  nestedCollections: TreeNode<CollectionView>[];
  searchTypeSearch = false;
  showOrganizations = false;
  vaultFilter: VaultFilter;
  deleted = true;
  noneFolder = false;
  showVaultFilter = false;

  private selectedTimeout: number;
  private preventSelected = false;
  private applySavedState = true;
  private scrollingContainer = "cdk-virtual-scroll-viewport";
  private pageDetails: any[] = []; // Cozy custo

  constructor(
    searchService: SearchService,
    private organizationService: OrganizationService,
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private ngZone: NgZone,
    private broadcasterService: BroadcasterService,
    private changeDetectorRef: ChangeDetectorRef,
    private stateService: BrowserStateService,
    private popupUtils: PopupUtilsService,
    private i18nService: I18nService,
    private folderService: FolderService,
    private collectionService: CollectionService,
    private platformUtilsService: PlatformUtilsService,
    private cipherService: CipherService,
    private vaultFilterService: VaultFilterService,
    private cozyClientService: CozyClientService,
    private konnectorsService: KonnectorsService,
    private autofillService: AutofillService,
    private historyService: HistoryService
  ) {
    super(searchService);
    this.applySavedState =
      (window as any).previousPopupUrl != null &&
      !(window as any).previousPopupUrl.startsWith("/ciphers");
  }

  // Cozy custo
  @HostListener("window:keydown", ["$event"])
  handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      if (this.searchText == null || this.searchText === "") {
        this.back();
      } else {
        this.emptySearch();
      }
    }
  }
  // end custo

  async ngOnInit() {
    this.searchTypeSearch = !this.platformUtilsService.isSafari();
    this.showOrganizations = this.organizationService.hasOrganizations();
    this.vaultFilter = this.vaultFilterService.getVaultFilter();
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.queryParams.pipe(first()).subscribe(async (params) => {
      if (this.applySavedState) {
        this.state = await this.stateService.getBrowserVaultItemsComponentState();
        if (this.state?.searchText) {
          this.searchText = this.state.searchText;
        }
      }
      // Cozy custo
      if (params.searchText) {
        this.searchText = params.searchText;
        this.search(50);
      }
      // end custo

      if (params.deleted) {
        this.showVaultFilter = true;
        this.groupingTitle = this.i18nService.t("trash");
        this.searchPlaceholder = this.i18nService.t("searchTrash");
        await this.load(this.buildFilter(), true);
      } else if (params.type) {
        this.showVaultFilter = true;
        this.searchPlaceholder = this.i18nService.t("searchType");
        this.type = parseInt(params.type, null);
        switch (this.type) {
          case CipherType.Login:
            this.groupingTitle = this.i18nService.t("logins");
            break;
          case CipherType.Card:
            this.groupingTitle = this.i18nService.t("cards");
            break;
          case CipherType.Identity:
            this.groupingTitle = this.i18nService.t("identities");
            break;
          case CipherType.SecureNote:
            this.groupingTitle = this.i18nService.t("secureNotes");
            break;
          // Cozy customization
          case CipherType.Paper:
            this.groupingTitle = this.i18nService.t("typePapers");
            break;
          case CipherType.Contact:
            this.groupingTitle = this.i18nService.t("typeContacts");
            break;
          // Cozy customization end
          default:
            break;
        }
        await this.load(this.buildFilter());

        // Cozy customization
        if (this.type === CipherType.Paper) {
          await this.sortByCreationDate();
        }
        // Cozy customization end
      } else if (params.folderId) {
        this.showVaultFilter = true;
        this.folderId = params.folderId === "none" ? null : params.folderId;
        this.searchPlaceholder = this.i18nService.t("searchFolder");
        if (this.folderId != null) {
          this.showOrganizations = false;
          const folderNode = await this.vaultFilterService.getFolderNested(this.folderId);
          if (folderNode != null && folderNode.node != null) {
            this.groupingTitle = folderNode.node.name;
            this.nestedFolders =
              folderNode.children != null && folderNode.children.length > 0
                ? folderNode.children
                : null;
          }
        } else {
          this.noneFolder = true;
          this.groupingTitle = this.i18nService.t("noneFolder");
        }
        await this.load(this.buildFilter());
      } else if (params.collectionId) {
        this.showVaultFilter = false;
        this.collectionId = params.collectionId;
        this.searchPlaceholder = this.i18nService.t("searchCollection");
        const collectionNode = await this.collectionService.getNested(this.collectionId);
        if (collectionNode != null && collectionNode.node != null) {
          this.groupingTitle = collectionNode.node.name;
          this.nestedCollections =
            collectionNode.children != null && collectionNode.children.length > 0
              ? collectionNode.children
              : null;
        }
        await this.load(
          (c) => c.collectionIds != null && c.collectionIds.indexOf(this.collectionId) > -1
        );
      } else {
        this.showVaultFilter = true;
        this.groupingTitle = this.i18nService.t("allItems");
        await this.load(this.buildFilter());
      }

      if (this.applySavedState && this.state != null) {
        window.setTimeout(
          () =>
            this.popupUtils.setContentScrollY(window, this.state.scrollY, this.scrollingContainer),
          0
        );
      }
      await this.stateService.setBrowserVaultItemsComponentState(null);
    });

    this.broadcasterService.subscribe(ComponentId, (message: any) => {
      this.ngZone.run(async () => {
        switch (message.command) {
          case "syncCompleted":
            if (message.successfully) {
              window.setTimeout(() => {
                this.refresh();
              }, 500);
            }
            break;
          // Cozy custo
          case "collectPageDetailsResponse":
            if (message.sender === ComponentId) {
              this.pageDetails.push({
                frameId: message.webExtSender.frameId,
                tab: message.tab,
                details: message.details,
              });
            }
            break;
          // end custo
          default:
            break;
        }

        this.changeDetectorRef.detectChanges();
      });
    });

    // Cozy custo : request page detail from current tab
    const tab = await BrowserApi.getTabFromCurrentWindow();
    this.pageDetails = [];
    BrowserApi.tabSendMessage(tab, {
      command: "collectPageDetails",
      tab: tab,
      sender: ComponentId,
    });
    // end custo
  }

  ngOnDestroy() {
    this.saveState();
    this.unloadMnger(); // Cozy custo
    this.broadcasterService.unsubscribe(ComponentId);
  }

  // Cozy custo : beforeunload event would be better but is not triggered in webextension...
  // see : https://stackoverflow.com/questions/2315863/does-onbeforeunload-event-trigger-for-popup-html-in-a-google-chrome-extension
  @HostListener("window:unload", ["$event"])
  async unloadMnger(event?: any) {
    this.historyService.updateQueryParamInHistory(
      "searchText",
      this.searchText ? this.searchText : ""
    );
  }
  // end custo

  selectCipher(cipher: CipherView) {
    this.selectedTimeout = window.setTimeout(() => {
      if (!this.preventSelected) {
        super.selectCipher(cipher);
        this.router.navigate(["/view-cipher"], { queryParams: { cipherId: cipher.id } });
      }
      this.preventSelected = false;
    }, 200);
  }

  selectFolder(folder: FolderView) {
    if (folder.id != null) {
      this.router.navigate(["/ciphers"], { queryParams: { folderId: folder.id } });
    }
  }

  selectCollection(collection: CollectionView) {
    this.router.navigate(["/ciphers"], { queryParams: { collectionId: collection.id } });
  }

  async launchCipher(cipher: CipherView) {
    if (cipher.type !== CipherType.Login || !cipher.login.canLaunch) {
      return;
    }

    if (this.selectedTimeout != null) {
      window.clearTimeout(this.selectedTimeout);
    }
    this.preventSelected = true;
    await this.cipherService.updateLastLaunchedDate(cipher.id);
    BrowserApi.createNewTab(cipher.login.launchUri);
    if (this.popupUtils.inPopup(window)) {
      BrowserApi.closePopup(window);
    }
  }

  async addCipher() {
    if (this.deleted) {
      return false;
    }
    // Cozy customization
    if (this.type === CipherType.Paper) {
      window.open(this.cozyClientService.getAppURL("mespapiers", "paper/create"));
      return false;
    }

    const route = this.type ? "/add-cipher" : "/add-generic";
    // Cozy customization
    super.addCipher();
    this.router.navigate([route], {
      queryParams: {
        folderId: this.folderId,
        type: this.type,
        collectionId: this.collectionId,
        selectedVault: this.vaultFilter.selectedOrganizationId,
      },
    });
  }

  back() {
    /* Cozy custo
    (window as any).routeDirection = "b";
    this.location.back();
    */
    this.historyService.gotoPreviousUrl();
    // end custo
  }

  showGroupings() {
    return (
      !this.isSearching() &&
      ((this.nestedFolders && this.nestedFolders.length) ||
        (this.nestedCollections && this.nestedCollections.length))
    );
  }

  async changeVaultSelection() {
    this.vaultFilter = this.vaultFilterService.getVaultFilter();
    await this.load(this.buildFilter(), this.deleted);
  }

  private buildFilter(): (cipher: CipherView) => boolean {
    return (cipher) => {
      let cipherPassesFilter = true;
      if (this.deleted && cipherPassesFilter) {
        cipherPassesFilter = cipher.isDeleted;
      }
      if (this.type != null && cipherPassesFilter) {
        cipherPassesFilter = cipher.type === this.type;
      }
      if (this.folderId != null && this.folderId != "none" && cipherPassesFilter) {
        cipherPassesFilter = cipher.folderId === this.folderId;
      }
      if (this.noneFolder) {
        cipherPassesFilter = cipher.folderId == null;
      }
      if (this.collectionId != null && cipherPassesFilter) {
        cipherPassesFilter =
          cipher.collectionIds != null && cipher.collectionIds.indexOf(this.collectionId) > -1;
      }
      if (this.vaultFilter.selectedOrganizationId != null && cipherPassesFilter) {
        cipherPassesFilter = cipher.organizationId === this.vaultFilter.selectedOrganizationId;
      }
      if (this.vaultFilter.myVaultOnly && cipherPassesFilter) {
        cipherPassesFilter = cipher.organizationId === null;
      }
      return cipherPassesFilter;
    };
  }

  private async saveState() {
    this.state = {
      scrollY: this.popupUtils.getContentScrollY(window, this.scrollingContainer),
      searchText: this.searchText,
    };
    await this.stateService.setBrowserVaultItemsComponentState(this.state);
  }

  // Cozy customization
  private async sortByCreationDate() {
    this.ciphers = this.ciphers.sort((a, b) => {
      return new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime();
    });
  }
  // Cozy customization end

  // Cozy custo
  async fillOrLaunchCipher(cipher: CipherView) {
    // Get default matching setting for urls
    let defaultMatch = await this.stateService.getDefaultUriMatch();
    if (defaultMatch == null) {
      defaultMatch = UriMatchType.Domain;
    }
    // Get the current url
    const tab = await BrowserApi.getTabFromCurrentWindow();
    const isCipherMatcinghUrl = await this.konnectorsService.hasURLMatchingCiphers(
      tab.url,
      [cipher],
      defaultMatch
    );
    if (isCipherMatcinghUrl) {
      this.fillCipher(cipher);
    } else {
      this.launchCipher(cipher);
    }
  }

  async fillCipher(cipher: CipherView) {
    let totpCode = null;

    if (this.pageDetails == null || this.pageDetails.length === 0) {
      this.platformUtilsService.showToast("error", null, this.i18nService.t("errorOccurred"));
      return;
    }

    try {
      totpCode = await this.autofillService.doAutoFill({
        cipher: cipher,
        pageDetails: this.pageDetails,
        doc: window.document,
        tab: null,
        fillNewPassword: true,
      });
      if (totpCode != null) {
        this.platformUtilsService.copyToClipboard(totpCode, { window: window });
      }
      if (this.popupUtils.inPopup(window)) {
        BrowserApi.closePopup(window);
      }
    } catch (e) {
      this.ngZone.run(() => {
        this.platformUtilsService.showToast("error", null, this.i18nService.t("autofillError"));
        this.changeDetectorRef.detectChanges();
      });
    }
  }

  async openWebApp() {
    if (this.type === CipherType.Paper) {
      window.open(this.cozyClientService.getAppURL("mespapiers", ""));
    } else {
      window.open(this.cozyClientService.getAppURL("passwords", ""));
    }
  }

  emptySearch() {
    this.searchText = "";
    document.getElementById("search").focus();
    this.search(50);
  }

  viewCipher(cipher: CipherView) {
    this.router.navigate(["/view-cipher"], { queryParams: { cipherId: cipher.id } });
  }
  // end custo

  // Cozy customization, override search method to always sort by date for papers
  protected async doSearch(indexedCiphers?: CipherView[]) {
    await super.doSearch(indexedCiphers);

    if (this.type === CipherType.Paper) {
      await this.sortByCreationDate();
    }
  }
  // Cozy customization end
}
