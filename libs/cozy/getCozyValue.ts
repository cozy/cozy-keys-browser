import CozyClient, { Q } from "cozy-client";
import { IOCozyFile } from "cozy-client/types/types";
import * as _ from "lodash";

import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { AutofillFieldQualifierType } from "../../apps/browser/src/autofill/enums/autofill-field.enums";
import AutofillField from "../../apps/browser/src/autofill/models/autofill-field";
import { CozyAutofillOptions } from "../../apps/browser/src/autofill/services/abstractions/autofill.service";

import { CONTACTS_DOCTYPE, FILES_DOCTYPE } from "./constants";
import {
  ContactAttributesModel,
  COZY_ATTRIBUTES_MAPPING,
  isContactAttributesModel,
  isPaperAttributesModel,
  PaperAttributesModel,
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
  } else if (isPaperAttributesModel(cozyAttributeModel)) {
    return await getCozyValueInPaper({
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
type GetPaperValueInDataType = GetCozyValueInDataType & {
  cozyAttributeModel: PaperAttributesModel;
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

const getCozyValueInPaper = async ({
  client,
  cipher,
  cozyAttributeModel,
  cozyAutofillOptions,
}: GetPaperValueInDataType) => {
  if (cipher.type === CipherType.Contact) {
    // If the cipher is a contact, we want to get the paper associated to the contact
    const filteredPapers = await getAllPapersFromContact({
      client,
      contactId: cipher.id,
      contactEmail: cipher.contact.primaryEmail,
      me: cipher.contact.me,
      cozyAttributeModel,
    });

    // Select the paper corresponding to the cozyAutofillOptions or the first one
    const selectedPaper = selectPaper({
      papers: filteredPapers,
      cozyAutofillOptions,
    });

    return _.get(selectedPaper, cozyAttributeModel.path);
  } else if (cipher.type === CipherType.Paper) {
    // If the cipher is a paper, we just want to get it and return the data
    const { data: paper } = await client.query(
      Q(FILES_DOCTYPE).where({
        _id: cipher.id,
        ...cozyAttributeModel.selector,
      }),
      { executeFromStore: true },
    );

    return paper.length > 0 && _.get(paper[0], cozyAttributeModel.path);
  }
};

export const selectPaper = ({
  papers,
  cozyAutofillOptions,
}: {
  papers: IOCozyFile[];
  cozyAutofillOptions?: CozyAutofillOptions;
}) => {
  const papersModels = Object.values(COZY_ATTRIBUTES_MAPPING).filter(
    (model) => model.doctype === FILES_DOCTYPE,
  );

  // Example: If we click on a BIC of value "BIC111111", we look in the papers
  // for the paper that have "BIC111111" as a value so that we can also
  // find the IBAN corresponding to the BIC
  const correspondingPaper = papers.find((paper) => {
    for (const paperModel of papersModels) {
      if (_.get(paper, paperModel.path) === cozyAutofillOptions?.value) {
        return true;
      }
    }

    return false;
  });

  return correspondingPaper || papers[0];
};

export const getAllPapersFromContact = async ({
  client,
  contactId,
  contactEmail,
  me,
  cozyAttributeModel,
}: {
  client: CozyClient;
  contactId: string;
  contactEmail?: string;
  me?: boolean;
  cozyAttributeModel: PaperAttributesModel;
}): Promise<IOCozyFile[]> => {
  const { data: papers } = await client.query(
    Q(FILES_DOCTYPE)
      .where({
        ...cozyAttributeModel.selector,
      })
      .sortBy([{ created_at: "desc" }]),
    { executeFromStore: true },
  );

  const papersWithData = papers.filter((paper: any) => !!_.get(paper, cozyAttributeModel.path));

  const papersFromContact = papersWithData.filter((paper: any) =>
    isPaperFromContact(paper, contactId, contactEmail, me),
  );

  return papersFromContact;
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

const isReferencedByContact = (paper: any, contactId: string) => {
  return paper?.relationships?.referenced_by?.data?.some(
    (reference: any) => reference.id === contactId && reference.type === CONTACTS_DOCTYPE,
  );
};

/**
 * Checks if a given paper belongs to a specified contact.
 *
 * Papers from konnectors do not have any contact relationship so we try to infere the paper owner with other data.
 *
 * @param {any} paper - The paper to check.
 * @param {string|undefined} contactId - The ID of the contact to check against.
 * @param {string|undefined} contactEmail - The email of the contact to check against.
 * @param {boolean} me - A flag indicating whether to check the contact is "me".
 * @returns {boolean} Returns true if the paper is from the specified contact.
 */
export const isPaperFromContact = (
  paper: any,
  contactId: string | undefined,
  contactEmail: string | undefined,
  me: boolean,
) => {
  return (
    isReferencedByContact(paper, contactId) ||
    (paper.cozyMetadata?.sourceAccountIdentifier &&
      paper.cozyMetadata.sourceAccountIdentifier === contactEmail) || // konnector login is equal to contact primary email
    !!(paper.cozyMetadata?.sourceAccount && me) // by default, we assign papers to "me"
  );
};
