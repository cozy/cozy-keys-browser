import type CozyClient from "cozy-client";
import { Q } from "cozy-client";
import _ from "lodash";

import { AutofillFieldQualifierType } from "../../apps/browser/src/autofill/enums/autofill-field.enums";
import AutofillField from "../../apps/browser/src/autofill/models/autofill-field";
import { CozyProfile } from "../../apps/browser/src/autofill/services/abstractions/autofill.service";
import { PaperAutoFillConstants } from "../../apps/browser/src/autofill/services/autofill-constants";

import { COZY_ATTRIBUTES_MAPPING, CozyAttributesModel, FILTERS } from "./mapping";

interface GetCozyValueType {
  client: CozyClient;
  contactId: string;
  contactEmail?: string;
  me?: boolean;
  field?: AutofillField;
  fieldQualifier: AutofillFieldQualifierType;
  cozyProfile?: CozyProfile;
  filterName?: string;
}

export const getCozyValue = async ({
  client,
  contactId,
  contactEmail,
  me,
  field,
  fieldQualifier,
  cozyProfile,
  filterName,
}: GetCozyValueType): Promise<string | undefined> => {
  const cozyAttributeModel = COZY_ATTRIBUTES_MAPPING[fieldQualifier];

  if (!cozyAttributeModel) {
    return;
  }

  if (cozyAttributeModel.doctype === "io.cozy.contacts") {
    return await getCozyValueInContact({
      client,
      contactId,
      cozyAttributeModel,
      cozyProfile,
    });
  } else if (cozyAttributeModel.doctype === "io.cozy.files") {
    return await getCozyValueInPaper({
      client,
      contactId,
      contactEmail,
      me,
      cozyAttributeModel,
      cozyProfile,
      field,
      filterName,
    });
  }
};

interface GetCozyValueInDataType {
  client: CozyClient;
  contactId: string;
  contactEmail?: string;
  me?: boolean;
  cozyAttributeModel: CozyAttributesModel;
  cozyProfile?: CozyProfile;
  field?: AutofillField;
  filterName?: string;
}

const getCozyValueInContact = async ({
  client,
  contactId,
  cozyAttributeModel,
  cozyProfile,
}: GetCozyValueInDataType) => {
  const { data: contact } = await client.query(Q("io.cozy.contacts").getById(contactId), {
    executeFromStore: true,
  });

  if (cozyAttributeModel.isPathArray) {
    const dataArray = _.get(contact, cozyAttributeModel.path);

    const selectedData = selectDataWithCozyProfile(dataArray, cozyProfile);
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
  field,
  filterName,
}: GetCozyValueInDataType) => {
  const { data: papers } = await client.query(
    Q("io.cozy.files")
      .where({
        ...cozyAttributeModel.selector,
      })
      .sortBy([{ created_at: "desc" }]),
    { executeFromStore: true },
  );

  const papersFromContact = papers.filter(
    (paper: any) =>
      isReferencedByContact(paper, contactId) || // papers is from the contact asked
      // papers from konnectors do not have any contact relationship so we need something else
      paper.cozyMetadata?.sourceAccountIdentifier === contactEmail || // konnector id is equal to contact email
      (paper.cozyMetadata?.sourceAccount && me), // else we assign papers from konnectors to myself
  );

  let filteredPapers = papersFromContact;

  if (filterName === "yearFilter") {
    const yearFilterFunction = makeYearFilterFunction(field);

    filteredPapers = filteredPapers.filter(yearFilterFunction);
  }

  return _.get(filteredPapers[0], cozyAttributeModel.path);
};

export const selectDataWithCozyProfile = (data: any[] | undefined, cozyProfile?: CozyProfile) => {
  if (!data || data.length === 0) {
    return;
  }

  if (data.length === 1) {
    return data[0];
  }

  const type = cozyProfile?.type;
  const label = cozyProfile?.label;

  // If we clicked on a phone number with no type and label,
  // we want to autofill with this phone number and not evaluate the select data logic
  // that will finish by return the first phone number and not the phone number we clicked
  const matchingValueData = data.find(
    (d) =>
      (cozyProfile.number && cozyProfile.number === d.number) ||
      (cozyProfile.formattedAddress && cozyProfile.formattedAddress === d.formattedAddress) ||
      (cozyProfile.address && cozyProfile.address === d.address),
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
  return paper?.relationships?.referenced_by?.data?.find(
    (reference: any) => reference.id === contactId && reference.type === "io.cozy.contacts",
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
    const matches = field[paperAttribute]?.match(regex);

    if (matches) {
      return matches[0];
    }
  }
};
