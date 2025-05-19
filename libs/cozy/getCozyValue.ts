import CozyClient, { Q } from "cozy-client";
import * as _ from "lodash";

import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { AutofillFieldQualifierType } from "../../apps/browser/src/autofill/enums/autofill-field.enums";
import AutofillField from "../../apps/browser/src/autofill/models/autofill-field";
import { CozyAutofillOptions } from "../../apps/browser/src/autofill/services/abstractions/autofill.service";

import { CONTACTS_DOCTYPE } from "./constants";
import {
  ContactAttributesModel,
  COZY_ATTRIBUTES_MAPPING,
  isContactAttributesModel,
} from "./mapping";

interface GetCozyValueType {
  client: CozyClient;
  cipher: CipherView;
  field?: AutofillField;
  fieldQualifier: AutofillFieldQualifierType;
  cozyAutofillOptions?: CozyAutofillOptions;
  filterName?: string;
}

export const getCozyValue = async ({
  client,
  cipher,
  fieldQualifier,
  cozyAutofillOptions,
}: GetCozyValueType): Promise<string | undefined> => {
  const cozyAttributeModel = COZY_ATTRIBUTES_MAPPING[fieldQualifier];

  if (!cozyAttributeModel) {
    return;
  }

  if (isContactAttributesModel(cozyAttributeModel)) {
    return await getCozyValueInContact({
      client,
      cipher,
      cozyAttributeModel,
      cozyAutofillOptions,
    });
  }
};

type GetCozyValueInDataType = {
  client: CozyClient;
  cipher: CipherView;
  cozyAutofillOptions?: CozyAutofillOptions;
};
type GetContactValueInDataType = GetCozyValueInDataType & {
  cozyAttributeModel: ContactAttributesModel;
};

const getCozyValueInContact = async ({
  client,
  cipher,
  cozyAttributeModel,
  cozyAutofillOptions,
}: GetContactValueInDataType) => {
  const { data: contact } = await client.query(Q(CONTACTS_DOCTYPE).getById(cipher.id), {
    executeFromStore: true,
  });

  let cozyValue;

  if (cozyAttributeModel.isPathArray) {
    const dataArray = _.get(contact, cozyAttributeModel.path);

    const selectedData = selectDataWithCozyProfile(dataArray, cozyAutofillOptions);

    cozyValue = _.get(selectedData, cozyAttributeModel.pathAttribute);
  } else {
    cozyValue = _.get(contact, cozyAttributeModel.path);
  }

  return cozyAttributeModel.postProcess ? cozyAttributeModel.postProcess(cozyValue) : cozyValue;
};

export const selectDataWithCozyProfile = (
  data: any[] | undefined,
  cozyAutofillOptions?: CozyAutofillOptions,
) => {
  if (!data || data.length === 0) {
    return;
  }

  if (data.length === 1) {
    return data[0];
  }

  const type = cozyAutofillOptions?.type;
  const label = cozyAutofillOptions?.label;

  // If we clicked on a phone number and we are selecting the phone number field,
  // we want this phone number whatever the type and label
  const matchingValueData = data.find(
    (d) =>
      cozyAutofillOptions?.value &&
      (cozyAutofillOptions.value === d.number ||
        cozyAutofillOptions.value === d.formattedAddress ||
        cozyAutofillOptions.value === d.address),
  );

  if (matchingValueData) {
    return matchingValueData;
  }

  const customLabelAndTypeAddress = data.find(
    (d) => d.label && d.label === label && d.type && d.type === type,
  );

  if (customLabelAndTypeAddress) {
    return customLabelAndTypeAddress;
  }

  const labelOnly = data.find((d) => d.label && d.label === label);

  if (labelOnly) {
    return labelOnly;
  }

  const randomLabelOnlyAddress = data.find((d) => d.label && !d.type);

  if (randomLabelOnlyAddress) {
    return randomLabelOnlyAddress;
  }

  const randomLabelAndTypeAddress = data.find((d) => d.label && d.type);

  if (randomLabelAndTypeAddress) {
    return randomLabelAndTypeAddress;
  }

  return data[0];
};
