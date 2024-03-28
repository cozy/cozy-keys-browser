// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import CozyClient, { HasMany, Q, QueryDefinition, generateWebLink } from "cozy-client";
import flag from "cozy-flags";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EnvironmentService } from "@bitwarden/common/abstractions/environment.service";
import { MessagingService } from "@bitwarden/common/abstractions/messaging.service";
import { SecureNoteType } from "@bitwarden/common/enums/secureNoteType";
import { UriMatchType } from "@bitwarden/common/enums/uriMatchType";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CardView } from "@bitwarden/common/vault/models/view/card.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { IdentityView } from "@bitwarden/common/vault/models/view/identity.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import { SecureNoteView } from "@bitwarden/common/vault/models/view/secure-note.view";

import { BrowserStateService as StateService } from "../../services/abstractions/browser-state.service";

interface QueryResult<T> {
  data: { attributes: T };
}

type ExpectedContext = QueryResult<{
  manager_url?: string;
  enable_premium_links?: boolean;
}>;

type ExpectedInstance = QueryResult<{
  uuid?: string;
  email?: string;
}>;

/**
 * CozyClient service, used to communicate with a Cozy stack on specific Cozy's routes.
 *
 * The token used to create a cozy-client instance is the bearer token retrieved from jslib.
 */
export class CozyClientService {
  protected instance: CozyClient;
  protected flagChangedPointer: any = undefined;
  private estimatedVaultCreationDate: Date = null;
  private subDomainType: "nested" | "flat";

  constructor(
    protected environmentService: EnvironmentService,
    protected apiService: ApiService,
    protected messagingService: MessagingService,
    protected cipherService: CipherService,
    private stateService: StateService
  ) {
    this.flagChangedPointer = this.flagChanged.bind(this);
  }

  getCozyURL(): string {
    const vaultUrl = this.environmentService.getWebVaultUrl();
    if (!vaultUrl) {
      return null;
    }
    return new URL(vaultUrl).origin; // Remove the /bitwarden part
  }

  registerFlags() {
    flag.store.on("change", this.flagChangedPointer);
  }

  unregisterFlags() {
    flag.store.removeListener("change", this.flagChangedPointer);
  }

  notifyFlagStatus(flagName: string) {
    const flagValue = flag(flagName);
    this.messagingService.send("flagChange", { flagName, flagValue });
  }

  flagChanged(flagName: string) {
    const flagValue = flag(flagName);
    this.messagingService.send("flagChange", { flagName, flagValue });
  }

  async getFlagValue(flagName: string) {
    await this.getClientInstance();
    return flag(flagName);
  }

  async getClientInstance() {
    if (this.instance) {
      const token = await this.apiService.getActiveBearerToken();
      // If the instance's token differ from the active bearer, a refresh is needed.
      if (token !== this.instance.getStackClient().token.accessToken) {
        const oauthToken = {
          tokenType: "bearer",
          accessToken: token,
          refreshToken: await this.stateService.getRefreshToken(),
          scope: "*",
        };

        this.instance.getStackClient().setToken(oauthToken);
        this.instance.options.token = token;
      }
      return this.instance;
    }
    this.instance = await this.createClient();
    return this.instance;
  }

  async createClient() {
    if (this.instance) {
      this.unregisterFlags();
    }
    const uri = this.getCozyURL();
    const token = await this.apiService.getActiveBearerToken();

    const oauthToken = {
      tokenType: "bearer",
      accessToken: token,
      refreshToken: await this.stateService.getRefreshToken(),
      scope: "*",
    };

    const oauthOptions = {
      clientID: "id",
      clientName: "Cozy Pass (Cozy Client)",
    };

    this.instance = new CozyClient({
      uri: uri,
      oauth: {
        token: oauthToken,
      },
      oauthOptions,
      schema: {
        files: {
          doctype: "io.cozy.files",
          relationships: {
            contacts: {
              type: HasManyContacts,
              doctype: "io.cozy.contacts",
            },
          },
        },
      },
    });

    await this.instance.login({
      uri,
      token: oauthToken,
    });

    this.instance.registerPlugin(flag.plugin, undefined);
    this.registerFlags();
    await this.instance.plugins.flags.initializing;
    await this.getSubDomainType();
    return this.instance;
  }

  /**
   * returns a url (string) pointing to the premium plan for this Cozy
   * or null if some data are missing
   */
  async getPremiumLink() {
    const client = await this.getClientInstance();
    // retrieve manager_url &  enable_premium_links
    const { manager_url, enable_premium_links } = (
      (await client.fetchQueryAndGetFromState({
        definition: Q("io.cozy.settings").getById("context"),
        options: {
          as: `${"io.cozy.settings"}/io.cozy.settings.context`,
          fetchPolicy: CozyClient.fetchPolicies.olderThan(5 * 60 * 1000),
          singleDocData: true,
        },
      })) as ExpectedContext
    ).data.attributes;
    // retrieve uuid
    const instance = (await client.fetchQueryAndGetFromState({
      definition: Q("io.cozy.settings").getById("io.cozy.settings.instance"),
      options: {
        as: `${"io.cozy.settings"}/io.cozy.settings.instance`,
        fetchPolicy: CozyClient.fetchPolicies.olderThan(5 * 60 * 1000),
        singleDocData: true,
      },
    })) as ExpectedInstance;
    const uuid = instance.data.attributes?.uuid;
    // build offer url on the cloudery
    if (enable_premium_links && manager_url && uuid) {
      const managerUrl = new URL(manager_url);
      managerUrl.pathname = `/cozy/instances/${uuid}/premium`;
      return managerUrl.toString();
    } else {
      return null;
    }
  }

  /**
   * returns user's email (string)
   */
  async getUserEmail(): Promise<string> {
    const client = await this.getClientInstance();
    // retrieve instance data
    const instance = (await client.fetchQueryAndGetFromState({
      definition: Q("io.cozy.settings").getById("io.cozy.settings.instance"),
      options: {
        as: `${"io.cozy.settings"}/io.cozy.settings.instance`,
        fetchPolicy: CozyClient.fetchPolicies.olderThan(5 * 60 * 1000),
        singleDocData: true,
      },
    })) as ExpectedInstance;
    return instance.data.attributes?.email;
  }

  async updateSynchronizedAt() {
    try {
      const client = await this.getClientInstance();
      await client.getStackClient().fetchJSON("POST", "/settings/synchronized");
    } catch (err) {
      // console.error("Error while updating cozy client's synchronized_at");
      // console.error(err);
    }
  }

  async deleteOAuthClient() {
    const { clientId, registrationAccessToken } = await this.stateService.getOauthTokens();
    if (!clientId || !registrationAccessToken) {
      return;
    }

    try {
      const client = await this.getClientInstance();
      await client.getStackClient().fetchJSON("DELETE", "/auth/register/" + clientId, undefined, {
        headers: {
          Authorization: "Bearer " + registrationAccessToken,
        },
      });
    } catch (err) {
      // console.error("Error while deleting oauth client");
      // console.error(err);
    }
  }

  getAppURL(appName: string, hash: string) {
    if (!appName) {
      return new URL(this.getCozyURL()).toString();
    }
    const cozyURL = this.getCozyURL();
    const link = generateWebLink({
      cozyUrl: cozyURL,
      searchParams: [],
      pathname: "",
      hash: hash,
      slug: appName,
      subDomainType: this.subDomainType,
    });

    return link;
  }

  /**
   * Returns true if appUrl points the currently connected cozy.
   * even if the appUrl points to a specific app (nested of flat urls)
   */
  correspondsToConnectedCozyURL(appUrl: string): boolean {
    const appURL = new URL(appUrl);
    const currentCozyURL = new URL(this.getCozyURL());
    if (this.subDomainType === "nested") {
      //remove first subdomain if there is one more than on the Cozy (would be an app nested domain)
      const currentCozyURLHosts = currentCozyURL.host.split(".");
      let appUrlHosts = appURL.host.split(".");
      if (appUrlHosts.length === currentCozyURLHosts.length + 1) {
        appUrlHosts = appUrlHosts.slice(1);
      }
      if (appUrlHosts.join(".") === currentCozyURL.host) {
        return true;
      }
      return false;
    } else {
      // remove potential `-appslug` in the first subdomain and then compare
      const appUrlHosts = appURL.host.split(".");
      appUrlHosts[0] = appUrlHosts[0].replace(/-[A-Za-z0-9]+/g, "");
      appURL.host = appUrlHosts.join(".");
      if (appURL.host === currentCozyURL.host) {
        return true;
      }
      return false;
    }
  }

  /**
   * @returns "nested" or "flat"
   */
  async getSubDomainType(): Promise<"flat" | "nested"> {
    if (this.subDomainType) {
      return this.subDomainType;
    }
    const client = await this.getClientInstance();
    const capabilities = await client.query(Q("io.cozy.settings").getById("capabilities"));
    this.subDomainType = capabilities?.data.attributes.flat_subdomains ? "flat" : "nested";
    return this.subDomainType;
  }

  async saveCozyCredentials(uri: string, pwd: string) {
    // find a possible already existing cipher
    const ciphersUnfiltered = await this.cipherService.getAllDecryptedForUrl(
      uri,
      undefined,
      UriMatchType.Domain
    );
    const ciphers = [];
    for (const c of ciphersUnfiltered) {
      if (c.isDeleted) {
        break;
      }
      // test that the cipher url realy matches the user's Cozy url
      for (const u of c.login.uris) {
        if (this.correspondsToConnectedCozyURL(u.uri)) {
          ciphers.push(c);
          break;
        }
      }
    }
    if (ciphers.length) {
      // update first existing cipher
      const cipher = ciphers[0];
      if (cipher.login.password !== pwd) {
        cipher.login.password = pwd;
        const encCipher = await this.cipherService.encrypt(cipher);
        this.cipherService.updateWithServer(encCipher);
        return;
      }
    } else {
      // create a new cipher for this Cozy
      const cipher = new CipherView();
      cipher.organizationId = null;
      cipher.name = "My Cozy";
      cipher.folderId = null;
      cipher.type = CipherType.Login;
      cipher.login = new LoginView();
      cipher.login.uris = [new LoginUriView()];
      cipher.login.uris[0].uri = uri;
      cipher.login.password = pwd;
      cipher.card = new CardView();
      cipher.identity = new IdentityView();
      cipher.secureNote = new SecureNoteView();
      cipher.secureNote.type = SecureNoteType.Generic;
      cipher.reprompt = CipherRepromptType.None;
      const encCipher = await this.cipherService.encrypt(cipher);
      await this.cipherService.createWithServer(encCipher);
    }
  }

  async logout() {
    const client = await this.getClientInstance();
    this.deleteOAuthClient();
    await client.logout();
  }

  async getVaultCreationDate(): Promise<Date> {
    if (this.estimatedVaultCreationDate) {
      // it is useless to update its age if one is known
      return this.estimatedVaultCreationDate;
    }
    const ciphers = await this.cipherService.getAllDecrypted();
    if (ciphers.length === 0) {
      return new Date();
    }
    const minDate = ciphers.reduce((minDate, cipher) => {
      const date = cipher.creationDate ? cipher.creationDate : cipher.revisionDate;
      if (date) {
        return date < minDate ? date : minDate;
      }
      return minDate;
    }, new Date());
    this.estimatedVaultCreationDate = minDate;
    return minDate;
  }
}

class HasManyContacts extends HasMany {
  get data() {
    const refs = this.target.relationships.referenced_by.data;
    const albums = refs ? refs.map((ref) => this.get(ref.type, ref.id)).filter(Boolean) : [];
    return albums;
  }

  static query(doc, client, assoc) {
    if (
      !doc.relationships ||
      !doc.relationships.referenced_by ||
      !doc.relationships.referenced_by.data
    ) {
      return null;
    }
    const included = doc.relationships.referenced_by.data;
    const ids = included.filter((inc) => inc.type === assoc.doctype).map((inc) => inc.id);

    return new QueryDefinition({ doctype: assoc.doctype, ids });
  }
}
