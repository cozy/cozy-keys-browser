/*
    This code is from https://github.com/cozy/cozy-libs/blob/ff41af377c94d8ab5e34ffe91984bb1b1efd3b36/packages/cozy-authentication/src/steps/SelectServer.jsx#L194
*/
export class CozySanitizeUrlService {
    public cozyDomain = '.mycozy.cloud'

    constructor() {}

    protected isValideCozyName = (value: string): boolean => {
        return (
            /^[a-zA-Z0-9-]*$/.test(value) &&
            value.length > 0 &&
            value.length < 63
        );
    };
    hasMispelledCozy = (value: string): boolean => /\.mycosy\./.test(value);
    protected hasAtSign = (value: string): boolean => /.*@.*/.test(value);

    protected appendDomain = (value: string, domain: string) =>
        /\./.test(value) ? value : `${value}${domain}`;

    protected prependProtocol = (value: string) =>
        /^http(s)?:\/\//.test(value) ? value : `https://${value}`;

    protected removeAppSlug = (value: string) => {
        const matchedSlugs = /^https?:\/\/\w+(-\w+)\./gi.exec(value);

        return matchedSlugs ? value.replace(matchedSlugs[1], '') : value;
    };

    normalizeURL = (value: string, defaultDomain: string): string => {
        const valueWithProtocol = this.prependProtocol(value);
        const valueWithProtocolAndDomain = this.appendDomain(
            valueWithProtocol,
            defaultDomain
        );

        const isDefaultDomain = new RegExp(`${defaultDomain}$`).test(
            valueWithProtocolAndDomain
        );

        
        return isDefaultDomain
            ? this.removeAppSlug(valueWithProtocolAndDomain)
            : valueWithProtocolAndDomain;
    };
}
