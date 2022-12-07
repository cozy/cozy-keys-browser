import { animate, state, style, transition, trigger } from '@angular/animations';
import { Location } from '@angular/common';
import {
    ChangeDetectorRef,
    Component,
    ElementRef,
    HostListener,
    NgZone,
    OnDestroy,
    OnInit,
    ViewChild,
} from '@angular/core';
import {
    ActivatedRoute,
    Router,
} from '@angular/router';

import { first } from 'rxjs/operators';

import { BrowserApi } from '../../browser/browserApi';

import { CipherType } from 'jslib-common/enums/cipherType';
import { UriMatchType } from 'jslib-common/enums/uriMatchType';

import { CipherView } from 'jslib-common/models/view/cipherView';
import { FolderView } from 'jslib-common/models/view/folderView';

import { BroadcasterService } from 'jslib-common/abstractions/broadcaster.service';
import { CipherService } from 'jslib-common/abstractions/cipher.service';
import { CollectionService } from 'jslib-common/abstractions/collection.service';
import { FolderService } from 'jslib-common/abstractions/folder.service';
import { I18nService } from 'jslib-common/abstractions/i18n.service';
import { PlatformUtilsService } from 'jslib-common/abstractions/platformUtils.service';
import { SearchService } from 'jslib-common/abstractions/search.service';
import { StateService } from 'jslib-common/abstractions/state.service';
import { StorageService } from 'jslib-common/abstractions/storage.service';
import { SyncService } from 'jslib-common/abstractions/sync.service';
import { UserService } from 'jslib-common/abstractions/user.service';

import { GroupingsComponent as BaseGroupingsComponent } from 'jslib-angular/components/groupings.component';

import { Utils } from 'jslib-common/misc/utils';

import { AutofillService } from '../../services/abstractions/autofill.service';
import { LocalConstantsService as ConstantsService } from '../services/constants.service';
import { CozyClientService } from '../services/cozyClient.service';
import { KonnectorsService } from '../services/konnectors.service';
import { PopupUtilsService } from '../services/popup-utils.service';

const ComponentId = 'GroupingsComponent';
const ScopeStateId = ComponentId + 'Scope';

const enum PanelNames {
    CurrentPageCiphers = 'currentPageCiphers',
    Cards = 'Card',
    Folder = 'Folder',
    Identities = 'Identity',
    Logins = 'Login',
    None = 'none',
    Search = 'search',
}

@Component({
    selector: 'app-vault-groupings',
    templateUrl: 'groupings.component.html',
    animations: [
        trigger('toggleClick', [
            state('true', style({
                transform: 'translateX(0%)',
            })),
            transition('void => *', animate(
                '0.4s' + ' ease-in-out',
                style({ transform: 'translateX(0%)' }),
            )),
            state('false', style({
                transform: 'translateX(100%)',
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

    get showNoFolderCiphers(): boolean {
        return this.noFolderCiphers != null && this.noFolderCiphers.length < this.noFolderListSize &&
            this.collections.length === 0;
    }

    get folderCount(): number {
        return this.nestedFolders.length - (this.showNoFolderCiphers ? 0 : 1);
    }
    ciphers: CipherView[];
    favoriteCiphers: CipherView[];
    deletedCiphers: CipherView[];
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
    ciphersForCurrentPage: CipherView[] = [];
    selectedFolderTitle: string;
    selectedFolderId: string;
    searchTagClass: string = 'hideSearchTag';
    searchTagText: string;
    enableAnimations: boolean = false;
    currentPannel: PanelNames = PanelNames.None;
    ciphersForFolder: CipherView[] = [];
    isPannelVisible: string = 'false';
    allCiphers: CipherView[] = null;
    isInPopOut: boolean = false;

    @ViewChild('groupingContent') groupingContentEl: ElementRef;
    @ViewChild('searchInput') searchInputEl: ElementRef;

    private loadedTimeout: number;
    private selectedTimeout: number;
    private preventSelected = false;
    private noFolderListSize = 100;
    private searchTimeout: any = null;
    private hasSearched = false;
    private hasLoadedAllCiphers = false;
    private ciphersByType: any;
    private pageDetails: any[] = [];
    private url: string = '';
    private hostname: string = '';

    constructor(collectionService: CollectionService, folderService: FolderService,
        storageService: StorageService, userService: UserService,
        private cipherService: CipherService, private router: Router,
        private ngZone: NgZone, private broadcasterService: BroadcasterService,
        private changeDetectorRef: ChangeDetectorRef, private route: ActivatedRoute,
        private stateService: StateService, private popupUtils: PopupUtilsService,
        private syncService: SyncService, private platformUtilsService: PlatformUtilsService,
        private searchService: SearchService, private location: Location,
        private i18nService: I18nService,
        private autofillService: AutofillService, private konnectorsService: KonnectorsService,
        private cozyClientService: CozyClientService) {
        super(collectionService, folderService, storageService, userService);
        this.noFolderListSize = 100;
        this.isInPopOut = this.popupUtils.inPopout(window);
    }

    @HostListener('window:keydown', ['$event'])
    handleKeyDown(event: KeyboardEvent) {
        if (event.key === 'Escape' && this.currentPannel !== PanelNames.None) {
            this.unActivatePanel();
            event.preventDefault();
        }
    }

    async ngOnInit() {
        // console.log('ngOnInit()', 'isPannelVisible', this.isPannelVisible);
        this.ciphersByType = {};
        this.ciphersByType[CipherType.Card] = [];
        this.ciphersByType[CipherType.Identity] = [];
        this.ciphersByType[CipherType.Login] = [];
        this.searchTypeSearch = !this.platformUtilsService.isSafari();
        this.showLeftHeader = !(this.popupUtils.inSidebar(window) && this.platformUtilsService.isFirefox());
        this.stateService.remove('CiphersComponent');

        setTimeout(() => {
            // Enable panels animations only after a delay so that only user actions triger an animation.
            // when component is initied, if a panel is displayed, we don't want the apparition of the panel
            // to be animated.
            this.enableAnimations = true;
        }, 300);

        this.broadcasterService.subscribe(ComponentId, (message: any) => {
            this.ngZone.run(async () => {
                // console.log('broadcasterService.heard :', message.command);
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

        this.route.queryParams.subscribe(async params => {
            // console.log('groupings.queryParams.heard :', params);
            if (params.activatedPanel) {
                let folderId: string;
                if (params.activatedPanel !== PanelNames.Folder) {
                    this.activatePanel(params.activatedPanel);
                } else {
                    folderId = params.folderId === 'null' ? null : params.folderId ;
                    this.activatePanel(params.activatedPanel, folderId);
                }
                if (params.scrollTopBack) {
                    setTimeout(() => {
                        let scrollTop = 0;
                        if (params.activatedPanel === PanelNames.Search) {
                            this.groupingContentEl.nativeElement.scrollTop = params.scrollTopBack;
                        } else {
                            this.groupingContentEl.nativeElement.querySelector("cdk-virtual-scroll-viewport").scrollTop = params.scrollTopBack;
                        }
                    }, 50);
                }
            } else {
                this.unActivatePanel();
            }
        });

        this.route.queryParams.pipe(first()).subscribe(async params => {
            this.state = (await this.stateService.get<any>(ComponentId)) || {};
            if (this.state.searchText) {
                this.searchText = this.state.searchText;
            } else if (params.searchText) {
                this.searchText = params.searchText;
                this.location.replaceState('vault');
            }
            this.selectedFolderId = params.folderId ? params.folderId : undefined;

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
        // console.log('grouping.component.load()', this.route);
        // request page detail from current tab
        const tab = await BrowserApi.getTabFromCurrentWindow();
        if (tab != null) {
            this.url = tab.url;
            this.hostname = Utils.getHostname(this.url);
        }

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
        if (this.selectedFolderId === 'trash') {
            this.searchTagText  = this.i18nService.t('trash');
            this.selectedFolderTitle = this.searchTagText;
            this.ciphersForFolder = this.deletedCiphers;
        } else if (this.selectedFolderId === 'noneFolder') {
            this.searchTagText  = this.i18nService.t('noneFolder');
            this.selectedFolderTitle = this.searchTagText;
            this.ciphersForFolder = this.noFolderCiphers;
        } else if (this.selectedFolderId !== undefined) {
            this.selectedFolderTitle =
                this.nestedFolders.find( f => f.node.id === this.selectedFolderId ).node.name;
            this.searchTagText  = this.selectedFolderTitle;
            this.ciphersForFolder = this.ciphers.filter( c => c.folderId === this.selectedFolderId);
        }
        super.loaded = true;
    }

    async loadCiphers() {
        // console.log(`loadCiphers()`);

        this.allCiphers = await this.cipherService.getAllDecrypted();
        if (!this.hasLoadedAllCiphers) {
            this.hasLoadedAllCiphers = !this.searchService.isSearchable(this.searchText);
        }
        this.deletedCiphers = this.allCiphers.filter(c => c.isDeleted);
        this.deletedCount = this.deletedCiphers.length;
        await this.search(null);
        let favoriteCiphers: CipherView[] = null;
        let noFolderCiphers: CipherView[] = null;
        const folderCounts = new Map<string, number>();
        const collectionCounts = new Map<string, number>();
        const typeCounts = new Map<CipherType, number>();
        this.ciphers.forEach(c => {
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
                c.collectionIds.forEach(colId => {
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
            if (this.hasSearched) {
                this.activatePanel(PanelNames.Search);
            }

            this.ciphers = await this.searchService.searchCiphers(this.searchText, filterDeleted, this.allCiphers);
            this.sortAllCiphersByType();
            return;
        }
        this.searchPending = true;
        this.searchTimeout = setTimeout(async () => {
            this.hasSearched = this.searchService.isSearchable(this.searchText);
            if (this.hasSearched) {
                this.activatePanel(PanelNames.Search);
            } else {
                this.unActivatePanel();
            }
            if (!this.hasLoadedAllCiphers && !this.hasSearched) {
                await this.loadCiphers();
            } else {
                this.ciphers = await this.searchService.searchCiphers(this.searchText, filterDeleted, this.allCiphers);
                this.sortAllCiphersByType();
            }
            this.searchPending = false;
        }, timeout);
    }

    unActivatePanel() {
        // console.log(`unActivatePanel('${this.currentPannel}')`);
        this.location.go('/tabs/vault');
        switch (this.currentPannel) {
            case PanelNames.None:
                return;
            case PanelNames.Search:
                this.searchText = '';
                this.search(null);
                this.hasSearched = false;
                break;
            default:
                break;
        }
        this.searchTagClass = 'hideSearchTag';
        this.isPannelVisible = 'false';
        this.searchInputEl.nativeElement.focus();
        this.currentPannel = PanelNames.None;
    }

    activatePanel(panelName: string, folderId?: string) {
        // console.log(`activatePanel('${panelName}', '${folderId}')`);
        let folderIdQueryParam: string = '';
        switch (panelName) {
            case PanelNames.CurrentPageCiphers:
                this.searchTagClass = 'showSearchTag';
                this.searchTagText  = this.i18nService.t('forThisWebSite');
                this.currentPannel = PanelNames.CurrentPageCiphers;
                this.isPannelVisible = 'true';
                break;
            case PanelNames.Search:
                this.searchTagClass = 'hideSearchTag';
                this.currentPannel = PanelNames.Search;
                this.isPannelVisible = 'true';
                break;
            case PanelNames.Logins:
                this.searchTagClass = 'showSearchTag';
                this.searchTagText  = this.i18nService.t('logins');
                this.currentPannel = PanelNames.Logins;
                this.isPannelVisible = 'true';
                break;
            case PanelNames.Cards:
                this.searchTagClass = 'showSearchTag';
                this.searchTagText  = this.i18nService.t('cards');
                this.currentPannel = PanelNames.Cards;
                this.isPannelVisible = 'true';
                break;
            case PanelNames.Identities:
                this.searchTagClass = 'showSearchTag';
                this.searchTagText  = this.i18nService.t('identities');
                this.currentPannel = PanelNames.Identities;
                this.isPannelVisible = 'true';
                break;
            case PanelNames.Folder:
                folderIdQueryParam = '&folderId=' + folderId ;
                this.selectedFolderId = folderId;
                this.searchTagClass = 'showSearchTag';
                this.currentPannel = PanelNames.Folder;
                this.isPannelVisible = 'true';
                break;
            default:
                break;
        }
        this.location.go('/tabs/vault?activatedPanel=' + panelName + folderIdQueryParam);
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
        return this.ciphers.filter( c => c.type === type);
    }

    sortAllCiphersByType() {
        this.ciphersByType = {};
        this.ciphersByType[CipherType.Card] = [];
        this.ciphersByType[CipherType.Identity] = [];
        this.ciphersByType[CipherType.Login] = [];
        this.ciphersByType[CipherType.SecureNote] = [];
        for (const c of this.ciphers) {
            this.ciphersByType[c.type].push(c);
        }
    }

    countByType(type: CipherType) {
        return this.typeCounts.get(type);
    }

    async selectType(type: CipherType) {
        super.selectType(type);
        switch (type) {
            case CipherType.Login:
                this.activatePanel(PanelNames.Logins);
                break;
            case CipherType.Card:
                this.activatePanel(PanelNames.Cards);
                break;
            case CipherType.Identity:
                this.activatePanel(PanelNames.Identities);
                break;
            default:
                break;
        }
    }

    async selectFolder(folder: FolderView) {
        // console.log(`selectFolder()`, folder.id);
        this.selectedFolderTitle = folder.name;
        this.searchTagText  = this.selectedFolderTitle;
        this.ciphersForFolder = this.ciphers.filter( c => c.folderId === folder.id);
        this.activatePanel(PanelNames.Folder, folder.id === null ? 'noneFolder' : folder.id );
    }

    async selectTrash() {
        // console.log(`selectTrash()`);
        this.ciphersForFolder = this.deletedCiphers;
        this.selectedFolderTitle = this.i18nService.t('trash');
        this.searchTagText  = this.selectedFolderTitle;
        this.activatePanel(PanelNames.Folder, 'trash');
    }

    async selectCipher(cipher: CipherView) {
        // console.log(`selectCipher()`, this.currentPannel, this.selectedFolderId);
        this.selectedTimeout = window.setTimeout(() => {
            if (!this.preventSelected) {
                this.router.navigate(['/view-cipher'], { queryParams: {
                    cipherId  : cipher.id,
                    pannelBack: this.currentPannel,
                    folderBack : this.selectedFolderId,
                }});
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
        switch (this.currentPannel) {
            case PanelNames.Cards:
                this.addCardCipher();
                break;
            case PanelNames.Identities:
                this.addIdentityCipher();
                break;
            default:
                this.router.navigate(['/add-cipher'], { queryParams: { name: this.hostname, uri: this.url } });
                break;
        }
    }

    closeOnEsc(e: KeyboardEvent) {
        // If input not empty, use browser default behavior of clearing input instead
        if (e.key === 'Escape' && (this.searchText == null || this.searchText === '')) {
            BrowserApi.closePopup(window);
        }
    }

    async addIdentityCipher() {
        this.router.navigate(['/add-cipher'], { queryParams: { type: this.cipherType.Identity } });
    }

    async addCardCipher() {
        this.router.navigate(['/add-cipher'], { queryParams: { type: this.cipherType.Card } });
    }

    showSearchPanel() {
        return this.hasSearched;
    }

    showCurrentPageCiphersPanel() {
        return this.currentPannel === PanelNames.CurrentPageCiphers;
    }

    showLoginsPanel() {
        return this.currentPannel === PanelNames.Logins;
    }

    showCardsPanel() {
        return this.currentPannel === PanelNames.Cards;
    }

    showIdentitiesPanel() {
        return this.currentPannel === PanelNames.Identities;
    }

    showCurrentPagePanel() {
        if (this.currentPannel === PanelNames.CurrentPageCiphers) {
            this.unActivatePanel();
        } else {
            this.activatePanel(PanelNames.CurrentPageCiphers);
        }
    }

    showFolderPanel() {
        return this.currentPannel === PanelNames.Folder;
    }

    async fillCipher(cipher: CipherView) {
        let totpCode = null;

        if (this.pageDetails == null || this.pageDetails.length === 0) {
            this.platformUtilsService.showToast('error', null, this.i18nService.t('autofillError'));
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
                this.platformUtilsService.showToast('error', null, this.i18nService.t('errorOccurred'));
                this.changeDetectorRef.detectChanges();
            });
        }
    }

    async fillOrLaunchCipher(cipher: CipherView) {
        // Get default matching setting for urls
        let defaultMatch = await this.storageService.get<UriMatchType>(ConstantsService.defaultUriMatch);
        if (defaultMatch == null) {
            defaultMatch = UriMatchType.Domain;
        }
        // Get the current url
        const tab = await BrowserApi.getTabFromCurrentWindow();
        const isCipherMatchinghUrl =
            await this.konnectorsService.hasURLMatchingCiphers(tab.url, [cipher], defaultMatch);
        if (isCipherMatchinghUrl) {
            this.fillCipher(cipher);
        } else {
            this.launchCipher(cipher);
        }
    }

    viewCipher(cipher: CipherView) {
        // console.log('viewCipher()', this.currentPannel, this.groupingContentEl.nativeElement.scrollTop);
        let scrollTop = 0;
        if (this.hasSearched) {
            scrollTop = this.groupingContentEl.nativeElement.scrollTop
        } else {
            scrollTop = this.groupingContentEl.nativeElement.querySelector("cdk-virtual-scroll-viewport").scrollTop
        }
        this.router.navigate(['/view-cipher'], { queryParams: {
            cipherId: cipher.id,
            pannelBack: this.currentPannel,
            scrollTopBack : scrollTop,
            folderBack : this.selectedFolderId,
         } });
    }

    openWebApp() {
        let hash = '';
        const noHashPanels = [
            PanelNames.CurrentPageCiphers,
            PanelNames.Search,
            PanelNames.None,
        ];
        if (!noHashPanels.includes(this.currentPannel)) {
            hash = '#/vault?action=view&type=' + this.cipherType[this.currentPannel as any];
        }
        window.open(this.cozyClientService.getAppURL('passwords', hash));
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
