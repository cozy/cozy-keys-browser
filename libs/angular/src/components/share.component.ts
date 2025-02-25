import { Directive, EventEmitter, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { firstValueFrom, map, Observable, Subject, takeUntil } from "rxjs";

import { CollectionService, CollectionView } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationUserStatusType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { Checkable } from "@bitwarden/common/types/checkable";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

@Directive()
export class ShareComponent implements OnInit, OnDestroy {
  @Input() cipherId: string;
  @Input() organizationId: string;
  @Output() onSharedCipher = new EventEmitter();

  formPromise: Promise<void>;
  cipher: CipherView;
  collections: Checkable<CollectionView>[] = [];
  organizations$: Observable<Organization[]>;
  selectedCollectionId: string = undefined;

  protected writeableCollections: Checkable<CollectionView>[] = [];

  private _destroy = new Subject<void>();

  constructor(
    protected collectionService: CollectionService,
    protected platformUtilsService: PlatformUtilsService,
    protected i18nService: I18nService,
    protected cipherService: CipherService,
    private logService: LogService,
    protected organizationService: OrganizationService,
    protected accountService: AccountService,
  ) {}

  async ngOnInit() {
    await this.load();
  }

  ngOnDestroy(): void {
    this._destroy.next();
    this._destroy.complete();
  }

  async load() {
    const allCollections = await this.collectionService.getAllDecrypted();
    this.writeableCollections = allCollections.map((c) => c).filter((c) => !c.readOnly);

    this.organizations$ = this.organizationService.memberOrganizations$.pipe(
      map((orgs) => {
        return orgs
          .filter((o) => o.enabled && o.status === OrganizationUserStatusType.Confirmed)
          .sort(Utils.getSortFunction(this.i18nService, "name"));
      }),
    );

    this.organizations$.pipe(takeUntil(this._destroy)).subscribe((orgs) => {
      if (this.organizationId == null && orgs.length > 0) {
        this.organizationId = orgs[0].id;
        this.filterCollections();
      }
    });

    const cipherDomain = await this.cipherService.get(this.cipherId);
    const activeUserId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a) => a?.id)),
    );
    this.cipher = await cipherDomain.decrypt(
      await this.cipherService.getKeyForCipherKeyDecryption(cipherDomain, activeUserId),
    );

    this.filterCollections();
    /* Cozy custo : initialize selected item on the current collection of the cipher */
    if (this.cipher.organizationId) {
      this.selectedCollectionId = this.collections.find(
        (col) => col.organizationId === this.cipher.organizationId,
      )?.id;
    } else {
      this.selectedCollectionId = "";
    }
    /* end custo */
  }

  filterCollections() {
    this.writeableCollections.forEach((c) => (c.checked = false));
    if (this.organizationId == null || this.writeableCollections.length === 0) {
      this.collections = [];
    } else {
      /** Cozy custo :
       * i) no need to filter collections since in Cozy
       * a user can move a cipher to any organization (= folder)
       * ii) but we have to filter collections not decrypted (what happens when the sharing is not validated)
      this.collections = this.writeableCollections.filter(
        (c) => c.organizationId === this.organizationId,
      );
      */
      this.collections = this.writeableCollections.filter(
        (c) => c.name !== "[error: cannot decrypt]",
      );
      /** end custo */
    }
  }

  async submit(): Promise<boolean> {
    /** Cozy custo
    const selectedCollectionIds = this.collections.filter(isChecked).map((c) => c.id);
    if (selectedCollectionIds.length === 0) {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("selectOneCollection"),
      );
      return;
    }
    */
    const selectedCollection = this.collections.filter((c) => !!(c as any).checked);
    if (selectedCollection.length !== 1) {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("selectOneFolder"),
      );
      return;
    }

    const organizationId = selectedCollection[0].organizationId;
    const selectedCollectionIds = selectedCollection.map((c) => c.id);
    /** end custo */

    const cipherDomain = await this.cipherService.get(this.cipherId);
    const activeUserId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a) => a?.id)),
    );
    const cipherView = await cipherDomain.decrypt(
      await this.cipherService.getKeyForCipherKeyDecryption(cipherDomain, activeUserId),
    );
    /** Cozy custo
    const orgs = await firstValueFrom(this.organizations$);
    const orgName =
      orgs.find((o) => o.id === this.organizationId)?.name ?? this.i18nService.t("organization");
    */

    try {
      this.formPromise = this.cipherService
        .shareWithServer(cipherView, organizationId, selectedCollectionIds, activeUserId)
        .then(async () => {
          this.onSharedCipher.emit();
          this.platformUtilsService.showToast(
            "success",
            null,
            // this.i18nService.t("movedItemToOrg", cipherView.name, orgName), // Cozy custo
            this.i18nService.t("movedItemToFolder"),
          );
        });
      await this.formPromise;
      return true;
    } catch (e) {
      this.logService.error(e);
    }
    return false;
  }

  get canSave() {
    if (this.collections != null) {
      for (let i = 0; i < this.collections.length; i++) {
        if (this.collections[i].checked) {
          return true;
        }
      }
    }
    return false;
  }

  /** Cozy custo */
  onSelectedCollectionChange() {
    this.collections.forEach((collection) => {
      (collection as any).checked = this.selectedCollectionId === collection.id;
    });
  }
  /** end custo */
}
