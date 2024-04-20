/* eslint-disable no-console */
// Cozy customization
import { IOCozyContact } from "cozy-client/types/types";

import { CryptoService } from "@bitwarden/common/abstractions/crypto.service";
import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/abstractions/platformUtils.service";
import { StateService } from "@bitwarden/common/abstractions/state.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CipherData } from "@bitwarden/common/vault/models/data/cipher.data";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { CozyClientService } from "../../apps/browser/src/popup/services/cozyClient.service";

import { convertContactToCipherData } from "./contact.helper";
import { fetchContacts, fetchContact } from "./queries";

const convertContactsAsCiphers = async (
  cipherService: CipherService,
  cryptoService: CryptoService,
  i18nService: I18nService,
  contacts: IOCozyContact[]
): Promise<CipherData[]> => {
  const contactsCiphers = [];

  const key = await cryptoService.getKeyForUserEncryption();

  for (const contact of contacts) {
    try {
      const cipherData = await convertContactToCipherData(cipherService, i18nService, contact, key);

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

export const fetchContactsAndConvertAsCiphers = async (
  cipherService: CipherService,
  cryptoService: CryptoService,
  cozyClientService: CozyClientService,
  i18nService: I18nService
): Promise<CipherData[]> => {
  const client = await cozyClientService.getClientInstance();

  try {
    const contacts = await fetchContacts(client);

    const contactsCiphers = await convertContactsAsCiphers(
      cipherService,
      cryptoService,
      i18nService,
      contacts
    );

    return contactsCiphers;
  } catch (e) {
    console.log(
      "Error while fetching contacts and converting them as ciphers. Fallbacking to stored contacts.",
      e
    );

    return (await cipherService.getAll())
      .filter((cipher) => cipher.type === CipherType.Contact)
      .map((cipher) => cipher.toCipherData());
  }
};

export const favoriteContactCipher = async (
  cipherService: CipherService,
  i18nService: I18nService,
  cipher: CipherView,
  cozyClientService: CozyClientService
): Promise<boolean> => {
  const client = await cozyClientService.getClientInstance();

  const contact = await fetchContact(client, cipher.id);

  const { data: updatedContact } = await client.save({
    ...contact,
    cozyMetadata: {
      ...contact.cozyMetadata,
      favorite: !cipher.favorite,
    },
  });

  const cipherData = await convertContactToCipherData(cipherService, i18nService, updatedContact);

  await cipherService.upsert(cipherData);

  return true;
};

export const deleteContactCipher = async (
  cipherService: CipherService,
  i18nService: I18nService,
  platformUtilsService: PlatformUtilsService,
  cipher: CipherView,
  stateService: StateService,
  cozyClientService: CozyClientService
): Promise<boolean> => {
  const confirmed = await platformUtilsService.showDialog(
    i18nService.t("deleteContactItemConfirmation"),
    i18nService.t("deleteItem"),
    i18nService.t("yes"),
    i18nService.t("no"),
    "warning"
  );

  if (!confirmed) {
    return false;
  }

  const client = await cozyClientService.getClientInstance();

  const contact = await fetchContact(client, cipher.id);

  await client.destroy(contact);

  await cipherService.delete(cipher.id);

  const message = i18nService.t("deletedContactItem");
  platformUtilsService.showToast("success", null, message);

  return true;
};

// Cozy customization end
