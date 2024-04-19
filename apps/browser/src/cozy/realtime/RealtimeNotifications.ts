import CozyClient from "cozy-client";

import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/abstractions/messaging.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherData } from "@bitwarden/common/vault/models/data/cipher.data";

import { convertContactToCipherResponse } from "../../../../../libs/cozy/contact.helper"

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
  }

  async unregister() {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error reatime item is not typed as it is dynamically injected at runtime
    const realtime = this.client.plugins.realtime;

    const doctypeContact = "io.cozy.contacts";
    await realtime.unsubscribe("created", doctypeContact, this.dispatchCreateOrUpdateContact);
    await realtime.unsubscribe("updated", doctypeContact, this.dispatchCreateOrUpdateContact);
    await realtime.unsubscribe("deleted", doctypeContact, this.dispatchDeleteCipher);
  }

  async dispatchCreateOrUpdateContact(data: any) {
    const cipherResponse = await convertContactToCipherResponse(
      this.cipherService,
      this.i18nService,
      data
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
}