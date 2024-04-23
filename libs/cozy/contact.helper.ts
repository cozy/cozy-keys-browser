import { models } from "cozy-client";
import { IOCozyContact } from "cozy-client/types/types";

import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { SymmetricCryptoKey } from "@bitwarden/common/models/domain/symmetric-crypto-key";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CipherData } from "@bitwarden/common/vault/models/data/cipher.data";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { ContactView } from "@bitwarden/common/vault/models/view/contact.view";
import { IdentityView } from "@bitwarden/common/vault/models/view/identity.view";

const { getInitials } = models.contact;

import { buildFieldsFromContact } from "./fields.helper";

const getPrimaryEmail = (contact: IOCozyContact): string | undefined => {
  return contact.email?.find((email) => email.primary)?.address;
};

const getPrimaryPhone = (contact: IOCozyContact): string | undefined => {
  return contact.phone?.find((phone) => phone.primary)?.number;
};

export const convertContactToCipherData = async (
  cipherService: CipherService,
  i18nService: I18nService,
  contact: IOCozyContact,
  key?: SymmetricCryptoKey
): Promise<CipherData> => {
  // Temporary type fix because contact.cozyMetadata is not properly typed
  const cozyMetadata = contact.cozyMetadata as any;

  const cipherView = new CipherView();
  cipherView.id = contact.id ?? contact._id;
  cipherView.name = contact.displayName;
  cipherView.type = CipherType.Contact;
  cipherView.contact = new ContactView();
  cipherView.contact.displayName = contact.displayName;
  cipherView.contact.initials = getInitials(contact);
  cipherView.contact.primaryEmail = getPrimaryEmail(contact);
  cipherView.contact.primaryPhone = getPrimaryPhone(contact);
  cipherView.favorite = !!cozyMetadata?.favorite;
  cipherView.fields = buildFieldsFromContact(i18nService, contact);
  cipherView.contact.me = contact.me;
  cipherView.creationDate = new Date(cozyMetadata?.createdAt);
  cipherView.revisionDate = new Date(cozyMetadata?.updatedAt);

  const cipherEncrypted = await cipherService.encrypt(cipherView, key);

  const cipherData = cipherEncrypted.toCipherData();

  return cipherData;
};

export const generateIdentityViewFromCipherView = (cipher: CipherView): IdentityView => {
  const identity = new IdentityView();

  identity.firstName = cipher.fields.find((f) => f.cozyType === "givenName")?.value;
  identity.lastName = cipher.fields.find((f) => f.cozyType === "familyName")?.value;
  identity.company = cipher.fields.find((f) => f.cozyType === "company")?.value;
  identity.phone = cipher.contact.primaryPhone;
  identity.email = cipher.contact.primaryEmail;

  const chosenAddress = cipher.fields.find((f) => f.cozyType === "address");

  if (chosenAddress) {
    identity.address1 =
      cipher.fields.find((f) => f.parentId === chosenAddress.id && f.cozyType === "number")?.value +
      " " +
      cipher.fields.find((f) => f.parentId === chosenAddress.id && f.cozyType === "street")?.value;
    identity.city = cipher.fields.find(
      (f) => f.parentId === chosenAddress.id && f.cozyType === "city"
    )?.value;
    identity.state = cipher.fields.find(
      (f) => f.parentId === chosenAddress.id && f.cozyType === "region"
    )?.value;
    identity.postalCode = cipher.fields.find(
      (f) => f.parentId === chosenAddress.id && f.cozyType === "code"
    )?.value;
    identity.country = cipher.fields.find(
      (f) => f.parentId === chosenAddress.id && f.cozyType === "country"
    )?.value;
  }

  return identity;
};
