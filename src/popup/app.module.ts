import { A11yModule } from "@angular/cdk/a11y";
import { DragDropModule } from "@angular/cdk/drag-drop";
import { ScrollingModule } from "@angular/cdk/scrolling";

import { AppRoutingModule } from "./app-routing.module";
import { ServicesModule } from "./services/services.module";

import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { BrowserModule } from "@angular/platform-browser";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";

import { HintComponent } from "./accounts/hint.component";
import { HomeComponent } from "./accounts/home.component";
import { LockComponent } from "./accounts/lock.component";
import { LoginComponent } from "./accounts/login.component";
import { RemovePasswordComponent } from "./accounts/remove-password.component";
import { SetPasswordComponent } from "./accounts/set-password.component";
import { SsoComponent } from "./accounts/sso.component";
import { TwoFactorOptionsComponent } from "./accounts/two-factor-options.component";
import { TwoFactorComponent } from "./accounts/two-factor.component";
import { UpdateTempPasswordComponent } from "./accounts/update-temp-password.component";

import { PasswordGeneratorHistoryComponent } from "./generator/password-generator-history.component";
import { PasswordGeneratorComponent } from "./generator/password-generator.component";

import { AppComponent } from "./app.component";
import { PrivateModeComponent } from "./private-mode.component";
import { TabsComponent } from "./tabs.component";

import { ExcludedDomainsComponent } from "./settings/excluded-domains.component";
import { ExportComponent } from "./settings/export.component";
import { FolderAddEditComponent } from "./settings/folder-add-edit.component";
import { FoldersComponent } from "./settings/folders.component";
import { OptionsComponent } from "./settings/options.component";
import { SettingsComponent } from "./settings/settings.component";
import { SyncComponent } from "./settings/sync.component";
import { VaultTimeoutInputComponent } from "./settings/vault-timeout-input.component";

import { AddEditCustomFieldsComponent } from "./vault/add-edit-custom-fields.component";
import { AddEditComponent } from "./vault/add-edit.component";
import { AttachmentsComponent } from "./vault/attachments.component";
import { CiphersComponent } from "./vault/ciphers.component";
import { CollectionsComponent } from "./vault/collections.component";
import { CurrentTabComponent } from "./vault/current-tab.component";
import { GroupingsComponent } from "./vault/groupings.component";
import { PasswordHistoryComponent } from "./vault/password-history.component";
import { ShareComponent } from "./vault/share.component";
import { ViewCustomFieldsComponent } from "./vault/view-custom-fields.component";
import { ViewComponent } from "./vault/view.component";

import { EffluxDatesComponent as SendEffluxDatesComponent } from "./send/efflux-dates.component";
import { SendAddEditComponent } from "./send/send-add-edit.component";
import { SendGroupingsComponent } from "./send/send-groupings.component";
import { SendTypeComponent } from "./send/send-type.component";

import { A11yTitleDirective } from "jslib-angular/directives/a11y-title.directive";
import { ApiActionDirective } from "jslib-angular/directives/api-action.directive";
import { AutofocusDirective } from "jslib-angular/directives/autofocus.directive";
import { BlurClickDirective } from "jslib-angular/directives/blur-click.directive";
import { BoxRowDirective } from "jslib-angular/directives/box-row.directive";
import { CipherListVirtualScroll } from "jslib-angular/directives/cipherListVirtualScroll.directive";
import { FallbackSrcDirective } from "jslib-angular/directives/fallback-src.directive";
import { InputVerbatimDirective } from "jslib-angular/directives/input-verbatim.directive";
import { SelectCopyDirective } from "jslib-angular/directives/select-copy.directive";
import { StopClickDirective } from "jslib-angular/directives/stop-click.directive";
import { StopPropDirective } from "jslib-angular/directives/stop-prop.directive";
import { TrueFalseValueDirective } from "jslib-angular/directives/true-false-value.directive";

import { ColorPasswordPipe } from "jslib-angular/pipes/color-password.pipe";
import { I18nPipe } from "jslib-angular/pipes/i18n.pipe";
import { SearchCiphersPipe } from "jslib-angular/pipes/search-ciphers.pipe";

import { ActionButtonsComponent } from "./components/action-buttons.component";
import { CipherRowComponent } from "./components/cipher-row.component";
import { PasswordRepromptComponent } from "./components/password-reprompt.component";
import { SendListComponent } from "./components/send-list.component";
import { SetPinComponent } from "./components/set-pin.component";
import { VerifyMasterPasswordComponent } from "./components/verify-master-password.component";

import { CalloutComponent } from "jslib-angular/components/callout.component";
// import { IconComponent } from 'jslib-angular/components/icon.component';
import { IconComponent } from "./components/icon.component";
import { BitwardenToastModule } from "jslib-angular/components/toastr.component";

import { CurrencyPipe, DatePipe, registerLocaleData } from "@angular/common";

import localeEnGb from "@angular/common/locales/en-GB";
import localeFr from "@angular/common/locales/fr";
import localeKn from "@angular/common/locales/kn";

/* start Cozy imports */
import { FlagConditionalComponent } from "../cozy/components/flag-conditional/flag-conditional.component";
import { IfFlagDirective } from "../cozy/components/flag-conditional/if-flag.directive";
/* end Cozy imports */

registerLocaleData(localeEnGb, "en-GB");
registerLocaleData(localeFr, "fr");

@NgModule({
  imports: [
    A11yModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    BrowserModule,
    DragDropModule,
    FormsModule,
    ReactiveFormsModule,
    ScrollingModule,
    ServicesModule,
    BitwardenToastModule.forRoot({
      maxOpened: 2,
      autoDismiss: true,
      closeButton: true,
      positionClass: "toast-bottom-full-width",
    }),
  ],
  declarations: [
    A11yTitleDirective,
    ActionButtonsComponent,
    AddEditComponent,
    AddEditCustomFieldsComponent,
    ApiActionDirective,
    AppComponent,
    AttachmentsComponent,
    AutofocusDirective,
    BlurClickDirective,
    BoxRowDirective,
    CalloutComponent,
    CipherListVirtualScroll,
    CipherRowComponent,
    CiphersComponent,
    CollectionsComponent,
    ColorPasswordPipe,
    CurrentTabComponent,
    ExcludedDomainsComponent,
    ExportComponent,
    FallbackSrcDirective,
    FolderAddEditComponent,
    FoldersComponent,
    GroupingsComponent,
    HintComponent,
    HomeComponent,
    I18nPipe,
    IconComponent,
    InputVerbatimDirective,
    LockComponent,
    LoginComponent,
    OptionsComponent,
    PasswordGeneratorComponent,
    PasswordGeneratorHistoryComponent,
    PasswordHistoryComponent,
    PasswordRepromptComponent,
    PrivateModeComponent,
    SearchCiphersPipe,
    SelectCopyDirective,
    SendAddEditComponent,
    SendEffluxDatesComponent,
    SendGroupingsComponent,
    SendListComponent,
    SendTypeComponent,
    SetPasswordComponent,
    SetPinComponent,
    SettingsComponent,
    ShareComponent,
    SsoComponent,
    StopClickDirective,
    StopPropDirective,
    SyncComponent,
    TabsComponent,
    TrueFalseValueDirective,
    TwoFactorComponent,
    TwoFactorOptionsComponent,
    UpdateTempPasswordComponent,
    VaultTimeoutInputComponent,
    VerifyMasterPasswordComponent,
    ViewComponent,
    ViewCustomFieldsComponent,
    RemovePasswordComponent,
    FlagConditionalComponent,
    IfFlagDirective,
  ],
  entryComponents: [],
  providers: [CurrencyPipe, DatePipe],
  bootstrap: [AppComponent],
})
export class AppModule {}
