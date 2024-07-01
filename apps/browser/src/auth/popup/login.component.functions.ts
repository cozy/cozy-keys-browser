import { CozySanitizeUrlService } from "../../popup/services/cozySanitizeUrl.service";

export const sanitizeUrlInput = (
  inputUrl: string,
  cozySanitizeUrlService: CozySanitizeUrlService,
): string => {
  // Prevent empty url
  if (!inputUrl) {
    throw new Error("cozyUrlRequired");
  }
  // Prevent email input
  if (inputUrl.includes("@")) {
    throw new Error("noEmailAsCozyUrl");
  }

  if (cozySanitizeUrlService.hasMispelledCozy(inputUrl)) {
    throw new Error("hasMispelledCozy");
  }

  return cozySanitizeUrlService.normalizeURL(inputUrl, cozySanitizeUrlService.cozyDomain);
};
