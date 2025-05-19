import CozyClient, { Q } from "cozy-client";
import type { IOCozyContact } from "cozy-client/types/types";
import * as _ from "lodash";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { AutofillFieldQualifierType } from "../../apps/browser/src/autofill/enums/autofill-field.enums";
import type { InputValues } from "../../apps/browser/src/autofill/overlay/inline-menu/abstractions/autofill-inline-menu-list";

import { CONTACTS_DOCTYPE } from "./constants";
import { createOrUpdateCozyContactAddress } from "./contact.helper";
import { areContactAttributesModels, COZY_ATTRIBUTES_MAPPING } from "./mapping";
import type { ContactAttributesModel } from "./mapping";
export interface AutofillValue {
  value: string;
  type?: string;
  label?: string;
}

interface CreateOrUpdateCozyDoctypeType {
  client: CozyClient;
  cipher: CipherView;
  inputValues: InputValues;
  i18nService: I18nService;
  logService: LogService;
}

export const createOrUpdateCozyDoctype = async ({
  client,
  cipher,
  inputValues,
  i18nService,
  logService,
}: CreateOrUpdateCozyDoctypeType): Promise<any> => {
  const cozyAttributeModels = inputValues.values.map(
    ({ fieldQualifier }) => COZY_ATTRIBUTES_MAPPING[fieldQualifier as AutofillFieldQualifierType],
  );

  if (cozyAttributeModels.length === 0) {
    logService.error("No Cozy attribute model found for the given inputValues", inputValues);
    return;
  }

  const firstCozyAttributeModel = cozyAttributeModels[0];
  const isSameDoctype = cozyAttributeModels.every(
    (cozyAttributeModel) => cozyAttributeModel.doctype === firstCozyAttributeModel.doctype,
  );
  if (!isSameDoctype) {
    logService.error("All fields must be of the same doctype", inputValues);
    return;
  }

  const { data: contact } = (await client.query(Q(CONTACTS_DOCTYPE).getById(cipher.id))) as {
    data: IOCozyContact;
  };

  if (areContactAttributesModels(cozyAttributeModels)) {
    // only update for the moment
    const updatedContact = await createOrUpdateCozyContact({
      contact,
      cozyAttributeModels,
      inputValues,
    });

    const { data: res } = await client.save(updatedContact);

    return res;
  }
};

interface CreateOrUpdateCozyContactType {
  contact: IOCozyContact;
  cozyAttributeModels: ContactAttributesModel[];
  inputValues: InputValues;
}

export const createOrUpdateCozyContact = async ({
  contact,
  cozyAttributeModels,
  inputValues,
}: CreateOrUpdateCozyContactType): Promise<IOCozyContact> => {
  if (cozyAttributeModels[0].path === "address") {
    return createOrUpdateCozyContactAddress(contact, cozyAttributeModels[0].path, inputValues);
  }

  for (const inputValue of inputValues.values) {
    const cozyAttributeModel =
      COZY_ATTRIBUTES_MAPPING[inputValue.fieldQualifier as AutofillFieldQualifierType];

    if (cozyAttributeModel.isPathArray) {
      const arrayData = _.get(contact, cozyAttributeModel.path) || [];
      const newValueLabel = cozyAttributeModel.pathAttribute;

      const newValue = {
        [newValueLabel]: inputValue.value,
        ...(inputValues.label && { label: inputValues.label }),
        ...(inputValues.type && { type: inputValues.type }),
        primary: !arrayData.length,
      };

      arrayData.push(newValue);

      _.set(contact, cozyAttributeModel.path, arrayData);
    } else {
      _.set(contact, cozyAttributeModel.path, inputValue.value);
    }
  }

  return contact;
};
