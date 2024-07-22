import CozyClient, { models } from "cozy-client";
import { IOCozyContact } from "cozy-client/types/types";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CipherData } from "@bitwarden/common/vault/models/data/cipher.data";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { ContactView } from "@bitwarden/common/vault/models/view/contact.view";
import { IdentityView } from "@bitwarden/common/vault/models/view/identity.view";

const { getInitials } = models.contact;

import { AutofillFieldQualifier } from "../../apps/browser/src/autofill/enums/autofill-field.enums";
import { buildFieldsFromContact } from "./fields.helper";
import { getCozyValue } from "./mapping";

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
  key?: SymmetricCryptoKey,
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
  cipherView.fields = buildFieldsFromContact(i18nService, contact);
  cipherView.contact.me = contact.me;

  if (cozyMetadata?.favorite === undefined && contact.me) {
    cipherView.favorite = true;
  } else {
    cipherView.favorite = !!cozyMetadata?.favorite;
  }

  if (cozyMetadata?.createdAt) {
    cipherView.creationDate = new Date(cozyMetadata.createdAt);
  }
  if (cozyMetadata?.updatedAt) {
    cipherView.revisionDate = new Date(cozyMetadata.updatedAt);
  }

  const cipherEncrypted = await cipherService.encrypt(cipherView, key);

  const cipherData = cipherEncrypted.toCipherData();

  return cipherData;
};

export const generateIdentityViewFromContactId = async (client: CozyClient, contactId: string): Promise<IdentityView> => {
  const identity = new IdentityView();

  identity.firstName = await getCozyValue({
    client,
    contactId,
    fieldQualifier: AutofillFieldQualifier.identityFirstName,
  });
  identity.middleName = await getCozyValue({
    client,
    contactId,
    fieldQualifier: AutofillFieldQualifier.identityMiddleName,
  });
  identity.lastName = await getCozyValue({
    client,
    contactId,
    fieldQualifier: AutofillFieldQualifier.identityLastName,
  });
  identity.company = await getCozyValue({
    client,
    contactId,
    fieldQualifier: AutofillFieldQualifier.identityCompany,
  });

  identity.phone = await getCozyValue({
    client,
    contactId,
    fieldQualifier: AutofillFieldQualifier.identityPhone
  });
  identity.email = await getCozyValue({
    client,
    contactId,
    fieldQualifier: AutofillFieldQualifier.identityEmail
  });

  identity.address1 = await getCozyValue({
    client,
    contactId,
    fieldQualifier: AutofillFieldQualifier.identityAddress1
  });
  identity.city = await getCozyValue({
    client,
    contactId,
    fieldQualifier: AutofillFieldQualifier.identityCity
  });
  identity.state = await getCozyValue({
    client,
    contactId,
    fieldQualifier: AutofillFieldQualifier.identityState
  });
  identity.postalCode = await getCozyValue({
    client,
    contactId,
    fieldQualifier: AutofillFieldQualifier.identityPostalCode
  });
  identity.country = await getCozyValue({
    client,
    contactId,
    fieldQualifier: AutofillFieldQualifier.identityCountry
  });

  return identity;
};
