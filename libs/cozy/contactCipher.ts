/* eslint-disable no-console */
// Cozy customization
import { CryptoService } from "@bitwarden/common/abstractions/crypto.service";
import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/abstractions/platformUtils.service";
import { StateService } from "@bitwarden/common/abstractions/state.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherData } from "@bitwarden/common/vault/models/data/cipher.data";
import { CipherResponse } from "@bitwarden/common/vault/models/response/cipher.response";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { convertContactToCipherResponse } from "./contact.helper";
import { fetchContacts, fetchContact } from "./queries";

const convertContactsAsCiphers = async (
  cipherService: any,
  cryptoService: CryptoService,
  i18nService: any,
  contacts: any
): Promise<CipherResponse[]> => {
  const contactsCiphers = [];

  const key = await cryptoService.getKeyForUserEncryption();

  for (const contact of contacts) {
    const cipherResponse = await convertContactToCipherResponse(
      cipherService,
      i18nService,
      contact,
      key
    );

    contactsCiphers.push(cipherResponse);
  }

  return contactsCiphers;
};

export const fetchContactsAndConvertAsCiphers = async (
  cipherService: any,
  cryptoService: CryptoService,
  cozyClientService: any,
  i18nService: any
): Promise<CipherResponse[]> => {
  const client = await cozyClientService.getClientInstance();

  try {
    const contacts = await fetchContacts(client);

    const contactsCiphers = await convertContactsAsCiphers(
      cipherService,
      cryptoService,
      i18nService,
      contacts
    );

    console.log(`${contactsCiphers.length} contacts ciphers will be added`);

    return contactsCiphers;
  } catch (e) {
    console.log("Error while fetching contacts and converting them as ciphers", e);

    return [];
  }
};

export const favoriteContactCipher = async (
  cipherService: CipherService,
  cryptoService: CryptoService,
  i18nService: I18nService,
  cipher: CipherView,
  cozyClientService: any
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

  const cipherResponse = await convertContactToCipherResponse(
    cipherService,
    cryptoService,
    i18nService,
    updatedContact
  );

  const cipherData = new CipherData(cipherResponse);

  await cipherService.upsert([cipherData]);

  return true;
};

export const deleteContactCipher = async (
  cipherService: CipherService,
  i18nService: I18nService,
  platformUtilsService: PlatformUtilsService,
  cipher: CipherView,
  stateService: StateService,
  cozyClientService: any
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
