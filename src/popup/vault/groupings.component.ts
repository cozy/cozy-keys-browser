import { ToasterService } from 'angular2-toaster';

import { animate, state, style, transition, trigger } from '@angular/animations';
import { Location } from '@angular/common';
import {
    ChangeDetectorRef,
    Component,
    NgZone,
    OnDestroy,
    OnInit,
} from '@angular/core';
import {
    ActivatedRoute,
    Router,
} from '@angular/router';

import { BrowserApi } from '../../browser/browserApi';

import { CipherType } from 'jslib/enums/cipherType';
import { UriMatchType } from 'jslib/enums/uriMatchType';

import { CipherView } from 'jslib/models/view/cipherView';
// import { CollectionView } from 'jslib/models/view/collectionView';
import { FolderView } from 'jslib/models/view/folderView';

import { CipherService } from 'jslib/abstractions/cipher.service';
import { CollectionService } from 'jslib/abstractions/collection.service';
import { FolderService } from 'jslib/abstractions/folder.service';
import { I18nService } from 'jslib/abstractions/i18n.service';
import { PlatformUtilsService } from 'jslib/abstractions/platformUtils.service';
import { SearchService } from 'jslib/abstractions/search.service';
import { StateService } from 'jslib/abstractions/state.service';
import { StorageService } from 'jslib/abstractions/storage.service';
import { SyncService } from 'jslib/abstractions/sync.service';
import { UserService } from 'jslib/abstractions/user.service';

import { BroadcasterService } from 'jslib/angular/services/broadcaster.service';

import { GroupingsComponent as BaseGroupingsComponent } from 'jslib/angular/components/groupings.component';

import { AutofillService } from '../../services/abstractions/autofill.service';
import { LocalConstantsService as ConstantsService } from '../services/constants.service';
import { KonnectorsService } from '../services/konnectors.service';
import { PopupUtilsService } from '../services/popup-utils.service';

const ComponentId = 'GroupingsComponent';
const ScopeStateId = ComponentId + 'Scope';

@Component({
    selector: 'app-vault-groupings',
    templateUrl: 'groupings.component.html',
    animations: [
        trigger('toggleClick', [
            state('true', style({
                transform: 'translateX(0%)',
                boxShadow: '0 3px 2px -2px gray',
            })),
            transition('void => *', animate(
                '0.4s' + ' ease-in-out',
                style({ transform: 'translateX(0%)' }),
            )),
            state('false', style({
                transform: 'translateX(100%)',
                boxShadow: '0 3px 2px -2px gray',
            })),
            transition('* => void', animate(
                '0.4s' + ' ease-in-out',
                style({ transform: 'translateX(100%)' }),
            )),
        ]),
    ],
})

/**
 *  See the original component:
 *
 *  https://github.com/bitwarden/browser/blob/
 *  0bbe17f6e2becdf5146677d51cbc71cc099aaec9/src/popup/vault/groupings.component.ts
 */
export class GroupingsComponent extends BaseGroupingsComponent implements OnInit, OnDestroy {
    ciphers: CipherView[];
    favoriteCiphers: CipherView[];
    noFolderCiphers: CipherView[];
    folderCounts = new Map<string, number>();
    collectionCounts = new Map<string, number>();
    typeCounts = new Map<CipherType, number>();
    searchText: string;
    state: any;
    scopeState: any;
    showLeftHeader = true;
    searchPending = false;
    searchTypeSearch = false;
    deletedCount = 0;
    displayCurrentPageCiphersMode: boolean = false;
    displayCiphersListsMode: boolean = true;
    ciphersForCurrentPage: CipherView[] = [];
    searchTagClass: string = 'hideSearchTag';

    private loadedTimeout: number;
    private selectedTimeout: number;
    private preventSelected = false;
    private noFolderListSize = 100;
    private searchTimeout: any = null;
    private hasSearched = false;
    private hasLoadedAllCiphers = false;
    private allCiphers: CipherView[] = null;
    private ciphersByType: any;
    private pageDetails: any[] = [];
    private isPannelVisible: string = 'false';

    constructor(collectionService: CollectionService, folderService: FolderService,
        storageService: StorageService, userService: UserService,
        private cipherService: CipherService, private router: Router,
        private ngZone: NgZone, private broadcasterService: BroadcasterService,
        private changeDetectorRef: ChangeDetectorRef, private route: ActivatedRoute,
        private stateService: StateService, private popupUtils: PopupUtilsService,
        private syncService: SyncService,
        private platformUtilsService: PlatformUtilsService, private searchService: SearchService,
        private location: Location, private toasterService: ToasterService, private i18nService: I18nService,
        private autofillService: AutofillService, private konnectorsService: KonnectorsService) {
        super(collectionService, folderService, storageService, userService);
        this.noFolderListSize = 100;
    }

    get showNoFolderCiphers(): boolean {
        return this.noFolderCiphers != null && this.noFolderCiphers.length < this.noFolderListSize &&
            this.collections.length === 0;
    }

    get folderCount(): number {
        return this.nestedFolders.length - (this.showNoFolderCiphers ? 0 : 1);
    }

    toggleIsCorrect() {
        console.log('toggleIsCorrect()', this.isPannelVisible);
        this.isPannelVisible = this.isPannelVisible === 'true' ? 'false' : 'true'; // change in data-bound value
    }

    async ngOnInit() {
        console.log('ngOnInit()');
        this.ciphersByType = {};
        this.ciphersByType[CipherType.Card] = [];
        this.ciphersByType[CipherType.Identity] = [];
        this.ciphersByType[CipherType.Login] = [];
        this.searchTypeSearch = !this.platformUtilsService.isSafari();
        this.showLeftHeader = !this.platformUtilsService.isSafari() &&
            !(this.popupUtils.inSidebar(window) && this.platformUtilsService.isFirefox());
        this.stateService.remove('CiphersComponent');

        this.broadcasterService.subscribe(ComponentId, (message: any) => {
            this.ngZone.run(async () => {
                switch (message.command) {
                    case 'syncCompleted':
                        window.setTimeout(() => {
                            this.load();
                        }, 500);
                        break;
                    case 'collectPageDetailsResponse':
                        if (message.sender === ComponentId) {
                            this.pageDetails.push({
                                frameId: message.webExtSender.frameId,
                                tab: message.tab,
                                details: message.details,
                            });
                        }
                        break;
                    default:
                        break;
                }
                this.changeDetectorRef.detectChanges();
            });
        });

        const restoredScopeState = await this.restoreState();

        const fragmentSub = this.route.fragment.subscribe(async (fragment) => {
            if (fragment === 'isFilteredForPage') {
                this.searchTagClass = 'showSearchTag';
                this.displayCurrentPageCiphersMode = true;
                this.displayCiphersListsMode = false;
            } else {
                this.searchTagClass = 'hideSearchTag';
                this.displayCurrentPageCiphersMode = false;
                this.displayCiphersListsMode = true;
            }
        });

        const queryParamsSub = this.route.queryParams.subscribe(async (params) => {
            this.state = (await this.stateService.get<any>(ComponentId)) || {};
            if (this.state.searchText) {
                this.searchText = this.state.searchText;
            } else if (params.searchText) {
                this.searchText = params.searchText;
                this.location.replaceState('vault');
            }

            if (!this.syncService.syncInProgress) {
                this.load();
            } else {
                this.loadedTimeout = window.setTimeout(() => {
                    if (!this.loaded) {
                        this.load();
                    }
                }, 5000);
            }

            if (!this.syncService.syncInProgress || restoredScopeState) {
                window.setTimeout(() => this.popupUtils.setContentScrollY(window, this.state.scrollY), 0);
            }
            if (queryParamsSub != null) {
                queryParamsSub.unsubscribe();
            }
        });
    }

    ngOnDestroy() {
        if (this.loadedTimeout != null) {
            window.clearTimeout(this.loadedTimeout);
        }
        if (this.selectedTimeout != null) {
            window.clearTimeout(this.selectedTimeout);
        }
        this.saveState();
        this.broadcasterService.unsubscribe(ComponentId);
    }

    async load() {
        console.log('grouping.component.load()', this.route);
        // request page detail from current tab
        const tab = await BrowserApi.getTabFromCurrentWindow();
        this.pageDetails = [];
        BrowserApi.tabSendMessage(tab, {
            command: 'collectPageDetails',
            tab: tab,
            sender: ComponentId,
        });
        // rest of loading
        await super.load(false);
        await this.loadCiphers();
        if (this.showNoFolderCiphers && this.nestedFolders.length > 0) {
            // Remove "No Folder" from folder listing
            this.nestedFolders = this.nestedFolders.slice(0, this.nestedFolders.length - 1);
        }
        await this.getCiphersForCurrentPage();

        super.loaded = true;
    }

    // async loadCiphers() {
    //     this.allCiphers = await this.cipherService.getAllDecrypted();
    //     this.deletedCount = this.allCiphers.filter((c) => c.isDeleted).length;
    //     await this.search(null);
    //     const typeCounts = new Map<CipherType, number>();
    //     this.ciphers.forEach((c) => {
    //         if (c.isDeleted) {
    //             return;
    //         }
    //         if (typeCounts.has(c.type)) {
    //             typeCounts.set(c.type, typeCounts.get(c.type) + 1);
    //         } else {
    //             typeCounts.set(c.type, 1);
    //         }
    //     });
    //     this.ciphersByType = {};
    //     this.ciphersByType[CipherType.Card] = this._ciphersByType(CipherType.Card);
    //     this.ciphersByType[CipherType.Identity] = this._ciphersByType(CipherType.Identity);
    //     this.ciphersByType[CipherType.Login] = this._ciphersByType(CipherType.Login);
    //
    //     this.typeCounts = typeCounts;
    // }

    async loadCiphers() {
        this.allCiphers = await this.cipherService.getAllDecrypted();
        if (!this.hasLoadedAllCiphers) {
            this.hasLoadedAllCiphers = !this.searchService.isSearchable(this.searchText);
        }
        this.deletedCount = this.allCiphers.filter((c) => c.isDeleted).length;
        await this.search(null);
        let favoriteCiphers: CipherView[] = null;
        let noFolderCiphers: CipherView[] = null;
        const folderCounts = new Map<string, number>();
        const collectionCounts = new Map<string, number>();
        const typeCounts = new Map<CipherType, number>();
        this.ciphers.forEach((c) => {
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
        });
        this.ciphersByType = {};
        this.ciphersByType[CipherType.Card] = this._ciphersByType(CipherType.Card);
        this.ciphersByType[CipherType.Identity] = this._ciphersByType(CipherType.Identity);
        this.ciphersByType[CipherType.Login] = this._ciphersByType(CipherType.Login);

        this.favoriteCiphers = favoriteCiphers;
        this.noFolderCiphers = noFolderCiphers;
        this.typeCounts = typeCounts;
        this.folderCounts = folderCounts;
        this.collectionCounts = collectionCounts;
    }

    async search(timeout: number = null) {
        this.searchPending = false;
        if (this.searchTimeout != null) {
            window.clearTimeout(this.searchTimeout);
        }
        const filterDeleted = (c: CipherView) => !c.isDeleted;
        if (timeout == null) {
            this.hasSearched = this.searchService.isSearchable(this.searchText);
            this.ciphers = await this.searchService.searchCiphers(this.searchText, filterDeleted, this.allCiphers);
            return;
        }
        this.searchPending = true;
        this.searchTimeout = setTimeout(async () => {
            this.hasSearched = this.searchService.isSearchable(this.searchText);
            if (!this.hasLoadedAllCiphers && !this.hasSearched) {
                await this.loadCiphers();
            } else {
                this.ciphers = await this.searchService.searchCiphers(this.searchText, filterDeleted, this.allCiphers);
            }
            this.searchPending = false;
        }, timeout);
    }

    emptySearch() {
        this.searchText = '';
        this.hasSearched = false;
    }

    searchWrapper(timeout: number = null) {
        this.switchToCiphersListsMode();
        this.search(timeout);
    }

    switchToCiphersListsMode() {
        if (!this.displayCiphersListsMode) {
            this.router.navigate([], {
                relativeTo: this.route,
                fragment: '',
            });
        }
    }

    async getCiphersForCurrentPage(): Promise<any[]> {
        // console.log('getCiphersForCurrentPage()');
        const tab = await BrowserApi.getTabFromCurrentWindow();
        if (tab == null) { return []; }
        let ciphersForCurrentPage = await this.cipherService.getAllDecryptedForUrl(tab.url, null);
        ciphersForCurrentPage = ciphersForCurrentPage.sort((a, b): number => {
            return this.cipherService.sortCiphersByLastUsedThenName(a, b);
        });
        this.ciphersForCurrentPage = ciphersForCurrentPage;
    }

    _ciphersByType(type: CipherType) {
        return this.ciphers.filter((c) => c.type === type);
    }

    countByType(type: CipherType) {
        return this.typeCounts.get(type);
    }

    async selectType(type: CipherType) {
        super.selectType(type);
        this.router.navigate(['/ciphers'], { queryParams: { type: type } });
    }

    async selectFolder(folder: FolderView) {
        super.selectFolder(folder);
        this.router.navigate(['/ciphers'], { queryParams: { folderId: folder.id || 'none' } });
    }

    async selectTrash() {
        super.selectTrash();
        this.router.navigate(['/ciphers'], { queryParams: { deleted: true } });
    }

    async selectCipher(cipher: CipherView) {
        this.selectedTimeout = window.setTimeout(() => {
            if (!this.preventSelected) {
                this.router.navigate(['/view-cipher'], { queryParams: { cipherId: cipher.id } });
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
        BrowserApi.createNewTab(cipher.login.launchUri);
        if (this.popupUtils.inPopup(window)) {
            BrowserApi.closePopup(window);
        }
    }

    async addCipher() {
        this.router.navigate(['/add-cipher']);
    }

    showSearching() {
        const shouldBeVisible: boolean =
            this.hasSearched ||
            (!this.searchPending && this.searchService.isSearchable(this.searchText));
        const shouldBeVisibleStr: string = shouldBeVisible ? 'true' : 'false';
        console.log('showSearching()', shouldBeVisible);
        if (shouldBeVisibleStr !== this.isPannelVisible) {
            console.log('  shouldBeVisible has changed', shouldBeVisibleStr, this.isPannelVisible );
            this.isPannelVisible = shouldBeVisibleStr;
        }
        // return true;
        return shouldBeVisible;
    }

    async fillCipher(cipher: CipherView) {
        let totpCode = null;

        if (this.pageDetails == null || this.pageDetails.length === 0) {
            this.toasterService.popAsync('error', null, this.i18nService.t('autofillError'));
            return;
        }

        try {
            totpCode = await this.autofillService.doAutoFill({
                cipher: cipher,
                pageDetails: this.pageDetails,
                doc: window.document,
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
                this.toasterService.popAsync('error', null, this.i18nService.t('autofillError'));
                this.changeDetectorRef.detectChanges();
            });
        }
    }

    async fillOrLaunchCipher(cipher: CipherView) {
        console.log('fillOrLaunchCipher()');

        // Get default matching setting for urls
        let defaultMatch = await this.storageService.get<UriMatchType>(ConstantsService.defaultUriMatch);
        if (defaultMatch == null) {
            defaultMatch = UriMatchType.Domain;
        }
        // Get the current url
        const tab = await BrowserApi.getTabFromCurrentWindow();
        const isCipherMatcinghUrl = await this.konnectorsService.hasURLMatchingCiphers(tab.url, [cipher], defaultMatch);
        if (isCipherMatcinghUrl) {
            this.fillCipher(cipher);
        } else {
            this.launchCipher(cipher);
        }
    }

    viewCipher(cipher: CipherView) {
        this.router.navigate(['/view-cipher'], { queryParams: { cipherId: cipher.id } });
    }

    private async saveState() {
        this.state = {
            scrollY: this.popupUtils.getContentScrollY(window),
            searchText: this.searchText,
        };
        await this.stateService.save(ComponentId, this.state);

        this.scopeState = {
            ciphers: this.ciphers,
            typeCounts: this.typeCounts,
            deletedCount: this.deletedCount,
        };
        await this.stateService.save(ScopeStateId, this.scopeState);
    }

    private async restoreState(): Promise<boolean> {
        this.scopeState = await this.stateService.get<any>(ScopeStateId);
        if (this.scopeState == null) {
            return false;
        }

        if (this.scopeState.ciphers != null) {
            this.ciphers = this.scopeState.ciphers;
        }
        if (this.scopeState.typeCounts != null) {
            this.typeCounts = this.scopeState.typeCounts;
        }
        if (this.scopeState.deletedCiphers != null) {
            this.deletedCount = this.scopeState.deletedCount;
        }

        if (this.scopeState.deletedCiphers != null) {
            this.deletedCount = this.scopeState.deletedCount;
        }

        return true;
    }

}
