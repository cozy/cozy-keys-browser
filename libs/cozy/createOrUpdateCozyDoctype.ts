import CozyClient, { Q } from "cozy-client";
import { IOCozyContact } from "cozy-client/types/types";
import * as _ from "lodash";

import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { AutofillFieldQualifierType } from "../../apps/browser/src/autofill/enums/autofill-field.enums";

import { COZY_ATTRIBUTES_MAPPING, CozyAttributesModel } from "./mapping";

interface AutofillValue {
  value: string;
  type?: string;
  label?: string;
}

interface CreateOrUpdateCozyDoctypeType {
  client: CozyClient;
  cipher: CipherView;
  fieldQualifier: AutofillFieldQualifierType;
  newAutofillValue: AutofillValue;
}

export const createOrUpdateCozyDoctype = async ({
  client,
  cipher,
  fieldQualifier,
  newAutofillValue,
}: CreateOrUpdateCozyDoctypeType) => {
  const cozyAttributeModel = COZY_ATTRIBUTES_MAPPING[fieldQualifier];

  if (!cozyAttributeModel) {
    return;
  }

  if (cozyAttributeModel.doctype === "io.cozy.contacts") {
    const { data: contact } = (await client.query(Q("io.cozy.contacts").getById(cipher.id))) as {
      data: IOCozyContact;
    };

    // only update for the moment
    const updatedContact = await createOrUpdateCozyContact({
      contact,
      cozyAttributeModel,
      newAutofillValue,
    });

    await client.save(updatedContact);
  }
};

interface CreateOrUpdateCozyContactType {
  contact: IOCozyContact;
  cozyAttributeModel: CozyAttributesModel;
  newAutofillValue: AutofillValue;
}

export const createOrUpdateCozyContact = async ({
  contact,
  cozyAttributeModel,
  newAutofillValue,
}: CreateOrUpdateCozyContactType): Promise<IOCozyContact> => {
  // Address is not supported for the moment (it makes little sense to create an address with only one attribute like "rue principale")
  if (cozyAttributeModel.path === "address") {
    return;
  }

  if (cozyAttributeModel.isPathArray) {
    const arrayData = _.get(contact, cozyAttributeModel.path) || [];

    const newValueLabel = cozyAttributeModel.pathAttributes[0];

    const newValue = {
      [newValueLabel]: newAutofillValue.value,
      primary: !arrayData.length,
    };

    if (newAutofillValue.label) {
      newValue.label = newAutofillValue.label;
    }

    if (newAutofillValue.type) {
      newValue.type = newAutofillValue.type;
    }

    arrayData.push(newValue);

    _.set(contact, cozyAttributeModel.path, arrayData);
  } else {
    _.set(contact, cozyAttributeModel.path, newAutofillValue.value);
  }

  return contact;
};
