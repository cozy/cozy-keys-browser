import CozyClient from "cozy-client";

import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/abstractions/messaging.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherData } from "@bitwarden/common/vault/models/data/cipher.data";
import { CipherResponse } from "@bitwarden/common/vault/models/response/cipher.response";

import { convertContactToCipherResponse } from "../../../../../libs/cozy/contact.helper";
import {
  convertNoteToCipherResponse,
  fetchNoteIllustrationUrl,
  isNote,
} from "../../../../../libs/cozy/note.helper";
import { convertPaperToCipherResponse } from "../../../../../libs/cozy/paper.helper";
import { fetchPaper } from "../../../../../libs/cozy/queries";

export class RealTimeNotifications {
  constructor(
    private messagingService: MessagingService,
    private cipherService: CipherService,
    private i18nService: I18nService,
    private client: CozyClient
  ) {}

  async init(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error reatime item is not typed as it is dynamically injected at runtime
    const realtime = this.client.plugins.realtime;

    const doctypeContact = "io.cozy.contacts";
    await realtime.subscribe(
      "created",
      doctypeContact,
      this.dispatchCreateOrUpdateContact.bind(this)
    );
    await realtime.subscribe(
      "updated",
      doctypeContact,
      this.dispatchCreateOrUpdateContact.bind(this)
    );
    await realtime.subscribe("deleted", doctypeContact, this.dispatchDeleteCipher.bind(this));

    const doctypePaper = "io.cozy.files";
    // We don't want to listen Creation as it is always followed by an Update notification with more data
    await realtime.subscribe("updated", doctypePaper, this.dispatchUpdatePaper.bind(this));
    await realtime.subscribe("deleted", doctypePaper, this.dispatchDeleteCipher.bind(this));

    const doctypeThumbnail = "io.cozy.files.thumbnails";
    await realtime.subscribe("created", doctypeThumbnail, this.dispatchCreateThumbnail.bind(this));
  }

  async unregister() {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error reatime item is not typed as it is dynamically injected at runtime
    const realtime = this.client.plugins.realtime;

    const doctypeContact = "io.cozy.contacts";
    await realtime.unsubscribe("created", doctypeContact, this.dispatchCreateOrUpdateContact);
    await realtime.unsubscribe("updated", doctypeContact, this.dispatchCreateOrUpdateContact);
    await realtime.unsubscribe("deleted", doctypeContact, this.dispatchDeleteCipher);

    const doctypePaper = "io.cozy.files";
    await realtime.unsubscribe("updated", doctypePaper, this.dispatchUpdatePaper);
    await realtime.unsubscribe("deleted", doctypePaper, this.dispatchDeleteCipher);

    const doctypeThumbnail = "io.cozy.files.thumbnails";
    await realtime.unsubscribe("created", doctypeThumbnail, this.dispatchCreateThumbnail);
  }

  async dispatchCreateOrUpdateContact(data: any) {
    const cipherResponse = await convertContactToCipherResponse(
      this.cipherService,
      this.i18nService,
      data,
      null
    );
    await this.cipherService.upsert(new CipherData(cipherResponse));
    this.messagingService.send("syncedUpsertedCipher", { cipherId: data._id });
    this.messagingService.send("syncCompleted", { successfully: true });
  }

  async dispatchDeleteCipher(data: any) {
    await this.cipherService.delete(data._id);
    this.messagingService.send("syncedDeletedCipher", { cipherId: data._id });
    this.messagingService.send("syncCompleted", { successfully: true });
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
      return this.dispatchDeleteCipher(data);
    }

    await this.upsertPaperFromId(data._id);
  }

  async upsertPaperFromId(paperId: string) {
    const itemFromDb = await fetchPaper(this.client, paperId);
    const hydratedData = this.client.hydrateDocuments("io.cozy.files", [itemFromDb])[0];

    let cipherResponse: CipherResponse;
    if (isNote(itemFromDb)) {
      const noteIllustrationUrl = await fetchNoteIllustrationUrl(this.client);

      cipherResponse = await convertNoteToCipherResponse(
        this.cipherService,
        this.i18nService,
        hydratedData,
        {
          noteIllustrationUrl,
        }
      );
    } else {
      const baseUrl = this.client.getStackClient().uri;

      cipherResponse = await convertPaperToCipherResponse(
        this.cipherService,
        this.i18nService,
        hydratedData,
        {
          baseUrl,
        }
      );
    }

    await this.cipherService.upsert(new CipherData(cipherResponse));
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
}
