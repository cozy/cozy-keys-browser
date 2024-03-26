/* eslint-disable no-console */
// Cozy customization
import { CipherResponse } from "@bitwarden/common/vault/models/response/cipher.response";

import { convertContactToCipherResponse } from "./contact.helper";
import { fetchContacts } from "./queries";

const convertContactsAsCiphers = async (
  cipherService: any,
  contacts: any
): Promise<CipherResponse[]> => {
  const contactsCiphers = [];

  for (const contact of contacts) {
    const cipherResponse = await convertContactToCipherResponse(cipherService, contact);

    contactsCiphers.push(cipherResponse);
  }

  return contactsCiphers;
};

export const fetchContactsAndConvertAsCiphers = async (
  cipherService: any,
  cozyClientService: any
): Promise<CipherResponse[]> => {
  const client = await cozyClientService.getClientInstance();

  try {
    const contacts = await fetchContacts(client);

    const contactsCiphers = await convertContactsAsCiphers(cipherService, contacts);

    console.log(`${contactsCiphers.length} contacts ciphers will be added`);

    return contactsCiphers;
  } catch (e) {
    console.log("Error while fetching contacts and converting them as ciphers", e);

    return [];
  }
};

// Cozy customization end
