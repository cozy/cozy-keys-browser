import { Directive, OnInit } from "@angular/core";
import { ControlValueAccessor, FormControl } from "@angular/forms";

import { UserVerificationService } from "@bitwarden/common/abstractions/userVerification/userVerification.service.abstraction";
import { KeyConnectorService } from "@bitwarden/common/auth/abstractions/key-connector.service";
import { VerificationType } from "@bitwarden/common/auth/enums/verification-type";
import { Utils } from "@bitwarden/common/misc/utils";
import { Verification } from "@bitwarden/common/types/verification";

/**
 * Used for general-purpose user verification throughout the app.
 * Collects the user's master password, or if they are using Key Connector, prompts for an OTP via email.
 * This is exposed to the parent component via the ControlValueAccessor interface (e.g. bind it to a FormControl).
 * Use UserVerificationService to verify the user's input.
 */
@Directive({
  selector: "app-user-verification",
})
// eslint-disable-next-line rxjs-angular/prefer-takeuntil
export class UserVerificationComponent implements ControlValueAccessor, OnInit {
  usesKeyConnector = false;
  disableRequestOTP = false;
  sentCode = false;

  secret = new FormControl("");

  private onChange: (value: Verification) => void;

  constructor(
    private keyConnectorService: KeyConnectorService,
    private userVerificationService: UserVerificationService
  ) {}

  async ngOnInit() {
    this.usesKeyConnector = await this.keyConnectorService.getUsesKeyConnector();
    this.processChanges(this.secret.value);

    // eslint-disable-next-line rxjs-angular/prefer-takeuntil
    this.secret.valueChanges.subscribe((secret: string) => this.processChanges(secret));
  }

  async requestOTP() {
    if (this.usesKeyConnector) {
      this.disableRequestOTP = true;
      try {
        await this.userVerificationService.requestOTP();
        this.sentCode = true;
      } finally {
        this.disableRequestOTP = false;
      }
    }
  }

  writeValue(obj: any): void {
    this.secret.setValue(obj);
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    // Not implemented
  }

  setDisabledState?(isDisabled: boolean): void {
    this.disableRequestOTP = isDisabled;
    if (isDisabled) {
      this.secret.disable();
    } else {
      this.secret.enable();
    }
  }

  private processChanges(secret: string) {
    if (this.onChange == null) {
      return;
    }

    this.onChange({
      type: this.usesKeyConnector ? VerificationType.OTP : VerificationType.MasterPassword,
      secret: Utils.isNullOrWhitespace(secret) ? null : secret,
    });
  }
}
