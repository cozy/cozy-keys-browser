import CozyClient, { Q } from "cozy-client";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import flag from "cozy-flags";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EnvironmentService } from "@bitwarden/common/abstractions/environment.service";
import { MessagingService } from "@bitwarden/common/abstractions/messaging.service";
interface QueryResult<T> {
  data: { attributes: T }
}

type ExpectedContext = QueryResult<{
  manager_url?: string
  enable_premium_links?: boolean
}>

type ExpectedInstance = QueryResult<{ uuid?: string }>

/**
 * CozyClient service, used to communicate with a Cozy stack on specific Cozy's routes.
 *
 * The token used to create a cozy-client instance is the bearer token retrieved from jslib.
 */
export class CozyClientService {
  protected instance: CozyClient;
  protected flagChangedPointer: any = undefined;

  constructor(
    protected environmentService: EnvironmentService,
    protected apiService: ApiService,
    protected messagingService: MessagingService
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

  async getClientInstance() {
    if (this.instance) {
      const token = await this.apiService.getActiveBearerToken();
      // If the instance's token differ from the active bearer, a refresh is needed.
      if (token !== this.instance.options.token) {
        this.instance.getStackClient().setToken(token);
        this.instance.options.token = token;
      }
      return this.instance;
    }
    this.instance = await this.createClient();
    return this.instance;
  }

  async createClient() {
    console.log("createClient()");

    if (this.instance) {
      this.unregisterFlags();
    }
    const uri = this.getCozyURL();
    const token = await this.apiService.getActiveBearerToken();
    this.instance = new CozyClient({ uri: uri, token: token });
    this.instance.registerPlugin(flag.plugin, undefined);
    this.registerFlags();
    return this.instance;
  }

  /**
   * returns a url (string) pointing to the premium plan for this Cozy
   * or null if some data are missing
   */
  async getPremiumLink() {
    const client = await this.getClientInstance();
    // retrieve manager_url &  enable_premium_links
    const { manager_url, enable_premium_links } =
      (await client.query(Q('io.cozy.settings').getById('context')) as ExpectedContext).data.attributes;
    // retrieve uuid
    const instance = (await client.fetchQueryAndGetFromState(
      {
        definition: Q("io.cozy.settings").getById('io.cozy.settings.instance'),
        options: {
          as: `${"io.cozy.settings"}/io.cozy.settings.instance`,
          fetchPolicy: CozyClient.fetchPolicies.olderThan(5 * 60 * 1000),
          singleDocData: true
        }
      }
    )) as ExpectedInstance
    const uuid = instance.data.attributes?.uuid;
    // build offer url on the cloudery
    const offersLink = enable_premium_links && manager_url && uuid
            ? `${manager_url}/cozy/instances/${uuid}/premium`
            : null
    return offersLink;
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

  async deleteOAuthClient(clientId: string, registrationAccessToken: string) {
    if (!clientId || !registrationAccessToken) {
      return;
    }

    try {
      const client = await this.getClientInstance();
      await client.getStackClient().fetch("DELETE", "/auth/register/" + clientId, undefined, {
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
    const url = new URL(this.getCozyURL());
    const hostParts = url.host.split(".");
    url.host = [`${hostParts[0]}-${appName}`, ...hostParts.slice(1)].join(".");
    if (hash) {
      url.hash = hash;
    }
    return url.toString();
  }

  async logout() {
    const client = await this.getClientInstance();

    await client.logout();
  }
}
