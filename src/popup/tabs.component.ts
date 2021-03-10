import {
    Component,
    OnInit,
} from '@angular/core';

import { CozyClientService } from './services/cozyClient.service';
import { PopupUtilsService } from './services/popup-utils.service';

@Component({
    selector: 'app-tabs',
    templateUrl: 'tabs.component.html',
})
export class TabsComponent implements OnInit {
    showCurrentTab: boolean = true;
    cozyUrl: string;

    constructor(private popupUtilsService: PopupUtilsService, private cozyClientService: CozyClientService) { }

    ngOnInit() {
        this.showCurrentTab = !this.popupUtilsService.inPopout(window);
        this.cozyUrl = this.cozyClientService.getAppURL('', '');
        console.log(this.cozyUrl);

    }
}
