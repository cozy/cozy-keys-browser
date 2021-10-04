import { Component, Input, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { CozyClientService } from '../../../popup/services/cozyClient.service';

/**
 * A component that renders its children only if the correct flag is set to TRUE
 *
 * usage: <app-flag-conditional flagname="some.flag.name"></app-flag-conditional>
 */
@Component({
    selector: 'app-flag-conditional',
    templateUrl: './flag-conditional.component.html',
    encapsulation: ViewEncapsulation.None,
})
export class FlagConditionalComponent implements OnInit, OnDestroy {
    @Input() flagname: string;

    isFlagEnabled = false;

    private flag: any = undefined;

    constructor(private cozyClientService: CozyClientService) {
        this.flag = this.cozyClientService.getFlagLib();
    }

    ngOnDestroy(): void {
        this.flag.store.removeListener('change', this.flagChanged.bind(this));
    }

    ngOnInit() {
        this.flag.store.on('change', this.flagChanged.bind(this));

        this.flagChanged();
    }

    flagChanged() {
        this.isFlagEnabled = this.flag(this.flagname);
    }
}
