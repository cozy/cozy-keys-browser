import { EnvironmentUrls } from "../../auth/models/domain/environment-urls";
import { StateVersion } from "../../enums/stateVersion";
import { ThemeType } from "../../enums/themeType";

import { WindowState } from "./window-state";

export class GlobalState {
  enableAlwaysOnTop?: boolean;
  installedVersion?: string;
  locale?: string;
  organizationInvitation?: any;
  ssoCodeVerifier?: string;
  ssoOrganizationIdentifier?: string;
  ssoState?: string;
  rememberedEmail?: string;
  // Cozy customization, set `LightContrasted` theme by default on first opening
  /*
  theme?: ThemeType = ThemeType.System;
  /*/
  theme?: ThemeType = ThemeType.LightContrasted;
  //*/

  // Cozy customization, track if user manually set a preferred theme
  //*
  isUserSetTheme = false;
  //*/

  window?: WindowState = new WindowState();
  twoFactorToken?: string;
  disableFavicon?: boolean;
  biometricAwaitingAcceptance?: boolean;
  biometricFingerprintValidated?: boolean;
  vaultTimeout?: number;
  vaultTimeoutAction?: string;
  loginRedirect?: any;
  mainWindowSize?: number;
  enableBiometrics?: boolean;
  biometricText?: string;
  noAutoPromptBiometrics?: boolean;
  noAutoPromptBiometricsText?: string;
  stateVersion: StateVersion = StateVersion.One;
  environmentUrls: EnvironmentUrls = new EnvironmentUrls();
  enableTray?: boolean;
  enableMinimizeToTray?: boolean;
  enableCloseToTray?: boolean;
  enableStartToTray?: boolean;
  openAtLogin?: boolean;
  alwaysShowDock?: boolean;
  enableBrowserIntegration?: boolean;
  enableBrowserIntegrationFingerprint?: boolean;
  enableDuckDuckGoBrowserIntegration?: boolean;
}
