import CozyClient, { dispatchCreate, dispatchUpdate, dispatchDelete } from "cozy-client";
import { CouchDBDocument, IOCozyContact } from "cozy-client/types/types";

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
import { fetchPaper } from "../../../../../libs/cozy/queries";
import { shouldDisplayContact } from "../../../../../libs/cozy/sync";

export class RealTimeNotifications {
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

    await realtime.subscribe("created", CONTACTS_DOCTYPE, this.dispatchCreateContact.bind(this));
    await realtime.subscribe("updated", CONTACTS_DOCTYPE, this.dispatchUpdateContact.bind(this));
    await realtime.subscribe("deleted", CONTACTS_DOCTYPE, this.dispatchDeleteContact.bind(this));

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
      this.logService.info(`Contact ${data.displayName} (${data._id}) added from realtime`)
      await this.upsertContactData(data);

      await dispatchCreate(this.client, "io.cozy.contacts", data as CouchDBDocument);
    } else {
      this.logService.info(`Contact ${data.displayName} (${data._id}) not added from realtime`)
    }
  }

  async dispatchUpdateContact(data: IOCozyContact) {
    await this.upsertContactData(data);

    await dispatchUpdate(this.client, "io.cozy.contacts", data as CouchDBDocument);
  }

  async dispatchDeleteContact(data: any) {
    await this.cipherService.delete(data._id);
    this.messagingService.send("syncedDeletedCipher", { cipherId: data._id });
    this.messagingService.send("syncCompleted", { successfully: true });

    await dispatchDelete(this.client, "io.cozy.contacts", data);
  }

  async dispatchUpdatePaper(data: any) {
    if (data.type !== "file") {
      return;
    }
    if (!data.metadata?.qualification?.label) {
      return;
    }
    if (data.dir_id === "io.cozy.files.trash-dir") {
      // We don't want to display trashed papers in the extension's bin so we remove them from the vault
      return this.dispatchDeletePaper(data);
    }

    const isCreate = !(await this.cipherService.get(data._id));

    if (isCreate) {
      await dispatchCreate(this.client, "io.cozy.files", data);
    } else {
      await dispatchUpdate(this.client, "io.cozy.files", data);
    }

    await this.upsertPaperFromId(data._id);
  }

  async dispatchDeletePaper(data: any) {
    await this.cipherService.delete(data._id);
    this.messagingService.send("syncedDeletedCipher", { cipherId: data._id });
    this.messagingService.send("syncCompleted", { successfully: true });

    await dispatchDelete(this.client, "io.cozy.files", data);
  }

  async upsertPaperFromId(paperId: string) {
    const itemFromDb = await fetchPaper(this.client, paperId);
    const hydratedData = this.client.hydrateDocuments(FILES_DOCTYPE, [itemFromDb])[0];

    let cipherData;
    if (isNote(itemFromDb)) {
      const noteIllustrationUrl = await fetchNoteIllustrationUrl(this.client);

      cipherData = await convertNoteToCipherData(
        this.cipherService,
        this.i18nService,
        this.accountService,
        hydratedData,
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
        hydratedData,
        {
          baseUrl,
        },
      );
    }

    await this.cipherService.upsert(cipherData);
    this.messagingService.send("syncedUpsertedCipher", { cipherId: paperId });
    this.messagingService.send("syncCompleted", { successfully: true });
  }

  async dispatchCreateThumbnail(data: any) {
    const cipher = await this.cipherService.get(data._id);

    if (cipher === null) {
      return;
    }

    this.upsertPaperFromId(data._id);
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

    this.messagingService.send("syncedUpsertedCipher", { cipherId: data._id });
    this.messagingService.send("syncCompleted", { successfully: true });
  }
}
