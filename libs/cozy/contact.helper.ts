import { models } from "cozy-client";

import { ContactApi } from "@bitwarden/common/models/api/contact.api";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CipherResponse } from "@bitwarden/common/vault/models/response/cipher.response";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { ContactView } from "@bitwarden/common/vault/models/view/contact.view";

const { getInitials } = models.contact;

import { buildFieldsFromContact, copyEncryptedFields } from "./fields.helper";

const getPrimaryEmail = (contact: any): string | undefined => {
  return contact.email?.find((email: any) => email.primary)?.address;
};

const getPrimaryPhone = (contact: any): string | undefined => {
  return contact.phone?.find((phone: any) => phone.primary)?.number;
};

export const convertContactToCipherResponse = async (
  cipherService: any,
  i18nService: any,
  contact: any
): Promise<CipherResponse> => {
  const cipherView = new CipherView();
  cipherView.id = contact.id;
  cipherView.name = contact.displayName;
  cipherView.type = CipherType.Contact;
  cipherView.contact = new ContactView();
  cipherView.contact.displayName = contact.displayName;
  cipherView.contact.initials = getInitials(contact);
  cipherView.contact.primaryEmail = getPrimaryEmail(contact);
  cipherView.contact.primaryPhone = getPrimaryPhone(contact);
  cipherView.favorite = !!contact.cozyMetadata?.favorite;
  cipherView.fields = buildFieldsFromContact(i18nService, contact);

  const cipherEncrypted = await cipherService.encrypt(cipherView);
  const cipherViewEncrypted = new CipherView(cipherEncrypted);
  const cipherViewResponse = new CipherResponse(cipherViewEncrypted);
  cipherViewResponse.id = cipherEncrypted.id;
  cipherViewResponse.name = cipherEncrypted.name?.encryptedString ?? "";
  cipherViewResponse.contact = new ContactApi();
  cipherViewResponse.contact.displayName =
    cipherEncrypted.contact.displayName?.encryptedString ?? "";
  cipherViewResponse.contact.initials = cipherEncrypted.contact.initials?.encryptedString ?? "";
  cipherViewResponse.contact.primaryEmail =
    cipherEncrypted.contact.primaryEmail?.encryptedString ?? "";
  cipherViewResponse.contact.primaryPhone =
    cipherEncrypted.contact.primaryPhone?.encryptedString ?? "";
  cipherViewResponse.favorite = cipherEncrypted.favorite;
  cipherViewResponse.creationDate = contact.cozyMetadata?.createdAt;
  cipherViewResponse.revisionDate = contact.cozyMetadata?.updatedAt;
  cipherViewResponse.fields = copyEncryptedFields(cipherEncrypted.fields ?? []);

  return cipherViewResponse;
};
