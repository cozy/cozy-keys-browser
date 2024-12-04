import CozyClient from "cozy-client";
import { IOCozyContact, IOCozyFile } from "cozy-client/types/types";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherData } from "@bitwarden/common/vault/models/data/cipher.data";
import { KeyService } from "@bitwarden/key-management";

import { CozyClientService } from "../../apps/browser/src/popup/services/cozyClient.service";

import { CONTACTS_DOCTYPE } from "./constants";
import { convertAllContactsAsCiphers } from "./contactCipher";
import { convertAllPapersAsCiphers } from "./paperCipher";
import { fetchContactsAndPapers, fetchPapers, fetchMyself } from "./queries";

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

  const papers = await fetchPapers(client);

  const contactIsInPaper = papers.find((paper) => {
    // @ts-expect-error contacts added manually with an hydration
    return paper.contacts.data.find((paperContact) => paperContact._id === contact._id);
  });

  if (contactIsInPaper) {
    return true;
  }

  return false;
};
export const selectContactsAndPapers = (
  contacts: IOCozyContact[],
  papers: IOCozyFile[],
): { filteredContacts: IOCozyContact[]; filteredPapers: IOCozyFile[] } => {
  // #### For papers, we do nothing
  const filteredPapers = papers;

  // #### For contacts, we want
  // 1. contacts from the query
  // 2. contacts related to "me"
  // 3. contacts referenced in papers
  const contactsToKeep = new Map<string, IOCozyContact>();

  // First we add contacts from the query (i.e. me and favorite contacts) and contacts related to "me"
  contacts.forEach((contact) => {
    contactsToKeep.set(contact._id, contact);

    if (contact.me) {
      // @ts-expect-error related added manually with an hydration
      contact.related.data.forEach((relatedContact: IOCozyContact) => {
        contactsToKeep.set(relatedContact._id, relatedContact);
      });
    }
  });

  // Then we add contacts referenced in papers
  papers.forEach((paper) => {
    // @ts-expect-error contacts added manually with an hydration
    paper.contacts.data.forEach((contact: IOCozyContact) => {
      contactsToKeep.set(contact._id, contact);
    });
  });

  return {
    filteredPapers,
    filteredContacts: [...contactsToKeep.values()],
  };
};

export const getCozyCiphers = async (
  cipherService: CipherService,
  keyService: KeyService,
  cozyClientService: CozyClientService,
  i18nService: I18nService,
  accountService: AccountService,
): Promise<CipherData[]> => {
  const client = await cozyClientService.getClientInstance();

  const { contacts, papers } = await fetchContactsAndPapers(client);

  const { filteredContacts, filteredPapers } = selectContactsAndPapers(contacts, papers);

  const contactsCiphers = await convertAllContactsAsCiphers(
    cipherService,
    keyService,
    i18nService,
    accountService,
    filteredContacts,
  );
  const papersCiphers = await convertAllPapersAsCiphers(
    cipherService,
    keyService,
    cozyClientService,
    i18nService,
    accountService,
    filteredPapers,
  );

  let cozyCiphers: CipherData[] = [];

  // eslint-disable-next-line no-console
  console.log(`${contactsCiphers.length} contacts ciphers will be added`);
  cozyCiphers = cozyCiphers.concat(contactsCiphers);

  // eslint-disable-next-line no-console
  console.log(`${papersCiphers.length} papers ciphers will be added`);
  cozyCiphers = cozyCiphers.concat(papersCiphers);

  return cozyCiphers;
};
