import Swal from 'sweetalert2/src/sweetalert2.js';

import {
    Component,
    ElementRef,
    OnInit,
    ViewChild,
} from '@angular/core';
import { Router } from '@angular/router';

import { BrowserApi } from '../../browser/browserApi';

import { DeviceType } from 'jslib/enums/deviceType';

import { ConstantsService } from 'jslib/services/constants.service';

import { CryptoService } from 'jslib/abstractions/crypto.service';
import { EnvironmentService } from 'jslib/abstractions/environment.service';
import { I18nService } from 'jslib/abstractions/i18n.service';
import { MessagingService } from 'jslib/abstractions/messaging.service';
import { PlatformUtilsService } from 'jslib/abstractions/platformUtils.service';
import { StorageService } from 'jslib/abstractions/storage.service';
import { UserService } from 'jslib/abstractions/user.service';
import { VaultTimeoutService } from 'jslib/abstractions/vaultTimeout.service';
import { PopupUtilsService } from '../services/popup-utils.service';
import { CozyClientService } from '../services/cozyClient.service';

// TODO: Add Safari URL when published
const RateUrls = {
    [DeviceType.ChromeExtension]:
        'https://chrome.google.com/webstore/detail/cozy-personal-cloud/jplochopoaajoochpoccajmgelpfbbic/reviews',
    [DeviceType.FirefoxExtension]:
        'https://addons.mozilla.org/en-US/firefox/addon/cozy-personal-cloud/reviews',
};

@Component({
    selector: 'app-settings',
    templateUrl: 'settings.component.html',
})

/**
 * See the original component:
 * https://github.com/bitwarden/browser/blob/
 * 60f6863e4f96fbf8d012e5691e4e2cc5f18ac7a8/src/popup/settings/settings.component.ts
 */
export class SettingsComponent implements OnInit {
    @ViewChild('vaultTimeoutSelect', { read: ElementRef, static: true }) vaultTimeoutSelectRef: ElementRef;
    @ViewChild('vaultTimeoutActionSelect', { read: ElementRef, static: true }) vaultTimeoutActionSelectRef: ElementRef;
    vaultTimeouts: any[];
    vaultTimeout: number = null;
    vaultTimeoutActions: any[];
    vaultTimeoutAction: string;
    pin: boolean = null;
    supportsBiometric: boolean;
    biometric: boolean = false;
    previousVaultTimeout: number = null;

    constructor(private platformUtilsService: PlatformUtilsService, private i18nService: I18nService,
        private vaultTimeoutService: VaultTimeoutService, private storageService: StorageService,
        public messagingService: MessagingService, private router: Router,
        private environmentService: EnvironmentService, private cryptoService: CryptoService,
        private userService: UserService, private popupUtilsService: PopupUtilsService,
        private cozyClientService: CozyClientService) {
    }

    async ngOnInit() {
        const showOnLocked = !this.platformUtilsService.isFirefox() && !this.platformUtilsService.isSafari();

        this.vaultTimeouts = [
            { name: this.i18nService.t('immediately'), value: 0 },
            { name: this.i18nService.t('oneMinute'), value: 1 },
            { name: this.i18nService.t('fiveMinutes'), value: 5 },
            { name: this.i18nService.t('fifteenMinutes'), value: 15 },
            { name: this.i18nService.t('thirtyMinutes'), value: 30 },
            { name: this.i18nService.t('oneHour'), value: 60 },
            { name: this.i18nService.t('fourHours'), value: 240 },
            // { name: i18nService.t('onIdle'), value: -4 },
            // { name: i18nService.t('onSleep'), value: -3 },
        ];

        if (showOnLocked) {
            this.vaultTimeouts.push({ name: this.i18nService.t('onLocked'), value: -2 });
        }

        this.vaultTimeouts.push({ name: this.i18nService.t('onRestart'), value: -1 });
        this.vaultTimeouts.push({ name: this.i18nService.t('never'), value: null });

        this.vaultTimeoutActions = [
            { name: this.i18nService.t('lock'), value: 'lock' },
            { name: this.i18nService.t('logOut'), value: 'logOut' },
        ];

        let timeout = await this.storageService.get<number>(ConstantsService.vaultTimeoutKey);
        if (timeout != null) {
            if (timeout === -2 && !showOnLocked) {
                timeout = -1;
            }
            this.vaultTimeout = timeout;
        }
        this.previousVaultTimeout = this.vaultTimeout;
        const action = await this.storageService.get<string>(ConstantsService.vaultTimeoutActionKey);
        this.vaultTimeoutAction = action == null ? 'lock' : action;

        const pinSet = await this.vaultTimeoutService.isPinLockSet();
        this.pin = pinSet[0] || pinSet[1];

        this.supportsBiometric = await this.platformUtilsService.supportsBiometric();
        this.biometric = await this.vaultTimeoutService.isBiometricLockSet();
    }

    async saveVaultTimeout(newValue: number) {
        if (newValue == null) {
            const confirmed = await this.platformUtilsService.showDialog(
                this.i18nService.t('neverLockWarning'), null,
                this.i18nService.t('yes'), this.i18nService.t('cancel'), 'warning');
            if (!confirmed) {
                this.vaultTimeouts.forEach((option: any, i) => {
                    if (option.value === this.vaultTimeout) {
                        this.vaultTimeoutSelectRef.nativeElement.value = i + ': ' + this.vaultTimeout;
                    }
                });
                return;
            }
        }
        this.previousVaultTimeout = this.vaultTimeout;
        this.vaultTimeout = newValue;
        await this.vaultTimeoutService.setVaultTimeoutOptions(this.vaultTimeout != null ? this.vaultTimeout : null,
            this.vaultTimeoutAction);
        if (this.previousVaultTimeout == null) {
            this.messagingService.send('bgReseedStorage');
        }
    }

    async saveVaultTimeoutAction(newValue: string) {
        if (newValue === 'logOut') {
            const confirmed = await this.platformUtilsService.showDialog(
                this.i18nService.t('vaultTimeoutLogOutConfirmation'),
                this.i18nService.t('vaultTimeoutLogOutConfirmationTitle'),
                this.i18nService.t('yes'), this.i18nService.t('cancel'), 'warning');
            if (!confirmed) {
                this.vaultTimeoutActions.forEach((option: any, i) => {
                    if (option.value === this.vaultTimeoutAction) {
                        this.vaultTimeoutActionSelectRef.nativeElement.value = i + ': ' + this.vaultTimeoutAction;
                    }
                });
                return;
            }
        }
        this.vaultTimeoutAction = newValue;
        await this.vaultTimeoutService.setVaultTimeoutOptions(this.vaultTimeout != null ? this.vaultTimeout : null,
            this.vaultTimeoutAction);
    }

    async updatePin() {
        if (this.pin) {
            const div = document.createElement('div');
            const label = document.createElement('label');
            label.className = 'checkbox';
            const checkboxText = document.createElement('span');
            const restartText = document.createTextNode(this.i18nService.t('lockWithMasterPassOnRestart'));
            checkboxText.appendChild(restartText);
            label.innerHTML = '<input type="checkbox" id="master-pass-restart" checked>';
            label.appendChild(checkboxText);

            div.innerHTML =
                `<div class="swal2-text">${this.i18nService.t('setYourPinCode')}</div>` +
                '<input type="text" class="swal2-input" id="pin-val" autocomplete="off" ' +
                'autocapitalize="none" autocorrect="none" spellcheck="false" inputmode="verbatim">';

            (div.querySelector('#pin-val') as HTMLInputElement).placeholder = this.i18nService.t('pin');
            div.appendChild(label);

            div.querySelector('input').addEventListener('keydown', (event) => {
                if (event.key === 'Enter') { Swal.clickConfirm(); }
            });

            const submitted = await Swal.fire({
                heightAuto: false,
                buttonsStyling: false,
                html: div,
                showCancelButton: true,
                cancelButtonText: this.i18nService.t('cancel'),
                showConfirmButton: true,
                confirmButtonText: this.i18nService.t('submit'),
                focusConfirm: false,
            });

            let pin: string = null;
            let masterPassOnRestart: boolean = null;
            if (submitted.value) {
                pin = (document.getElementById('pin-val') as HTMLInputElement).value;
                masterPassOnRestart = (document.getElementById('master-pass-restart') as HTMLInputElement).checked;
            }
            if (pin != null && pin.trim() !== '') {
                const kdf = await this.userService.getKdf();
                const kdfIterations = await this.userService.getKdfIterations();
                const email = await this.userService.getEmail();
                const pinKey = await this.cryptoService.makePinKey(pin, email, kdf, kdfIterations);
                const key = await this.cryptoService.getKey();
                const pinProtectedKey = await this.cryptoService.encrypt(key.key, pinKey);
                if (masterPassOnRestart) {
                    const encPin = await this.cryptoService.encrypt(pin);
                    await this.storageService.save(ConstantsService.protectedPin, encPin.encryptedString);
                    this.vaultTimeoutService.pinProtectedKey = pinProtectedKey;
                } else {
                    await this.storageService.save(ConstantsService.pinProtectedKey, pinProtectedKey.encryptedString);
                }
            } else {
                this.pin = false;
            }
        }
        if (!this.pin) {
            await this.cryptoService.clearPinProtectedKey();
            await this.vaultTimeoutService.clear();
        }
    }

    async updateBiometric() {
        if (this.biometric && this.supportsBiometric) {

            let granted;
            try {
                granted = await BrowserApi.requestPermission({ permissions: ['nativeMessaging'] });
            } catch (e) {
                // tslint:disable-next-line
                console.error(e);

                if (this.platformUtilsService.isFirefox() && this.popupUtilsService.inSidebar(window)) {
                    await this.platformUtilsService.showDialog(
                        this.i18nService.t('nativeMessaginPermissionSidebarDesc'), this.i18nService.t('nativeMessaginPermissionSidebarTitle'),
                        this.i18nService.t('ok'), null);
                    this.biometric = false;
                    return;
                }
            }

            if (!granted) {
                await this.platformUtilsService.showDialog(
                    this.i18nService.t('nativeMessaginPermissionErrorDesc'), this.i18nService.t('nativeMessaginPermissionErrorTitle'),
                    this.i18nService.t('ok'), null);
                this.biometric = false;
                return;
            }

            const submitted = Swal.fire({
                heightAuto: false,
                buttonsStyling: false,
                titleText: this.i18nService.t('awaitDesktop'),
                text: this.i18nService.t('awaitDesktopDesc'),
                icon: 'info',
                iconHtml: '<i class="swal-custom-icon fa fa-info-circle text-info"></i>',
                showCancelButton: true,
                cancelButtonText: this.i18nService.t('cancel'),
                showConfirmButton: false,
                allowOutsideClick: false,
            });

            await this.storageService.save(ConstantsService.biometricAwaitingAcceptance, true);
            await this.cryptoService.toggleKey();

            await Promise.race([
                submitted.then(result => {
                    if (result.dismiss === Swal.DismissReason.cancel) {
                        this.biometric = false;
                        this.storageService.remove(ConstantsService.biometricAwaitingAcceptance);
                    }
                }),
                this.platformUtilsService.authenticateBiometric().then(result => {
                    this.biometric = result;

                    Swal.close();
                    if (this.biometric === false) {
                        this.platformUtilsService.showToast('error', this.i18nService.t('errorEnableBiometricTitle'), this.i18nService.t('errorEnableBiometricDesc'));
                    }
                }).catch(e => {
                    // Handle connection errors
                    this.biometric = false;
                }),
            ]);
        } else {
            await this.storageService.remove(ConstantsService.biometricUnlockKey);
            this.vaultTimeoutService.biometricLocked = false;
        }
    }

    async lock() {
        await this.vaultTimeoutService.lock(true);
    }

    async logOut() {
        const confirmed = await this.platformUtilsService.showDialog(
            this.i18nService.t('logOutConfirmation'), this.i18nService.t('logOut'),
            this.i18nService.t('yes'), this.i18nService.t('cancel'));
        if (confirmed) {
            this.messagingService.send('logout');
        }
    }

    // TODO: redirect to the Cozy settings
    async changePassword() {
        const confirmed = await this.platformUtilsService.showDialog(
            this.i18nService.t('changeMasterPasswordConfirmation'), this.i18nService.t('changeMasterPassword'),
            this.i18nService.t('yes'), this.i18nService.t('cancel'));
        if (confirmed) {
            BrowserApi.createNewTab(this.cozyClientService.getAppURL('settings', '/profile/password'));
        }
    }

    getCozyURL() {
        return this.cozyClientService.getAppURL('', '');
    }

    // TODO: Add a Cozy help
    import() {
        const url = this.cozyClientService.getAppURL('passwords', '/installation/import');
        BrowserApi.createNewTab(url);
    }

    // TODO: Add a Cozy help
    export() {
        this.router.navigate(['/export']);
    }

    help() {
        BrowserApi.createNewTab(this.i18nService.t('helpLink'));
    }

    about() {
        const versionText = document.createTextNode(
            this.i18nService.t('version') + ': ' + BrowserApi.getApplicationVersion());
        const div = document.createElement('div');
        /* tslint:disable */
        div.innerHTML = `<p class="text-center"><svg id="cozy" width="50" height="50" viewBox="0 0 52 52">
        <title>CozyCloud SVG logo. Same as cozy-ui #cozy</title>
        <path fill="#297EF2" fill-rule="evenodd" d="M558.23098,44 L533.76902,44 C526.175046,44 520,37.756072 520,30.0806092 C520,26.4203755 521.393962,22.9628463 523.927021,20.3465932 C526.145918,18.0569779 529.020185,16.6317448 532.129554,16.2609951 C532.496769,13.1175003 533.905295,10.2113693 536.172045,7.96901668 C538.760238,5.40737823 542.179607,4 545.800788,4 C549.420929,4 552.841339,5.40737823 555.429532,7.96796639 C557.686919,10.2008665 559.091284,13.0912433 559.467862,16.2179336 C566.482405,16.8533543 572,22.8284102 572,30.0816594 C572,37.756072 565.820793,44 558.22994,44 L558.23098,44 Z M558.068077,40.9989547 L558.171599,40.9989547 C564.142748,40.9989547 569,36.0883546 569,30.0520167 C569,24.0167241 564.142748,19.1061239 558.171599,19.1061239 L558.062901,19.1061239 C557.28338,19.1061239 556.644649,18.478972 556.627051,17.6887604 C556.492472,11.7935317 551.63729,7 545.802791,7 C539.968291,7 535.111039,11.7956222 534.977495,17.690851 C534.959896,18.4664289 534.34187,19.0914904 533.573737,19.1092597 C527.743378,19.2451426 523,24.1536522 523,30.0530619 C523,36.0893999 527.857252,41 533.828401,41 L533.916395,41 L533.950557,40.9979094 C533.981614,40.9979094 534.01267,40.9979094 534.043727,41 L558.064971,41 L558.068077,40.9989547 Z M553.766421,29.2227318 C552.890676,28.6381003 552.847676,27.5643091 552.845578,27.5171094 C552.839285,27.2253301 552.606453,26.9957683 552.32118,27.0000592 C552.035908,27.0054228 551.809368,27.2467844 551.814612,27.5364185 C551.81671,27.5750363 551.831393,28.0792139 552.066323,28.6735 C548.949302,31.6942753 544.051427,31.698566 540.928113,28.6917363 C541.169336,28.0888684 541.185068,27.576109 541.185068,27.5374911 C541.190312,27.2478572 540.964821,27.0086409 540.681646,27.0011319 C540.401618,26.9925502 540.163541,27.2264027 540.154102,27.5160368 C540.154102,27.5589455 540.11215,28.6370275 539.234308,29.2216592 C538.995183,29.3825669 538.92806,29.7097461 539.08433,29.9532532 C539.182917,30.1077246 539.346529,30.1924694 539.516434,30.1924694 C539.612923,30.1924694 539.710461,30.1645787 539.797512,30.1066519 C540.023003,29.9564713 540.211786,29.7848363 540.370154,29.6024742 C542.104862,31.2008247 544.296845,32 546.488828,32 C548.686055,32 550.883282,31.1976066 552.621136,29.5917471 C552.780553,29.7762546 552.971434,29.9521804 553.203218,30.1066519 C553.289219,30.1645787 553.387806,30.1924694 553.484295,30.1924694 C553.652102,30.1924694 553.816763,30.1066519 553.916399,29.9521804 C554.07162,29.7076006 554.004497,29.3793488 553.766421,29.2205864 L553.766421,29.2227318 Z" transform="translate(-520)"></path>
      </svg></p>
            <p class="text-center"><b>Cozy</b><br>Made by Cozy Cloud, based on
            <span>Bitwarden</span></p>`;
        div.appendChild(versionText);

        Swal.fire({
            heightAuto: false,
            buttonsStyling: false,
            html: div,
            showConfirmButton: false,
            showCancelButton: true,
            cancelButtonText: this.i18nService.t('close'),
        });
    }

    rate() {
        const deviceType = this.platformUtilsService.getDevice();
        BrowserApi.createNewTab((RateUrls as any)[deviceType]);
    }
    isPremiumEnabled() {
        return !this.platformUtilsService.isSafari();
    }
    premium() {
        BrowserApi.createNewTab('https://cozy.io/fr/pricing/');
    }
}
