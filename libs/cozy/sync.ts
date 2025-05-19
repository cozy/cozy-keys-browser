import CozyClient from "cozy-client";
import { IOCozyContact } from "cozy-client/types/types";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherData } from "@bitwarden/common/vault/models/data/cipher.data";
import { KeyService } from "@bitwarden/key-management";

import { CozyClientService } from "../../apps/browser/src/popup/services/cozyClient.service";

import { CONTACTS_DOCTYPE } from "./constants";
import { convertAllContactsAsCiphers } from "./contactCipher";
import { fetchContacts, fetchMyself } from "./queries";

export const shouldDisplayContact = async (client: CozyClient, contact: IOCozyContact) => {
  if (contact.me) {
    return true;
  }

  if (contact.cozyMetadata.favorite) {
    return true;
  }

  const me = await fetchMyself(client);

  // @ts-expect-error related added manually with an hydration
  const contactRelatedToMe = contact.relationships?.related?.data?.find(
    // @ts-expect-error related added manually with an hydration
    (relation) => relation._id === me[0]._id && relation._type === CONTACTS_DOCTYPE,
  );

  if (contactRelatedToMe) {
    return true;
  }

  return false;
};
export const selectContacts = (contacts: IOCozyContact[]): IOCozyContact[] => {
  // We add contacts from the query (i.e. me and favorite contacts) and contacts related to "me"
  const contactsToKeep = new Map<string, IOCozyContact>();

  contacts.forEach((contact) => {
    contactsToKeep.set(contact._id, contact);

    if (contact.me) {
      // @ts-expect-error related added manually with an hydration
      contact.related.data.forEach((relatedContact: IOCozyContact) => {
        contactsToKeep.set(relatedContact._id, relatedContact);
      });
    }
  });

  return Array.from(contactsToKeep.values());
};

export const getCozyCiphers = async (
  cipherService: CipherService,
  keyService: KeyService,
  cozyClientService: CozyClientService,
  i18nService: I18nService,
  accountService: AccountService,
): Promise<CipherData[]> => {
  const client = await cozyClientService.getClientInstance();

  const contacts = await fetchContacts(client);

  const filteredContacts = selectContacts(contacts);

  const contactsCiphers = await convertAllContactsAsCiphers(
    cipherService,
    keyService,
    i18nService,
    accountService,
    filteredContacts,
  );

  let cozyCiphers: CipherData[] = [];

  // eslint-disable-next-line no-console
  console.log(`${contactsCiphers.length} contacts ciphers will be added`);
  cozyCiphers = cozyCiphers.concat(contactsCiphers);

  return cozyCiphers;
};
