import CozyClient, { dispatchCreate, dispatchUpdate, dispatchDelete } from "cozy-client";
import { CouchDBDocument, IOCozyContact, IOCozyFile } from "cozy-client/types/types";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";

import { CONTACTS_DOCTYPE, FILES_DOCTYPE } from "../../../../../libs/cozy/constants";
import { convertContactToCipherData } from "../../../../../libs/cozy/contact.helper";
import {
  convertNoteToCipherData,
  fetchNoteIllustrationUrl,
  isNote,
} from "../../../../../libs/cozy/note.helper";
import { convertPaperToCipherData } from "../../../../../libs/cozy/paper.helper";
import { fetchHydratedPaper } from "../../../../../libs/cozy/queries";
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

    // We don't want to listen Creation as it is always followed by an Update notification with more data
    await realtime.subscribe("updated", FILES_DOCTYPE, this.dispatchUpdatePaper.bind(this));
    await realtime.subscribe("deleted", FILES_DOCTYPE, this.dispatchDeletePaper.bind(this));

    const doctypeThumbnail = "io.cozy.files.thumbnails";
    await realtime.subscribe("created", doctypeThumbnail, this.dispatchCreateThumbnail.bind(this));
  }

  async unregister() {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error reatime item is not typed as it is dynamically injected at runtime
    const realtime = this.client.plugins.realtime;

    await realtime.unsubscribe("created", CONTACTS_DOCTYPE, this.dispatchCreateContact);
    await realtime.unsubscribe("updated", CONTACTS_DOCTYPE, this.dispatchUpdateContact);
    await realtime.unsubscribe("deleted", CONTACTS_DOCTYPE, this.dispatchDeleteContact);

    await realtime.unsubscribe("updated", FILES_DOCTYPE, this.dispatchUpdatePaper);
    await realtime.unsubscribe("deleted", FILES_DOCTYPE, this.dispatchDeletePaper);

    const doctypeThumbnail = "io.cozy.files.thumbnails";
    await realtime.unsubscribe("created", doctypeThumbnail, this.dispatchCreateThumbnail);
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

  async dispatchUpdatePaper(data: any) {
    if (data.type !== "file") {
      return;
    }
    if (!data.metadata?.qualification?.label) {
      return;
    }

    /*
      A paper may be updated because a contact was added or removed from the association.
      If it has been removed, we can not know if we need to remove the contact from the vault
      without checking all the other papers and the contact which is almost equivalent
      to a fullSync.
      So, since now our fullSync is efficient, it's easier to do a fullSync than checking
      every case.
    */

    this.logService.info(`Starting full sync from realtime because paper updated`);

    this.messagingService.send("fullSync");
  }

  async dispatchDeletePaper(data: any) {
    if (data.type !== "file") {
      return;
    }
    if (!data.metadata?.qualification?.label) {
      return;
    }

    /*
      When a paper is deleted, we can not know if we need to remove the contact from the vault
      without checking all the other papers and the contact which is almost equivalent
      to a fullSync.
      So, since now our fullSync is efficient, it's easier to do a fullSync than checking
      every case.
    */

    this.logService.info(`Starting full sync from realtime because paper deleted`);

    this.messagingService.send("fullSync");
  }

  async upsertPaperData(paper: IOCozyFile) {
    let cipherData;
    if (isNote(paper)) {
      const noteIllustrationUrl = await fetchNoteIllustrationUrl(this.client);

      cipherData = await convertNoteToCipherData(
        this.cipherService,
        this.i18nService,
        this.accountService,
        paper,
        {
          noteIllustrationUrl,
        },
      );
    } else {
      const baseUrl = this.client.getStackClient().uri;

      cipherData = await convertPaperToCipherData(
        this.cipherService,
        this.i18nService,
        this.accountService,
        paper,
        {
          baseUrl,
        },
      );
    }

    await this.cipherService.upsert(cipherData);
    this.messagingService.send("syncedUpsertedCipher", { cipherId: paper._id });
    this.messagingService.send("syncCompleted", { successfully: true });
  }

  async dispatchCreateThumbnail(data: any) {
    const cipher = await this.cipherService.get(data._id);

    if (cipher === null) {
      return;
    }

    const hydratedPaper = await fetchHydratedPaper(this.client, data._id);

    this.upsertPaperData(hydratedPaper);
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
