import CozyClient, { Q } from "cozy-client";
import { IOCozyFile } from "cozy-client/types/types";
import * as _ from "lodash";

import { AutofillFieldQualifierType } from "../../apps/browser/src/autofill/enums/autofill-field.enums";
import AutofillField from "../../apps/browser/src/autofill/models/autofill-field";
import { CozyAutofillOptions } from "../../apps/browser/src/autofill/services/abstractions/autofill.service";
import { PaperAutoFillConstants } from "../../apps/browser/src/autofill/services/autofill-constants";

import { CONTACTS_DOCTYPE, FILES_DOCTYPE } from "./constants";
import {
  ContactAttributesModel,
  COZY_ATTRIBUTES_MAPPING,
  FILTERS,
  isContactAttributesModel,
  isPaperAttributesModel,
  PaperAttributesModel,
} from "./mapping";

interface GetCozyValueType {
  client: CozyClient;
  contactId: string;
  contactEmail?: string;
  me?: boolean;
  field?: AutofillField;
  fieldQualifier: AutofillFieldQualifierType;
  cozyAutofillOptions?: CozyAutofillOptions;
  filterName?: string;
}

export const getCozyValue = async ({
  client,
  contactId,
  contactEmail,
  me,
  field,
  fieldQualifier,
  cozyAutofillOptions,
  filterName,
}: GetCozyValueType): Promise<string | undefined> => {
  const cozyAttributeModel = COZY_ATTRIBUTES_MAPPING[fieldQualifier];

  if (!cozyAttributeModel) {
    return;
  }

  if (isContactAttributesModel(cozyAttributeModel)) {
    return await getCozyValueInContact({
      client,
      contactId,
      cozyAttributeModel,
      cozyAutofillOptions,
    });
  } else if (isPaperAttributesModel(cozyAttributeModel)) {
    return await getCozyValueInPaper({
      client,
      contactId,
      contactEmail,
      me,
      cozyAttributeModel,
      cozyAutofillOptions,
      field,
      filterName,
    });
  }
};

type GetCozyValueInDataType = {
  client: CozyClient;
  contactId: string;
  contactEmail?: string;
  me?: boolean;
  cozyAutofillOptions?: CozyAutofillOptions;
  field?: AutofillField;
  filterName?: string;
};
type GetPaperValueInDataType = GetCozyValueInDataType & {
  cozyAttributeModel: PaperAttributesModel;
};
type GetContactValueInDataType = GetCozyValueInDataType & {
  cozyAttributeModel: ContactAttributesModel;
};

const getCozyValueInContact = async ({
  client,
  contactId,
  cozyAttributeModel,
  cozyAutofillOptions,
}: GetContactValueInDataType) => {
  const { data: contact } = await client.query(Q(CONTACTS_DOCTYPE).getById(contactId), {
    executeFromStore: true,
  });

  if (cozyAttributeModel.isPathArray) {
    const dataArray = _.get(contact, cozyAttributeModel.path);

    const selectedData = selectDataWithCozyProfile(dataArray, cozyAutofillOptions);
    const selectedValue = cozyAttributeModel.pathAttributes
      .map((pathAttribute) => _.get(selectedData, pathAttribute))
      .join(" ");

    return selectedValue;
  } else {
    return _.get(contact, cozyAttributeModel.path);
  }
};

const getCozyValueInPaper = async ({
  client,
  contactId,
  contactEmail,
  me,
  cozyAttributeModel,
  cozyAutofillOptions,
  field,
  filterName,
}: GetPaperValueInDataType) => {
  let filteredPapers = await getAllPapersFromContact({
    client,
    contactId,
    contactEmail,
    me,
    cozyAttributeModel,
  });

  if (filterName === "yearFilter") {
    const yearFilterFunction = makeYearFilterFunction(field);

    filteredPapers = filteredPapers.filter(yearFilterFunction);
  }

  // Select the paper corresponding to the cozyAutofillOptions or the first one
  const selectedPaper = selectPaper({
    papers: filteredPapers,
    cozyAutofillOptions,
  });

  return _.get(selectedPaper, cozyAttributeModel.path);
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

  const papersFromContact = papers.filter((paper: any) =>
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

  // If we clicked on a phone number with no type and label,
  // we want to autofill with this phone number and not evaluate the select data logic
  // that will finish by return the first phone number and not the phone number we clicked
  const matchingValueData = data.find(
    (d) =>
      cozyAutofillOptions?.value &&
      (cozyAutofillOptions.value === d.number ||
        cozyAutofillOptions.value === d.formattedAddress ||
        cozyAutofillOptions.value === d.address),
  );

  if (!type && !label && matchingValueData) {
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

const makeYearFilterFunction = (field: AutofillField) => {
  const filter = FILTERS.yearFilter;

  const filterValue = getValueInField(field, filter.regex);

  return (data: any) =>
    filter.attributePath.some((path) => {
      let updatedFilterValue = filterValue;

      // Special case because tax_notice papers, for an "Avis d'imposition 2024 sur les revenus 2023" can be found by checking
      // - "issueDate": "2024-07-08T00:00:00.000Z"
      // - "referencedDate": "2023-01-01T23:00:00.000Z"
      if (path === "metadata.issueDate") {
        updatedFilterValue = (parseInt(updatedFilterValue, 10) + 1).toString();
      }

      return _.get(data, path)?.toString().indexOf(updatedFilterValue) >= 0;
    });
};

const getValueInField = (field: AutofillField, regex: string): any => {
  for (const paperAttribute of PaperAutoFillConstants.PaperAttributes) {
    // Special case for demande-logement-social.gouv.fr
    if (field.htmlID.includes("montantMoins1")) {
      return 2023;
    }
    if (field.htmlID.includes("montantMoins2")) {
      return 2022;
    }

    const matches = field[paperAttribute]?.match(regex);

    if (matches) {
      return matches[0];
    }
  }
};
