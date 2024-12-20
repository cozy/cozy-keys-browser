export class CozySanitizeUrlService {
  cozyDomain = ".mycozy.cloud";

  normalizeURL = (value: string, defaultDomain: string): string => {
    const valueWithProtocol = this.prependProtocol(value);
    const valueWithoutTrailingSlash = this.removeTrailingSlash(valueWithProtocol);
    const valueWithProtocolAndDomain = this.appendDomain(valueWithoutTrailingSlash, defaultDomain);

    const isDefaultDomain = new RegExp(`${defaultDomain}$`).test(valueWithProtocolAndDomain);

    return isDefaultDomain
      ? this.removeAppSlug(valueWithProtocolAndDomain)
      : valueWithProtocolAndDomain;
  };

  hasMispelledCozy = (value: string): boolean => /\.mycosy\./.test(value);

  protected appendDomain = (value: string, domain: string) =>
    /\./.test(value) ? value : `${value}${domain}`;

  protected prependProtocol = (value: string) =>
    /^http(s)?:\/\//.test(value) ? value : `https://${value}`;

  protected removeAppSlug = (value: string) => {
    const matchedSlugs = /^https?:\/\/\w+(-\w+)\./gi.exec(value);

    return matchedSlugs ? value.replace(matchedSlugs[1], "") : value;
  };

  protected removeTrailingSlash = (value: string) => value.replace(/\/$/, "");

  sanitizeUrlInput = (inputUrl: string, domain: string = this.cozyDomain): string => {
    // Prevent empty url
    if (!inputUrl) {
      throw new Error("cozyUrlRequired");
    }
    // Prevent email input
    if (inputUrl.includes("@")) {
      throw new Error("noEmailAsCozyUrl");
    }

    if (this.hasMispelledCozy(inputUrl)) {
      throw new Error("hasMispelledCozy");
    }

    return this.normalizeURL(inputUrl, domain);
  };
}
