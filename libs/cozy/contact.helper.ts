import CozyClient, { models } from "cozy-client";
import { IOCozyContact } from "cozy-client/types/types";
import get from "lodash/get";
import set from "lodash/set";

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
import { InputRefValue } from "../../apps/browser/src/autofill/overlay/inline-menu/abstractions/autofill-inline-menu-list";
import { CozyAutofillOptions } from "../../apps/browser/src/autofill/services/abstractions/autofill.service";

import { extendedAddressFields } from "./contact.lib";
import { buildFieldsFromContact } from "./fields.helper";
import { getCozyValue } from "./getCozyValue";

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

export const generateIdentityViewFromContactId = async (
  client: CozyClient,
  contactId: string,
  cozyAutofillOptions?: CozyAutofillOptions,
): Promise<IdentityView> => {
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
    fieldQualifier: AutofillFieldQualifier.identityPhone,
    cozyAutofillOptions,
  });
  identity.email = await getCozyValue({
    client,
    contactId,
    fieldQualifier: AutofillFieldQualifier.identityEmail,
    cozyAutofillOptions,
  });

  identity.address1 = await getCozyValue({
    client,
    contactId,
    fieldQualifier: AutofillFieldQualifier.identityAddress1,
    cozyAutofillOptions,
  });
  identity.city = await getCozyValue({
    client,
    contactId,
    fieldQualifier: AutofillFieldQualifier.identityCity,
    cozyAutofillOptions,
  });
  identity.state = await getCozyValue({
    client,
    contactId,
    fieldQualifier: AutofillFieldQualifier.identityState,
    cozyAutofillOptions,
  });
  identity.postalCode = await getCozyValue({
    client,
    contactId,
    fieldQualifier: AutofillFieldQualifier.identityPostalCode,
    cozyAutofillOptions,
  });
  identity.country = await getCozyValue({
    client,
    contactId,
    fieldQualifier: AutofillFieldQualifier.identityCountry,
    cozyAutofillOptions,
  });

  return identity;
};

export const cleanFormattedAddress = (address: { [key: string]: string }) => {
  const formattedAddress = `${address.number} ${address.street}, ${address.code} ${address.city}, ${address.country}`;
  // Replace all spaces by one space, to fix cases where there are multiple spaces
  // Replace commas that have a space before
  // And remove all spaces before & after the string
  let formattedAddressClean = formattedAddress.replace(/\s+/g, " ").replace(/\s,/g, "").trim();

  // Case where a comma is the last character
  if (formattedAddressClean.lastIndexOf(",") === formattedAddressClean.length - 1) {
    formattedAddressClean = formattedAddressClean.slice(0, formattedAddressClean.length - 1);
  }

  // Case where a comma is the first character
  if (formattedAddressClean.indexOf(",") === 0) {
    formattedAddressClean = formattedAddressClean.slice(1);
  }

  return formattedAddressClean;
};

export const hasExtendedAddress = (addressField: InputRefValue) => {
  if (!addressField) {
    return false;
  }
  return Object.keys(addressField).some((ext) => extendedAddressFields.includes(ext));
};

export const createOrUpdateCozyContactAddress = (
  contact: IOCozyContact,
  path: string,
  inputValues: InputRefValue,
) => {
  const arrayData = get(contact, path) || [];
  const formattedAddress = cleanFormattedAddress(inputValues);

  const cozyAddress = {
    primary: !arrayData.length,
    formattedAddress,
    ...(inputValues.number && { number: inputValues.number }),
    ...(inputValues.street && { street: inputValues.street }),
    ...(inputValues.code && { code: inputValues.code }),
    ...(inputValues.city && { city: inputValues.city }),
    ...(inputValues.region && { region: inputValues.region }),
    ...(inputValues.country && { country: inputValues.country }),
    ...(inputValues.label && { label: inputValues.label }),
    ...(inputValues.type && { type: inputValues.type }),
    ...(hasExtendedAddress(inputValues) && {
      extendedAddress: {
        ...(inputValues.locality && { locality: inputValues.locality }),
        ...(inputValues.building && { building: inputValues.building }),
        ...(inputValues.stairs && { stairs: inputValues.stairs }),
        ...(inputValues.floor && { floor: inputValues.floor }),
        ...(inputValues.apartment && { apartment: inputValues.apartment }),
        ...(inputValues.entrycode && { entrycode: inputValues.entrycode }),
      },
    }),
  };
  arrayData.push(cozyAddress);

  set(contact, path, arrayData);

  return contact;
};
