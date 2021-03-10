import {
    Component,
    Input,
    OnInit,
} from '@angular/core';

import { PlatformUtilsService } from 'jslib/abstractions/platformUtils.service';

import { CozyClientService } from '../services/cozyClient.service';
import { PopupUtilsService } from '../services/popup-utils.service';

@Component({
    selector: 'app-pop-out',
    templateUrl: 'pop-out.component.html',
})
export class PopOutComponent implements OnInit {
    @Input() show = true;

    constructor(private platformUtilsService: PlatformUtilsService,
        private popupUtilsService: PopupUtilsService, private cozyClientService: CozyClientService) { }

    ngOnInit() {
        if (this.show) {
            this.show = !this.platformUtilsService.isSafari();
            if (this.show && this.popupUtilsService.inSidebar(window) && this.platformUtilsService.isFirefox()) {
                this.show = false;
            }
        }
    }

    expand() {
        // original Bitwarden instruction :
        // this.popupUtilsService.popOut(window);
        window.open(this.cozyClientService.getAppURL('passwords', ''));
    }
}
