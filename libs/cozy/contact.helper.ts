import { models } from "cozy-client";

import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { SymmetricCryptoKey } from "@bitwarden/common/models/domain/symmetric-crypto-key";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CipherData } from "@bitwarden/common/vault/models/data/cipher.data";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { ContactView } from "@bitwarden/common/vault/models/view/contact.view";

const { getInitials } = models.contact;

import { buildFieldsFromContact } from "./fields.helper";

const getPrimaryEmail = (contact: any): string | undefined => {
  return contact.email?.find((email: any) => email.primary)?.address;
};

const getPrimaryPhone = (contact: any): string | undefined => {
  return contact.phone?.find((phone: any) => phone.primary)?.number;
};

export const convertContactToCipherData = async (
  cipherService: CipherService,
  i18nService: I18nService,
  contact: any,
  key?: SymmetricCryptoKey
): Promise<CipherData> => {
  const cipherView = new CipherView();
  cipherView.id = contact.id ?? contact._id;
  cipherView.name = contact.displayName;
  cipherView.type = CipherType.Contact;
  cipherView.contact = new ContactView();
  cipherView.contact.displayName = contact.displayName;
  cipherView.contact.initials = getInitials(contact);
  cipherView.contact.primaryEmail = getPrimaryEmail(contact);
  cipherView.contact.primaryPhone = getPrimaryPhone(contact);
  cipherView.favorite = !!contact.cozyMetadata?.favorite;
  cipherView.fields = buildFieldsFromContact(i18nService, contact);
  cipherView.contact.me = contact.me;
  cipherView.creationDate = new Date(contact.cozyMetadata?.createdAt);
  cipherView.revisionDate = new Date(contact.cozyMetadata?.updatedAt);

  const cipherEncrypted = await cipherService.encrypt(cipherView, key);

  const cipherData = cipherEncrypted.toCipherData();

  return cipherData;
};
