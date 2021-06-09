import { ToasterService } from 'angular2-toaster';
import {
    Component,
    HostListener,
    OnInit,
} from '@angular/core';

import { I18nService } from 'jslib/abstractions/i18n.service';
import { SyncService } from 'jslib/abstractions/sync.service';

@Component({
    selector: 'app-sync',
    templateUrl: 'sync.component.html',
})
export class SyncComponent implements OnInit {
    lastSync = '--';
    syncPromise: Promise<any>;

    constructor(private syncService: SyncService, private toasterService: ToasterService, private router: Router,
        private i18nService: I18nService) {
    }

    @HostListener('window:keydown', ['$event'])
    handleKeyDown(event: KeyboardEvent) {
        this.router.navigate(['/tabs/settings']);
        event.preventDefault();
    }

    async ngOnInit() {
        await this.setLastSync();
    }

    async sync() {
        this.syncPromise = this.syncService.fullSync(true);
        const success = await this.syncPromise;
        if (success) {
            await this.setLastSync();
            this.toasterService.popAsync('success', null, this.i18nService.t('syncingComplete'));
        } else {
            this.toasterService.popAsync('error', null, this.i18nService.t('syncingFailed'));
        }
    }

    async setLastSync() {
        const last = await this.syncService.getLastSync();
        if (last != null) {
            this.lastSync = last.toLocaleDateString() + ' ' + last.toLocaleTimeString();
        } else {
            this.lastSync = this.i18nService.t('never');
        }
    }
}
