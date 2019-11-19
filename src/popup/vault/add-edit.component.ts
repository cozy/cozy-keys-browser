import { Location } from '@angular/common';
import { Component } from '@angular/core';
import {
    ActivatedRoute,
    Router,
} from '@angular/router';

import { AuditService } from 'jslib/abstractions/audit.service';
import { CipherService } from 'jslib/abstractions/cipher.service';
import { CollectionService } from 'jslib/abstractions/collection.service';
import { EventService } from 'jslib/abstractions/event.service';
import { FolderService } from 'jslib/abstractions/folder.service';
import { I18nService } from 'jslib/abstractions/i18n.service';
import { MessagingService } from 'jslib/abstractions/messaging.service';
import { PlatformUtilsService } from 'jslib/abstractions/platformUtils.service';
import { StateService } from 'jslib/abstractions/state.service';
import { UserService } from 'jslib/abstractions/user.service';

import { AddEditComponent as BaseAddEditComponent } from 'jslib/angular/components/add-edit.component';
import { CipherType } from 'jslib/enums/cipherType';

@Component({
    selector: 'app-vault-add-edit',
    templateUrl: 'add-edit.component.html',
})

/**
 * See the original component:
 * https://github.com/bitwarden/browser/blob/
 * 7bfb8d91e3fcec00424d28410ef33401d582c3cc/src/popup/vault/add-edit.component.ts
 */
export class AddEditComponent extends BaseAddEditComponent {
    typeOptions: any[];

    constructor(cipherService: CipherService, folderService: FolderService,
        i18nService: I18nService, platformUtilsService: PlatformUtilsService,
        auditService: AuditService, stateService: StateService,
        userService: UserService, collectionService: CollectionService,
        messagingService: MessagingService, private route: ActivatedRoute,
        private router: Router, private location: Location,
        eventService: EventService) {
        super(cipherService, folderService, i18nService, platformUtilsService, auditService, stateService,
            userService, collectionService, messagingService, eventService);
        this.typeOptions = [
            { name: i18nService.t('typeLogin'), value: CipherType.Login },
            { name: i18nService.t('typeCard'), value: CipherType.Card },
            { name: i18nService.t('typeIdentity'), value: CipherType.Identity },
        ];
    }

    async ngOnInit() {
        await super.ngOnInit();

        const queryParamsSub = this.route.queryParams.subscribe(async (params) => {
            if (params.cipherId) {
                this.cipherId = params.cipherId;
            }
            if (params.folderId) {
                this.folderId = params.folderId;
            }
            if (params.collectionId) {
                const collection = this.writeableCollections.find((c) => c.id === params.collectionId);
                if (collection != null) {
                    this.collectionIds = [collection.id];
                    this.organizationId = collection.organizationId;
                }
            }
            if (params.type) {
                const type = parseInt(params.type, null);
                this.type = type;
            }
            this.editMode = !params.cipherId;
            await this.load();

            if (!this.editMode) {
                if (params.name && (this.cipher.name == null || this.cipher.name === '')) {
                    this.cipher.name = params.name;
                }
                if (params.uri && (this.cipher.login.uris[0].uri == null || this.cipher.login.uris[0].uri === '')) {
                    this.cipher.login.uris[0].uri = params.uri;
                }
            }
            if (queryParamsSub != null) {
                queryParamsSub.unsubscribe();
            }
        });

        window.setTimeout(() => {
            if (!this.editMode) {
                if (this.cipher.name != null && this.cipher.name !== '') {
                    document.getElementById('loginUsername').focus();
                } else {
                    document.getElementById('name').focus();
                }
            }
        }, 200);
    }

    async submit(): Promise<boolean> {
        if (await super.submit()) {
            this.location.back();
            return true;
        }

        return false;
    }

    cancel() {
        super.cancel();
        this.location.back();
    }

    async generatePassword(): Promise<boolean> {
        const confirmed = await super.generatePassword();
        if (confirmed) {
            this.stateService.save('addEditCipherInfo', {
                cipher: this.cipher,
                collectionIds: this.collections == null ? [] :
                    this.collections.filter((c) => (c as any).checked).map((c) => c.id),
            });
            this.router.navigate(['generator']);
        }
        return confirmed;
    }

    async delete(): Promise<boolean> {
        const confirmed = await super.delete();
        if (confirmed) {
            this.router.navigate(['/tabs/vault']);
        }
        return confirmed;
    }
}
