/* eslint-disable no-console */
// Cozy customization
import { IOCozyContact } from "cozy-client/types/types";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CipherData } from "@bitwarden/common/vault/models/data/cipher.data";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService, ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

import { CozyClientService } from "../../apps/browser/src/popup/services/cozyClient.service";

import { convertContactToCipherData } from "./contact.helper";
import { fetchContact } from "./queries";

const convertContactsAsCiphers = async (
  cipherService: CipherService,
  keyService: KeyService,
  i18nService: I18nService,
  accountService: AccountService,
  contacts: IOCozyContact[],
): Promise<CipherData[]> => {
  const contactsCiphers = [];

  const key = await keyService.getUserKey();

  for (const contact of contacts) {
    try {
      const cipherData = await convertContactToCipherData(
        cipherService,
        i18nService,
        accountService,
        contact,
        key,
      );

      contactsCiphers.push(cipherData);
    } catch (e) {
      if (e.message === "No encryption key provided.") {
        throw e;
      }

      console.log(`Error during conversion of contact ${contact.id}`, contact, e);
    }
  }

  return contactsCiphers;
};

export const convertAllContactsAsCiphers = async (
  cipherService: CipherService,
  keyService: KeyService,
  i18nService: I18nService,
  accountService: AccountService,
  contacts: IOCozyContact[],
): Promise<CipherData[]> => {
  try {
    const contactsCiphers = await convertContactsAsCiphers(
      cipherService,
      keyService,
      i18nService,
      accountService,
      contacts,
    );

    return contactsCiphers;
  } catch (e) {
    console.log(
      "Error while fetching contacts and converting them as ciphers. Fallbacking to stored contacts.",
      e,
    );

    return (await cipherService.getAll())
      .filter((cipher) => cipher.type === CipherType.Contact)
      .map((cipher) => cipher.toCipherData());
  }
};

export const favoriteContactCipher = async (
  cipherService: CipherService,
  i18nService: I18nService,
  accountService: AccountService,
  cipher: CipherView,
  cozyClientService: CozyClientService,
): Promise<boolean> => {
  const client = await cozyClientService.getClientInstance();

  const contact = await fetchContact(client, cipher.id);

  if (contact.cozyMetadata) {
    contact.cozyMetadata.favorite = !cipher.favorite;
  } else {
    contact.cozyMetadata = {
      favorite: !cipher.favorite,
    };
  }

  const { data: updatedContact } = await client.save(contact);

  const cipherData = await convertContactToCipherData(
    cipherService,
    i18nService,
    accountService,
    updatedContact,
  );

  await cipherService.upsert(cipherData);

  return true;
};

export const deleteContactCipher = async (
  cipherService: CipherService,
  i18nService: I18nService,
  dialogService: DialogService,
  toastService: ToastService,
  cipher: CipherView,
  cozyClientService: CozyClientService,
  organizationService: OrganizationService,
): Promise<boolean> => {
  const confirmed = await dialogService.openSimpleDialog({
    title: i18nService.t("deleteItem"),
    content: i18nService.t("deleteContactItemConfirmation"),
    type: "warning",
  });

  if (!confirmed) {
    return false;
  }

  const client = await cozyClientService.getClientInstance();

  const contact = await fetchContact(client, cipher.id);

  await client.destroy(contact);

  await cipherService.delete(cipher.id);

  const message = i18nService.t("deletedContactItem");
  toastService.showToast({ title: message, message: "", variant: "success" });

  return true;
};

// Cozy customization end
