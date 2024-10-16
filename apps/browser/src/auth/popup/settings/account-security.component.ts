import { DialogRef } from "@angular/cdk/dialog";
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from "@angular/core";
import { FormBuilder } from "@angular/forms";
import {
  BehaviorSubject,
  combineLatest,
  concatMap,
  distinctUntilChanged,
  filter,
  firstValueFrom,
  map,
  Observable,
  pairwise,
  startWith,
  Subject,
  switchMap,
  takeUntil,
} from "rxjs";

import { FingerprintDialogComponent } from "@bitwarden/auth/angular";
import { PinServiceAbstraction } from "@bitwarden/auth/common";
import { VaultTimeoutSettingsService } from "@bitwarden/common/abstractions/vault-timeout/vault-timeout-settings.service";
import { VaultTimeoutService } from "@bitwarden/common/abstractions/vault-timeout/vault-timeout.service";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { VaultTimeoutAction } from "@bitwarden/common/enums/vault-timeout-action.enum";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { BiometricStateService } from "@bitwarden/common/platform/biometrics/biometric-state.service";
import { BiometricsService } from "@bitwarden/common/platform/biometrics/biometric.service";
import {
  VaultTimeout,
  VaultTimeoutOption,
  VaultTimeoutStringType,
} from "@bitwarden/common/types/vault-timeout.type";
import { DialogService, ToastService } from "@bitwarden/components";

import { BiometricErrors, BiometricErrorTypes } from "../../../models/biometricErrors";
import { BrowserApi } from "../../../platform/browser/browser-api";
import { enableAccountSwitching } from "../../../platform/flags";
import BrowserPopupUtils from "../../../platform/popup/browser-popup-utils";
import { SetPinComponent } from "../components/set-pin.component";

import { AwaitDesktopDialogComponent } from "./await-desktop-dialog.component";

/* start Cozy imports */
/* eslint-disable */
import { CozyClientService } from "../../../popup/services/cozyClient.service";
/* eslint-enable */
/* end Cozy imports */

@Component({
  selector: "auth-account-security",
  templateUrl: "account-security.component.html",
})

/**
 * See the original component:
 * https://github.com/bitwarden/browser/blob/
 * 60f6863e4f96fbf8d012e5691e4e2cc5f18ac7a8/src/popup/settings/settings.component.ts
 */
// eslint-disable-next-line rxjs-angular/prefer-takeuntil
export class AccountSecurityComponent implements OnInit, OnDestroy {
  protected readonly VaultTimeoutAction = VaultTimeoutAction;
  availableVaultTimeoutActions: VaultTimeoutAction[] = [];
  vaultTimeoutOptions: VaultTimeoutOption[];
  vaultTimeoutPolicyCallout: Observable<{
    timeout: { hours: number; minutes: number };
    action: VaultTimeoutAction;
  }>;
  supportsBiometric: boolean;
  showChangeMasterPass = true;
  accountSwitcherEnabled = false;

  form = this.formBuilder.group({
    vaultTimeout: [null as VaultTimeout | null],
    vaultTimeoutAction: [VaultTimeoutAction.Lock],
    pin: [null as boolean | null],
    biometric: false,
    enableAutoBiometricsPrompt: true,
  });

  private refreshTimeoutSettings$ = new BehaviorSubject<void>(undefined);
  private destroy$ = new Subject<void>();

  constructor(
    private accountService: AccountService,
    private pinService: PinServiceAbstraction,
    private policyService: PolicyService,
    private formBuilder: FormBuilder,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private vaultTimeoutService: VaultTimeoutService,
    private vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    public messagingService: MessagingService,
    private environmentService: EnvironmentService,
    private cryptoService: CryptoService,
    private stateService: StateService,
    private userVerificationService: UserVerificationService,
    private dialogService: DialogService,
    private changeDetectorRef: ChangeDetectorRef,
    private biometricStateService: BiometricStateService,
    private cozyClientService: CozyClientService,
    private toastService: ToastService,
    private biometricsService: BiometricsService,
  ) {
    this.accountSwitcherEnabled = enableAccountSwitching();
  }

  async ngOnInit() {
    const maximumVaultTimeoutPolicy = this.policyService.get$(PolicyType.MaximumVaultTimeout);
    this.vaultTimeoutPolicyCallout = maximumVaultTimeoutPolicy.pipe(
      filter((policy) => policy != null),
      map((policy) => {
        let timeout;
        if (policy.data?.minutes) {
          timeout = {
            hours: Math.floor(policy.data?.minutes / 60),
            minutes: policy.data?.minutes % 60,
          };
        }
        return { timeout: timeout, action: policy.data?.action };
      }),
    );

    const showOnLocked =
      !this.platformUtilsService.isFirefox() && !this.platformUtilsService.isSafari();

    this.vaultTimeoutOptions = [
      { name: this.i18nService.t("immediately"), value: 0 },
      { name: this.i18nService.t("oneMinute"), value: 1 },
      { name: this.i18nService.t("fiveMinutes"), value: 5 },
      { name: this.i18nService.t("fifteenMinutes"), value: 15 },
      { name: this.i18nService.t("thirtyMinutes"), value: 30 },
      { name: this.i18nService.t("oneHour"), value: 60 },
      { name: this.i18nService.t("fourHours"), value: 240 },
    ];

    if (showOnLocked) {
      this.vaultTimeoutOptions.push({
        name: this.i18nService.t("onLocked"),
        value: VaultTimeoutStringType.OnLocked,
      });
    }

    this.vaultTimeoutOptions.push({
      name: this.i18nService.t("onRestart"),
      value: VaultTimeoutStringType.OnRestart,
    });
    this.vaultTimeoutOptions.push({
      name: this.i18nService.t("never"),
      value: VaultTimeoutStringType.Never,
    });

    const activeAccount = await firstValueFrom(this.accountService.activeAccount$);

    let timeout = await firstValueFrom(
      this.vaultTimeoutSettingsService.getVaultTimeoutByUserId$(activeAccount.id),
    );
    if (timeout === VaultTimeoutStringType.OnLocked && !showOnLocked) {
      timeout = VaultTimeoutStringType.OnRestart;
    }

    const initialValues = {
      vaultTimeout: timeout,
      vaultTimeoutAction: await firstValueFrom(
        this.vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$(activeAccount.id),
      ),
      pin: await this.pinService.isPinSet(activeAccount.id),
      biometric: await this.vaultTimeoutSettingsService.isBiometricLockSet(),
      enableAutoBiometricsPrompt: await firstValueFrom(
        this.biometricStateService.promptAutomatically$,
      ),
    };
    this.form.patchValue(initialValues, { emitEvent: false });

    this.supportsBiometric = await this.biometricsService.supportsBiometric();
    this.showChangeMasterPass = await this.userVerificationService.hasMasterPassword();

    this.form.controls.vaultTimeout.valueChanges
      .pipe(
        startWith(initialValues.vaultTimeout), // emit to init pairwise
        pairwise(),
        concatMap(async ([previousValue, newValue]) => {
          await this.saveVaultTimeout(previousValue, newValue);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    this.form.controls.vaultTimeoutAction.valueChanges
      .pipe(
        startWith(initialValues.vaultTimeoutAction), // emit to init pairwise
        pairwise(),
        concatMap(async ([previousValue, newValue]) => {
          await this.saveVaultTimeoutAction(previousValue, newValue);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    this.form.controls.pin.valueChanges
      .pipe(
        concatMap(async (value) => {
          await this.updatePin(value);
          this.refreshTimeoutSettings$.next();
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    this.form.controls.biometric.valueChanges
      .pipe(
        distinctUntilChanged(),
        concatMap(async (enabled) => {
          await this.updateBiometric(enabled);
          if (enabled) {
            this.form.controls.enableAutoBiometricsPrompt.enable();
          } else {
            this.form.controls.enableAutoBiometricsPrompt.disable();
          }
          this.refreshTimeoutSettings$.next();
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    this.refreshTimeoutSettings$
      .pipe(
        switchMap(() =>
          combineLatest([
            this.vaultTimeoutSettingsService.availableVaultTimeoutActions$(),
            this.vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$(activeAccount.id),
          ]),
        ),
        takeUntil(this.destroy$),
      )
      .subscribe(([availableActions, action]) => {
        this.availableVaultTimeoutActions = availableActions;
        this.form.controls.vaultTimeoutAction.setValue(action, { emitEvent: false });
        // NOTE: The UI doesn't properly update without detect changes.
        // I've even tried using an async pipe, but it still doesn't work. I'm not sure why.
        // Using an async pipe means that we can't call `detectChanges` AFTER the data has change
        // meaning that we are forced to use regular class variables instead of observables.
        this.changeDetectorRef.detectChanges();
      });

    this.refreshTimeoutSettings$
      .pipe(
        switchMap(() =>
          combineLatest([
            this.vaultTimeoutSettingsService.availableVaultTimeoutActions$(),
            maximumVaultTimeoutPolicy,
          ]),
        ),
        takeUntil(this.destroy$),
      )
      .subscribe(([availableActions, policy]) => {
        if (policy?.data?.action || availableActions.length <= 1) {
          this.form.controls.vaultTimeoutAction.disable({ emitEvent: false });
        } else {
          this.form.controls.vaultTimeoutAction.enable({ emitEvent: false });
        }
      });
  }

  async saveVaultTimeout(previousValue: VaultTimeout, newValue: VaultTimeout) {
    if (newValue === VaultTimeoutStringType.Never) {
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "warning" },
        content: { key: "neverLockWarning" },
        type: "warning",
      });

      if (!confirmed) {
        this.form.controls.vaultTimeout.setValue(previousValue, { emitEvent: false });
        return;
      }
    }

    // The minTimeoutError does not apply to browser because it supports Immediately
    // So only check for the policyError
    if (this.form.controls.vaultTimeout.hasError("policyError")) {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("vaultTimeoutTooLarge"),
      });
      return;
    }

    const activeAccount = await firstValueFrom(this.accountService.activeAccount$);

    const vaultTimeoutAction = await firstValueFrom(
      this.vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$(activeAccount.id),
    );

    await this.vaultTimeoutSettingsService.setVaultTimeoutOptions(
      activeAccount.id,
      newValue,
      vaultTimeoutAction,
    );
    if (newValue === VaultTimeoutStringType.Never) {
      this.messagingService.send("bgReseedStorage");
    }
  }

  async saveVaultTimeoutAction(previousValue: VaultTimeoutAction, newValue: VaultTimeoutAction) {
    if (newValue === VaultTimeoutAction.LogOut) {
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "vaultTimeoutLogOutConfirmationTitle" },
        content: { key: "vaultTimeoutLogOutConfirmation" },
        type: "warning",
      });

      if (!confirmed) {
        this.form.controls.vaultTimeoutAction.setValue(previousValue, {
          emitEvent: false,
        });
        return;
      }
    }

    if (this.form.controls.vaultTimeout.hasError("policyError")) {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("vaultTimeoutTooLarge"),
      });
      return;
    }

    const activeAccount = await firstValueFrom(this.accountService.activeAccount$);

    await this.vaultTimeoutSettingsService.setVaultTimeoutOptions(
      activeAccount.id,
      this.form.value.vaultTimeout,
      newValue,
    );
    this.refreshTimeoutSettings$.next();
  }

  async updatePin(value: boolean) {
    if (value) {
      const dialogRef = SetPinComponent.open(this.dialogService);

      if (dialogRef == null) {
        this.form.controls.pin.setValue(false, { emitEvent: false });
        return;
      }

      const userHasPinSet = await firstValueFrom(dialogRef.closed);
      this.form.controls.pin.setValue(userHasPinSet, { emitEvent: false });
    } else {
      await this.vaultTimeoutSettingsService.clear();
    }
  }

  async updateBiometric(enabled: boolean) {
    if (enabled && this.supportsBiometric) {
      let granted;
      try {
        granted = await BrowserApi.requestPermission({ permissions: ["nativeMessaging"] });
      } catch (e) {
        // eslint-disable-next-line
        console.error(e);

        if (this.platformUtilsService.isFirefox() && BrowserPopupUtils.inSidebar(window)) {
          await this.dialogService.openSimpleDialog({
            title: { key: "nativeMessaginPermissionSidebarTitle" },
            content: { key: "nativeMessaginPermissionSidebarDesc" },
            acceptButtonText: { key: "ok" },
            cancelButtonText: null,
            type: "info",
          });

          this.form.controls.biometric.setValue(false);
          return;
        }
      }

      if (!granted) {
        await this.dialogService.openSimpleDialog({
          title: { key: "nativeMessaginPermissionErrorTitle" },
          content: { key: "nativeMessaginPermissionErrorDesc" },
          acceptButtonText: { key: "ok" },
          cancelButtonText: null,
          type: "danger",
        });

        this.form.controls.biometric.setValue(false);
        return;
      }

      let awaitDesktopDialogRef: DialogRef<boolean, unknown> | undefined;
      let biometricsResponseReceived = false;

      await this.cryptoService.refreshAdditionalKeys();

      const waitForUserDialogPromise = async () => {
        // only show waiting dialog if we have waited for 200 msec to prevent double dialog
        // the os will respond instantly if the dialog shows successfully, and the desktop app will respond instantly if something is wrong
        await new Promise((resolve) => setTimeout(resolve, 200));
        if (biometricsResponseReceived) {
          return;
        }

        awaitDesktopDialogRef = AwaitDesktopDialogComponent.open(this.dialogService);
        const result = await firstValueFrom(awaitDesktopDialogRef.closed);
        if (result !== true) {
          this.form.controls.biometric.setValue(false);
        }
      };

      const biometricsPromise = async () => {
        try {
          const result = await this.biometricsService.authenticateBiometric();

          // prevent duplicate dialog
          biometricsResponseReceived = true;
          if (awaitDesktopDialogRef) {
            awaitDesktopDialogRef.close(true);
          }

          this.form.controls.biometric.setValue(result);
          if (!result) {
            this.toastService.showToast({
              variant: "error",
              title: this.i18nService.t("errorEnableBiometricTitle"),
              message: this.i18nService.t("errorEnableBiometricDesc"),
            });
          }
        } catch (e) {
          // prevent duplicate dialog
          biometricsResponseReceived = true;
          if (awaitDesktopDialogRef) {
            awaitDesktopDialogRef.close(true);
          }

          this.form.controls.biometric.setValue(false);

          if (e.message == "canceled") {
            return;
          }

          const error = BiometricErrors[e.message as BiometricErrorTypes];
          await this.dialogService.openSimpleDialog({
            title: { key: error.title },
            content: { key: error.description },
            acceptButtonText: { key: "ok" },
            cancelButtonText: null,
            type: "danger",
          });
        } finally {
          if (awaitDesktopDialogRef) {
            awaitDesktopDialogRef.close(true);
          }
        }
      };

      await Promise.race([waitForUserDialogPromise(), biometricsPromise()]);
    } else {
      await this.biometricStateService.setBiometricUnlockEnabled(false);
      await this.biometricStateService.setFingerprintValidated(false);
    }
  }

  async updateAutoBiometricsPrompt() {
    await this.biometricStateService.setPromptAutomatically(
      this.form.value.enableAutoBiometricsPrompt,
    );
  }

  async changePassword() {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "continueToWebApp" },
      content: { key: "changeMasterPasswordOnWebConfirmation" },
      type: "info",
      acceptButtonText: { key: "continue" },
    });
    if (confirmed) {
      await BrowserApi.createNewTab(
        this.cozyClientService.getAppURL("settings", "/profile/password"),
      );
    }
  }

  async twoStep() {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "twoStepLogin" },
      content: { key: "twoStepLoginConfirmation" },
      type: "info",
    });
    if (confirmed) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      BrowserApi.createNewTab("https://bitwarden.com/help/setup-two-step-login/");
    }
  }

  help() {
    BrowserApi.createNewTab(this.i18nService.t("helpLink"));
  }
  async fingerprint() {
    const fingerprint = await this.cryptoService.getFingerprint(
      await this.stateService.getUserId(),
    );

    const dialogRef = FingerprintDialogComponent.open(this.dialogService, {
      fingerprint,
    });

    return firstValueFrom(dialogRef.closed);
  }

  async lock() {
    await this.vaultTimeoutService.lock();
  }

  async logOut() {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "logOut" },
      content: { key: "logOutConfirmation" },
      type: "info",
    });

    const userId = (await firstValueFrom(this.accountService.activeAccount$))?.id;
    if (confirmed) {
      this.messagingService.send("logout", { userId: userId });
    }
  }

  // Cozy customization
  isPremiumEnabled() {
    return !this.platformUtilsService.isSafari();
  }

  async openPremiumPage() {
    const link = await this.cozyClientService.getPremiumLink();
    if (link) {
      BrowserApi.createNewTab(link);
    } else {
      BrowserApi.createNewTab("https://cozy.io/fr/pricing/");
    }
  }

  getCozyURL() {
    return this.cozyClientService.getCozyURL();
  }
  // Cozy customization end

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
