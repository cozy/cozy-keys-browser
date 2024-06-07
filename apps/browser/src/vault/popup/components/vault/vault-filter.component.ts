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
import { BehaviorSubject, Subject, firstValueFrom, from } from "rxjs";
import { first, switchMap, takeUntil } from "rxjs/operators";

import { VaultFilter } from "@bitwarden/angular/vault/vault-filter/models/vault-filter.model";
import { SearchService } from "@bitwarden/common/abstractions/search.service";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CollectionView } from "@bitwarden/common/vault/models/view/collection.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

import { BrowserGroupingsComponentState } from "../../../../models/browserGroupingsComponentState";
import { BrowserApi } from "../../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../../platform/popup/browser-popup-utils";
import { VaultBrowserStateService } from "../../../services/vault-browser-state.service";
import { VaultFilterService } from "../../../services/vault-filter.service";

/** Start Cozy imports */
/* eslint-disable */
import { CozyClientService } from "../../../../popup/services/cozyClient.service";
import { KonnectorsService } from "../../../../popup/services/konnectors.service";
import { HistoryService } from "../../../../popup/services/history.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { DialogService } from "../../../../../../../libs/components/src/dialog";
/* eslint-enable */

interface CollectionViewWithKonnector extends CollectionView {
  isKonnector?: boolean;
}
/** End Cozy imports */

const ComponentId = "VaultComponent";

@Component({
  selector: "app-vault-filter",
  templateUrl: "vault-filter.component.html",
})
export class VaultFilterComponent implements OnInit, OnDestroy {
  get showNoFolderCiphers(): boolean {
    return (
      this.noFolderCiphers != null &&
      this.noFolderCiphers.length < this.noFolderListSize &&
      this.collections.length === 0
    );
  }

  get folderCount(): number {
    return this.nestedFolders.length - (this.showNoFolderCiphers ? 0 : 1);
  }
  folders: FolderView[];
  nestedFolders: TreeNode<FolderView>[];
  collections: CollectionView[];
  nestedCollections: TreeNode<CollectionViewWithKonnector>[];
  loaded = false;
  cipherType = CipherType;
  ciphers: CipherView[];
  favoriteCiphers: CipherView[];
  noFolderCiphers: CipherView[];
  folderCounts = new Map<string, number>();
  collectionCounts = new Map<string, number>();
  typeCounts = new Map<CipherType, number>();
  state: BrowserGroupingsComponentState;
  showLeftHeader = true;
  searchPending = false;
  searchTypeSearch = false;
  deletedCount = 0;
  vaultFilter: VaultFilter;
  selectedOrganization: string = null;
  showCollections = true;
  cipherNumberForCurrentTab: string;

  private loadedTimeout: number;
  private selectedTimeout: number;
  private preventSelected = false;
  private noFolderListSize = 100;
  private searchTimeout: any = null;
  private hasSearched = false;
  private hasLoadedAllCiphers = false;
  private allCiphers: CipherView[] = null;
  private notValidatedCollectionId: string[] = [];
  private destroy$ = new Subject<void>();
  private _searchText$ = new BehaviorSubject<string>("");
  private isSearchable: boolean = false;

  get searchText() {
    return this._searchText$.value;
  }
  set searchText(value: string) {
    this._searchText$.next(value);
  }

  constructor(
    private i18nService: I18nService,
    private cipherService: CipherService,
    private router: Router,
    private ngZone: NgZone,
    private broadcasterService: BroadcasterService,
    private changeDetectorRef: ChangeDetectorRef,
    private route: ActivatedRoute,
    private syncService: SyncService,
    private platformUtilsService: PlatformUtilsService,
    private searchService: SearchService,
    private location: Location,
    private cozyClientService: CozyClientService,
    private konnectorService: KonnectorsService,
    private historyService: HistoryService,
    private organizationService: OrganizationService,
    private cryptoService: CryptoService,
    private stateService: StateService,
    private vaultFilterService: VaultFilterService,
    private vaultBrowserStateService: VaultBrowserStateService,
    private dialogService: DialogService,
  ) {
    this.noFolderListSize = 100;
  }

  async ngOnInit() {
    /** Cozy custo : do not use input type=search to use our own cancel cross
    this.searchTypeSearch = !this.platformUtilsService.isSafari();
    */
    this.searchTypeSearch = false;
    /* end custo */
    this.showLeftHeader = !(
      BrowserPopupUtils.inSidebar(window) && this.platformUtilsService.isFirefox()
    );
    await this.vaultBrowserStateService.setBrowserVaultItemsComponentState(null);

    this.broadcasterService.subscribe(ComponentId, (message: any) => {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.ngZone.run(async () => {
        switch (message.command) {
          case "syncCompleted":
            window.setTimeout(() => {
              // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
              // eslint-disable-next-line @typescript-eslint/no-floating-promises
              this.load();
            }, 500);
            break;
          default:
            break;
        }

        this.changeDetectorRef.detectChanges();
      });
    });

    const restoredScopeState = await this.restoreState();
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.queryParams.pipe(first()).subscribe(async (params) => {
      this.state = await this.vaultBrowserStateService.getBrowserGroupingsComponentState();
      if (this.state?.searchText) {
        this.searchText = this.state.searchText;
      } else if (params.searchText) {
        this.searchText = params.searchText;
        this.location.replaceState("vault");
      }

      if (!this.syncService.syncInProgress) {
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.load();
      } else {
        this.loadedTimeout = window.setTimeout(() => {
          if (!this.loaded) {
            // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.load();
          }
        }, 5000);
      }

      if (!this.syncService.syncInProgress || restoredScopeState) {
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        BrowserPopupUtils.setContentScrollY(window, this.state?.scrollY);
      }
    });

    this._searchText$
      .pipe(
        switchMap((searchText) => from(this.searchService.isSearchable(searchText))),
        takeUntil(this.destroy$),
      )
      .subscribe((isSearchable) => {
        this.isSearchable = isSearchable;
      });
  }

  ngOnDestroy() {
    if (this.loadedTimeout != null) {
      window.clearTimeout(this.loadedTimeout);
    }
    if (this.selectedTimeout != null) {
      window.clearTimeout(this.selectedTimeout);
    }
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.saveState();
    this.unloadMnger(); // Cozy custo
    this.broadcasterService.unsubscribe(ComponentId);
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Cozy custo : beforeunload event would be better but is not triggered in webextension...
  // see : https://stackoverflow.com/questions/2315863/does-onbeforeunload-event-trigger-for-popup-html-in-a-google-chrome-extension
  @HostListener("window:unload", ["$event"])
  async unloadMnger(event?: any) {
    // save search state when popup is closed.
    this.historyService.updateQueryParamInHistory("searchText", this.searchText);
  }
  // end custo

  async load() {
    this.vaultFilter = this.vaultFilterService.getVaultFilter();

    this.updateSelectedOrg();
    await this.loadCollectionsAndFolders();
    await this.loadCiphers();

    if (this.showNoFolderCiphers && this.nestedFolders.length > 0) {
      // Remove "No Folder" from folder listing
      this.nestedFolders = this.nestedFolders.slice(0, this.nestedFolders.length - 1);
    }

    this.loaded = true;
  }

  async loadCiphers() {
    this.allCiphers = await this.cipherService.getAllDecrypted();
    if (!this.hasLoadedAllCiphers) {
      this.hasLoadedAllCiphers = !(await this.searchService.isSearchable(this.searchText));
    }
    await this.search(null);
    this.getCounts();
    this.getCipherNumberForCurrentTab();
  }

  async loadCollections() {
    const allCollections = await this.vaultFilterService.buildCollections(
      this.selectedOrganization,
    );
    this.collections = allCollections.fullList;
    /** Cozy custo : modify collections for which the share has not been validated
     * by its owner (and thus can not be decrypted). We also add an isKonnector attribute.
    this.nestedCollections = allCollections.nestedList;
    */
    this.nestedCollections = [];
    const orgs = await this.organizationService.getAll();
    for (const col of allCollections.nestedList) {
      if (col.node.name === "[error: cannot decrypt]") {
        const correspondingOrg = orgs.find((org) => org.id === col.node.organizationId);
        col.node.name = correspondingOrg.name;
        this.notValidatedCollectionId.push(col.node.id);
      }
      const isKonnector = await this.konnectorService.isKonnectorsOrganization(
        col.node.organizationId,
      );

      const colWithKonnector: TreeNode<CollectionViewWithKonnector> = col;
      colWithKonnector.node.isKonnector = isKonnector;

      this.nestedCollections.push(colWithKonnector);
    }
    /** end custo */
  }

  async loadFolders() {
    const allFolders = await firstValueFrom(
      this.vaultFilterService.buildNestedFolders(this.selectedOrganization),
    );
    this.folders = allFolders.fullList;
    this.nestedFolders = allFolders.nestedList;
  }

  async search(timeout: number = null) {
    this.searchPending = false;
    if (this.searchTimeout != null) {
      clearTimeout(this.searchTimeout);
    }
    const filterDeleted = (c: CipherView) => !c.isDeleted;
    if (timeout == null) {
      this.hasSearched = this.isSearchable;
      this.ciphers = await this.searchService.searchCiphers(
        this.searchText,
        filterDeleted,
        this.allCiphers,
      );
      /* commented by Cozy
      this.ciphers = this.ciphers.filter(
        (c) => !this.vaultFilterService.filterCipherForSelectedVault(c),
      );
      */
      return;
    }
    this.searchPending = true;
    this.searchTimeout = setTimeout(async () => {
      this.hasSearched = this.isSearchable;
      if (!this.hasLoadedAllCiphers && !this.hasSearched) {
        await this.loadCiphers();
      } else {
        this.ciphers = await this.searchService.searchCiphers(
          this.searchText,
          filterDeleted,
          this.allCiphers,
        );
      }
      /* commented by Cozy
      this.ciphers = this.ciphers.filter(
        (c) => !this.vaultFilterService.filterCipherForSelectedVault(c),
      );
      */
      this.searchPending = false;
    }, timeout);
  }

  async selectType(type: CipherType) {
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.router.navigate(["/ciphers"], { queryParams: { type: type } });
  }

  async selectFolder(folder: FolderView) {
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.router.navigate(["/ciphers"], { queryParams: { folderId: folder.id || "none" } });
  }

  async selectCollection(collection: CollectionView) {
    /** Cozy custo : if the collection is not yet validated, then display a warning */
    if (this.notValidatedCollectionId.includes(collection.id)) {
      const fingerprint = await this.cryptoService.getFingerprint(
        await this.stateService.getUserId(),
      );
      const desc = `<p class="security-code-desc">
        ${this.i18nService.t("sharingNotAcceptedYetDesc1")}
        </p><p class="security-code">
        ${fingerprint.join("-")}
        </p><p class="security-code-desc">
        ${this.i18nService.t("sharingNotAcceptedYetDesc2")}
        </p>`;
      await this.dialogService.openSimpleDialog({
        title: this.i18nService.t("sharingNotAcceptedYet"),
        content: desc,
        type: "warning",
      });
      return;
    }
    /** end custo */
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.router.navigate(["/ciphers"], { queryParams: { collectionId: collection.id } });
  }

  async selectTrash() {
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.router.navigate(["/ciphers"], { queryParams: { deleted: true } });
  }

  async selectCipher(cipher: CipherView) {
    this.selectedTimeout = window.setTimeout(() => {
      if (!this.preventSelected) {
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.router.navigate(["/view-cipher"], { queryParams: { cipherId: cipher.id } });
      }
      this.preventSelected = false;
    }, 200);
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
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    BrowserApi.createNewTab(cipher.login.launchUri);
    if (BrowserPopupUtils.inPopup(window)) {
      BrowserApi.closePopup(window);
    }
  }

  async addCipher() {
    /** Cozy custo
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.router.navigate(["/add-cipher"], {
      queryParams: { selectedVault: this.vaultFilter.selectedOrganizationId },
    });
    */
    const tab = await BrowserApi.getTabFromCurrentWindow();
    let url = "",
      hostname = "";
    if (tab != null) {
      url = tab.url;
      hostname = Utils.getHostname(url);
    }
    this.router.navigate(["/add-generic"], {
      queryParams: {
        selectedVault: this.vaultFilter.selectedOrganizationId,
        uri: url,
        name: hostname,
      },
    });
    /* end custo */
  }

  async vaultFilterChanged() {
    if (this.showSearching) {
      await this.search();
    }
    this.updateSelectedOrg();
    await this.loadCollectionsAndFolders();
    this.getCounts();
  }

  updateSelectedOrg() {
    this.vaultFilter = this.vaultFilterService.getVaultFilter();
    if (this.vaultFilter.selectedOrganizationId != null) {
      this.selectedOrganization = this.vaultFilter.selectedOrganizationId;
    } else {
      this.selectedOrganization = null;
    }
  }

  getCounts() {
    let favoriteCiphers: CipherView[] = null;
    let noFolderCiphers: CipherView[] = null;
    const folderCounts = new Map<string, number>();
    const collectionCounts = new Map<string, number>();
    const typeCounts = new Map<CipherType, number>();

    this.deletedCount = this.allCiphers.filter(
      (c) => c.isDeleted && !this.vaultFilterService.filterCipherForSelectedVault(c),
    ).length;

    this.ciphers?.forEach((c) => {
      if (!this.vaultFilterService.filterCipherForSelectedVault(c)) {
        if (c.isDeleted) {
          return;
        }
        if (c.favorite) {
          if (favoriteCiphers == null) {
            favoriteCiphers = [];
          }
          favoriteCiphers.push(c);
        }

        if (c.folderId == null) {
          if (noFolderCiphers == null) {
            noFolderCiphers = [];
          }
          noFolderCiphers.push(c);
        }

        if (typeCounts.has(c.type)) {
          typeCounts.set(c.type, typeCounts.get(c.type) + 1);
        } else {
          typeCounts.set(c.type, 1);
        }

        if (folderCounts.has(c.folderId)) {
          folderCounts.set(c.folderId, folderCounts.get(c.folderId) + 1);
        } else {
          folderCounts.set(c.folderId, 1);
        }

        if (c.collectionIds != null) {
          c.collectionIds.forEach((colId) => {
            if (collectionCounts.has(colId)) {
              collectionCounts.set(colId, collectionCounts.get(colId) + 1);
            } else {
              collectionCounts.set(colId, 1);
            }
          });
        }
      }
    });

    this.favoriteCiphers = favoriteCiphers;
    this.noFolderCiphers = noFolderCiphers;
    this.typeCounts = typeCounts;
    this.folderCounts = folderCounts;
    this.collectionCounts = collectionCounts;
  }

  showSearching() {
    return this.hasSearched || (!this.searchPending && this.isSearchable);
  }

  /** Cozy custo : we prefer to escape whereever esc key is stroke */
  @HostListener("window:keydown", ["$event"])
  handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      if (this.searchText == null || this.searchText === "") {
        BrowserApi.closePopup(window);
      } else {
        this.emptySearch();
      }
    }
  }
  /** end custo */

  closeOnEsc(e: KeyboardEvent) {
    /** Cozy custo : we prefer to escape whereever esc key is stroke
    // If input not empty, use browser default behavior of clearing input instead
    if (e.key === "Escape" && (this.searchText == null || this.searchText === "")) {
      BrowserApi.closePopup(window);
    }
    end custo */
  }

  private async loadCollectionsAndFolders() {
    this.showCollections = !this.vaultFilter.myVaultOnly;
    await this.loadFolders();
    await this.loadCollections();
  }

  private async saveState() {
    this.state = Object.assign(new BrowserGroupingsComponentState(), {
      scrollY: BrowserPopupUtils.getContentScrollY(window),
      searchText: this.searchText,
      favoriteCiphers: this.favoriteCiphers,
      noFolderCiphers: this.noFolderCiphers,
      ciphers: this.ciphers,
      collectionCounts: this.collectionCounts,
      folderCounts: this.folderCounts,
      typeCounts: this.typeCounts,
      folders: this.folders,
      collections: this.collections,
      deletedCount: this.deletedCount,
    });
    await this.vaultBrowserStateService.setBrowserGroupingsComponentState(this.state);
  }

  private async restoreState(): Promise<boolean> {
    this.state = await this.vaultBrowserStateService.getBrowserGroupingsComponentState();
    if (this.state == null) {
      return false;
    }

    if (this.state.favoriteCiphers != null) {
      this.favoriteCiphers = this.state.favoriteCiphers;
    }
    if (this.state.noFolderCiphers != null) {
      this.noFolderCiphers = this.state.noFolderCiphers;
    }
    if (this.state.ciphers != null) {
      this.ciphers = this.state.ciphers;
    }
    if (this.state.collectionCounts != null) {
      this.collectionCounts = this.state.collectionCounts;
    }
    if (this.state.folderCounts != null) {
      this.folderCounts = this.state.folderCounts;
    }
    if (this.state.typeCounts != null) {
      this.typeCounts = this.state.typeCounts;
    }
    if (this.state.folders != null) {
      this.folders = this.state.folders;
    }
    if (this.state.collections != null) {
      this.collections = this.state.collections;
    }
    if (this.state.deletedCount != null) {
      this.deletedCount = this.state.deletedCount;
    }

    return true;
  }

  selectCurrent() {
    this.router.navigate(["/tabs/current"]);
    // this.router.navigate(['current'])
  }

  /** Cozy custo */
  emptySearch() {
    this.searchText = "";
    document.getElementById("search").focus();
    this.search(50);
  }

  openWebApp() {
    window.open(this.cozyClientService.getAppURL("passwords", ""));
  }

  back() {
    this.historyService.gotoPreviousUrl();
  }

  async getCipherNumberForCurrentTab() {
    const tab = await BrowserApi.getTabFromCurrentWindow();
    const ciphers = await this.cipherService.getAllDecryptedForUrl(tab?.url);
    this.cipherNumberForCurrentTab = ciphers.length == 0 ? "" : ciphers.length.toString();
  }
  /** end custo */
}
