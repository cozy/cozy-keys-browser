import { IOCozyContact, IOCozyFile } from "cozy-client/types/types";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherData } from "@bitwarden/common/vault/models/data/cipher.data";

import { CozyClientService } from "../../apps/browser/src/popup/services/cozyClient.service";

import { convertAllContactsAsCiphers } from "./contactCipher";
import { convertAllPapersAsCiphers } from "./paperCipher";
import { fetchContactsAndPapers } from "./queries";

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
  cryptoService: CryptoService,
  cozyClientService: CozyClientService,
  i18nService: I18nService,
  accountService: AccountService,
): Promise<CipherData[]> => {
  const client = await cozyClientService.getClientInstance();

  const { contacts, papers } = await fetchContactsAndPapers(client);

  const { filteredContacts, filteredPapers } = selectContactsAndPapers(contacts, papers);

  const contactsCiphers = await convertAllContactsAsCiphers(
    cipherService,
    cryptoService,
    i18nService,
    accountService,
    filteredContacts,
  );
  const papersCiphers = await convertAllPapersAsCiphers(
    cipherService,
    cryptoService,
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
