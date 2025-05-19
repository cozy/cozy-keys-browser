import CozyClient, { dispatchCreate, dispatchUpdate, dispatchDelete } from "cozy-client";
import { CouchDBDocument, IOCozyContact } from "cozy-client/types/types";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";

import { CONTACTS_DOCTYPE } from "../../../../../libs/cozy/constants";
import { convertContactToCipherData } from "../../../../../libs/cozy/contact.helper";
import { shouldDisplayContact } from "../../../../../libs/cozy/sync";

import { SynchronousJobQueue } from "./synchronousJobQueue";

export class RealTimeNotifications {
  // This synchronous queue allows to update correctly contacts ciphers when you update multiple contacts in the same time
  // (for example when setting 4 contacts as favorite in the same time)
  private synchronousJobQueue: SynchronousJobQueue = new SynchronousJobQueue({
    onDone: () => {
      this.messagingService.send("syncCompleted", { successfully: true });
    },
  });

  constructor(
    private messagingService: MessagingService,
    private cipherService: CipherService,
    private i18nService: I18nService,
    private accountService: AccountService,
    private logService: LogService,
    private client: CozyClient,
  ) {}

  async init(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error reatime item is not typed as it is dynamically injected at runtime
    const realtime = this.client.plugins.realtime;

    await realtime.subscribe("created", CONTACTS_DOCTYPE, (args: any) =>
      this.synchronousJobQueue.push({
        function: this.dispatchCreateContact.bind(this),
        arguments: args,
      }),
    );
    await realtime.subscribe("updated", CONTACTS_DOCTYPE, (args: any) =>
      this.synchronousJobQueue.push({
        function: this.dispatchUpdateContact.bind(this),
        arguments: args,
      }),
    );
    await realtime.subscribe("deleted", CONTACTS_DOCTYPE, (args: any) =>
      this.synchronousJobQueue.push({
        function: this.dispatchDeleteContact.bind(this),
        arguments: args,
      }),
    );
  }

  async unregister() {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error reatime item is not typed as it is dynamically injected at runtime
    const realtime = this.client.plugins.realtime;

    await realtime.unsubscribe("created", CONTACTS_DOCTYPE, this.dispatchCreateContact);
    await realtime.unsubscribe("updated", CONTACTS_DOCTYPE, this.dispatchUpdateContact);
    await realtime.unsubscribe("deleted", CONTACTS_DOCTYPE, this.dispatchDeleteContact);
  }

  async dispatchCreateContact(data: IOCozyContact) {
    const contactMustBeDisplayed = await shouldDisplayContact(this.client, data);

    if (contactMustBeDisplayed) {
      this.logService.info(`Contact ${data.displayName} (${data._id}) added from realtime`);
      await this.upsertContactData(data);

      await dispatchCreate(this.client, "io.cozy.contacts", data as CouchDBDocument);
    } else {
      this.logService.info(`Contact ${data.displayName} (${data._id}) not added from realtime`);
    }
  }

  async dispatchUpdateContact(data: IOCozyContact) {
    const contactMustBeDisplayed = await shouldDisplayContact(this.client, data);

    if (contactMustBeDisplayed) {
      await this.upsertContactData(data);

      await dispatchUpdate(this.client, "io.cozy.contacts", data as CouchDBDocument);

      this.logService.info(
        `Contact ${data.displayName} (${data._id}) added or updated from realtime because changed`,
      );
    } else {
      await this.dispatchDeleteContact(data);

      this.logService.info(
        `Contact ${data.displayName} (${data._id}) removed from realtime because changed`,
      );
    }
  }

  async dispatchDeleteContact(data: any) {
    await this.cipherService.delete(data._id);

    await dispatchDelete(this.client, "io.cozy.contacts", data);
  }

  private async upsertContactData(data: IOCozyContact) {
    const cipherData = await convertContactToCipherData(
      this.cipherService,
      this.i18nService,
      this.accountService,
      data,
      null,
    );

    await this.cipherService.upsert(cipherData);
  }
}
