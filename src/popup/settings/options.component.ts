import { BrowserApi } from '../../browser/browserApi';

import {
    Component,
    OnInit,
} from '@angular/core';

import { UriMatchType } from 'jslib/enums/uriMatchType';

import { I18nService } from 'jslib/abstractions/i18n.service';
import { MessagingService } from 'jslib/abstractions/messaging.service';
import { PlatformUtilsService } from 'jslib/abstractions/platformUtils.service';
import { StateService } from 'jslib/abstractions/state.service';
import { StorageService } from 'jslib/abstractions/storage.service';
import { TotpService } from 'jslib/abstractions/totp.service';

import { LocalConstantsService as ConstantsService } from '..//services/constants.service';

@Component({
    selector: 'app-options',
    templateUrl: 'options.component.html',
})
export class OptionsComponent implements OnInit {
    disableFavicon = false;
    disableKonnectorsSuggestions = false;
    enableInPageMenu = true;
    enableAutoFillOnPageLoad = false;
    disableAutoTotpCopy = false;
    disableContextMenuItem = false;
    disableAddLoginNotification = false;
    disableChangedPasswordNotification = false;
    dontShowCards = false;
    dontShowIdentities = false;
    showDisableContextMenu = true;
    showClearClipboard = true;
    theme: string;
    themeOptions: any[];
    defaultUriMatch = UriMatchType.Domain;
    uriMatchOptions: any[];
    clearClipboard: number;
    clearClipboardOptions: any[];

    constructor(private messagingService: MessagingService,
        private platformUtilsService: PlatformUtilsService, private storageService: StorageService,
        private stateService: StateService, private totpService: TotpService,
        i18nService: I18nService) {
        this.themeOptions = [
            { name: i18nService.t('default'), value: null },
            { name: i18nService.t('light'), value: 'light' },
            { name: i18nService.t('dark'), value: 'dark' },
            { name: 'Nord', value: 'nord' },
        ];
        this.uriMatchOptions = [
            { name: i18nService.t('baseDomain'), value: UriMatchType.Domain },
            { name: i18nService.t('host'), value: UriMatchType.Host },
            { name: i18nService.t('startsWith'), value: UriMatchType.StartsWith },
            { name: i18nService.t('regEx'), value: UriMatchType.RegularExpression },
            { name: i18nService.t('exact'), value: UriMatchType.Exact },
            { name: i18nService.t('never'), value: UriMatchType.Never },
        ];
        this.clearClipboardOptions = [
            { name: i18nService.t('never'), value: null },
            { name: i18nService.t('tenSeconds'), value: 10 },
            { name: i18nService.t('twentySeconds'), value: 20 },
            { name: i18nService.t('thirtySeconds'), value: 30 },
            { name: i18nService.t('oneMinute'), value: 60 },
            { name: i18nService.t('twoMinutes'), value: 120 },
            { name: i18nService.t('fiveMinutes'), value: 300 },
        ];
    }

    async ngOnInit() {
        this.showDisableContextMenu = !this.platformUtilsService.isSafari();

        this.disableKonnectorsSuggestions = await this.storageService.get(
            ConstantsService.disableKonnectorsSuggestionsKey,
        );

        this.enableInPageMenu = await this.storageService.get<boolean>(
            ConstantsService.enableInPageMenuKey);
        if (this.enableInPageMenu === null) { // if not yet set, then default to true
            this.enableInPageMenu = true;
        }

        this.enableAutoFillOnPageLoad = await this.storageService.get<boolean>(
            ConstantsService.enableAutoFillOnPageLoadKey);

        this.disableAddLoginNotification = await this.storageService.get<boolean>(
            ConstantsService.disableAddLoginNotificationKey);

        this.disableChangedPasswordNotification = await this.storageService.get<boolean>(
            ConstantsService.disableChangedPasswordNotificationKey);

        this.disableContextMenuItem = await this.storageService.get<boolean>(
            ConstantsService.disableContextMenuItemKey);

        this.dontShowCards = await this.storageService.get<boolean>(ConstantsService.dontShowCardsCurrentTab);
        this.dontShowIdentities = await this.storageService.get<boolean>(ConstantsService.dontShowIdentitiesCurrentTab);

        this.disableAutoTotpCopy = !(await this.totpService.isAutoCopyEnabled());

        this.disableFavicon = await this.storageService.get<boolean>(ConstantsService.disableFaviconKey);

        this.theme = await this.storageService.get<string>(ConstantsService.themeKey);

        const defaultUriMatch = await this.storageService.get<UriMatchType>(ConstantsService.defaultUriMatch);
        this.defaultUriMatch = defaultUriMatch == null ? UriMatchType.Domain : defaultUriMatch;

        this.clearClipboard = await this.storageService.get<number>(ConstantsService.clearClipboardKey);
    }

    async updateAddLoginNotification() {
        await this.storageService.save(ConstantsService.disableAddLoginNotificationKey,
            this.disableAddLoginNotification);
    }

    async updateChangedPasswordNotification() {
        await this.storageService.save(ConstantsService.disableChangedPasswordNotificationKey,
            this.disableChangedPasswordNotification);
    }

    async updateDisableContextMenuItem() {
        await this.storageService.save(ConstantsService.disableContextMenuItemKey,
            this.disableContextMenuItem);
        this.messagingService.send('bgUpdateContextMenu');
    }

    /*
    TODO: enable back when TOTP is available
    async updateAutoTotpCopy() {
        await this.storageService.save(ConstantsService.disableAutoTotpCopyKey, this.disableAutoTotpCopy);
    }
    */

    async updateKonnectorsSuggestions() {
        await this.storageService.save(
            ConstantsService.disableKonnectorsSuggestionsKey,
            this.disableKonnectorsSuggestions,
        );
    }

    async updateEnableInPageMenu() {
        await this.storageService.save(ConstantsService.enableInPageMenuKey, this.enableInPageMenu);
        // activate or deactivate the menu from all tabs
        let subcommand = 'autofilIPMenuActivate';
        if (!this.enableInPageMenu) {
            subcommand = 'inPageMenuDeactivate';
        }
        const allTabs = await BrowserApi.getAllTabs();
        for (const tab of allTabs) {
            BrowserApi.tabSendMessage(tab, {command: 'autofillAnswerRequest', subcommand: subcommand});
        }
    }

    async updateAutoFillOnPageLoad() {
        await this.storageService.save(ConstantsService.enableAutoFillOnPageLoadKey, this.enableAutoFillOnPageLoad);
    }

    async updateDisableFavicon() {
        await this.storageService.save(ConstantsService.disableFaviconKey, this.disableFavicon);
        await this.stateService.save(ConstantsService.disableFaviconKey, this.disableFavicon);
    }

    async updateShowCards() {
        await this.storageService.save(ConstantsService.dontShowCardsCurrentTab, this.dontShowCards);
        await this.stateService.save(ConstantsService.dontShowCardsCurrentTab, this.dontShowCards);
    }

    async updateShowIdentities() {
        await this.storageService.save(ConstantsService.dontShowIdentitiesCurrentTab, this.dontShowIdentities);
        await this.stateService.save(ConstantsService.dontShowIdentitiesCurrentTab, this.dontShowIdentities);
    }

    async saveTheme() {
        await this.storageService.save(ConstantsService.themeKey, this.theme);
        window.setTimeout(() => window.location.reload(), 200);
    }

    async saveDefaultUriMatch() {
        await this.storageService.save(ConstantsService.defaultUriMatch, this.defaultUriMatch);
    }

    async saveClearClipboard() {
        await this.storageService.save(ConstantsService.clearClipboardKey, this.clearClipboard);
    }
}
