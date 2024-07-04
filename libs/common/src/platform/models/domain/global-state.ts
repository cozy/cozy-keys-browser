import { ThemeType } from "../../enums/theme-type.enum";

export class GlobalState {
  enableBrowserIntegration?: boolean;
  enableBrowserIntegrationFingerprint?: boolean;
  enableDuckDuckGoBrowserIntegration?: boolean;
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
  disableKonnectorsSuggestions?: boolean;
}
