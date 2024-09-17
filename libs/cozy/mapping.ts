import CozyClient, { Q } from "cozy-client";
import _ from "lodash";

import {
  AutofillFieldQualifier,
  AutofillFieldQualifierType,
} from "../../apps/browser/src/autofill/enums/autofill-field.enums";
import AutofillField from "../../apps/browser/src/autofill/models/autofill-field";
import { CozyProfile } from "../../apps/browser/src/autofill/services/abstractions/autofill.service";
import { PaperAutoFillConstants } from "../../apps/browser/src/autofill/services/autofill-constants";

export type CozyAttributesModel = {
  doctype: string;
  path: string;
  isPathArray?: boolean;
  pathAttributes?: string[]; // pathAttibutess are joined to form the final value
  selector?: {
    [key: string]: string | object;
  };
};

export type CozyAttributesMapping = {
  [key in AutofillFieldQualifierType]?: CozyAttributesModel;
};

export const COZY_ATTRIBUTES_MAPPING: CozyAttributesMapping = {
  [AutofillFieldQualifier.identityFirstName]: {
    doctype: "io.cozy.contacts",
    path: "name.givenName",
  },
  [AutofillFieldQualifier.identityMiddleName]: {
    doctype: "io.cozy.contacts",
    path: "name.additionalName",
  },
  [AutofillFieldQualifier.identityLastName]: {
    doctype: "io.cozy.contacts",
    path: "name.familyName",
  },
  [AutofillFieldQualifier.identityCompany]: {
    doctype: "io.cozy.contacts",
    path: "company",
  },
  [AutofillFieldQualifier.identityPhone]: {
    doctype: "io.cozy.contacts",
    path: "phone",
    isPathArray: true,
    pathAttributes: ["number"],
  },
  [AutofillFieldQualifier.identityEmail]: {
    doctype: "io.cozy.contacts",
    path: "email",
    isPathArray: true,
    pathAttributes: ["address"],
  },
  [AutofillFieldQualifier.identityAddress1]: {
    doctype: "io.cozy.contacts",
    path: "address",
    isPathArray: true,
    pathAttributes: ["number", "street"],
  },
  [AutofillFieldQualifier.identityCity]: {
    doctype: "io.cozy.contacts",
    path: "address",
    isPathArray: true,
    pathAttributes: ["city"],
  },
  [AutofillFieldQualifier.identityState]: {
    doctype: "io.cozy.contacts",
    path: "address",
    isPathArray: true,
    pathAttributes: ["region"],
  },
  [AutofillFieldQualifier.identityPostalCode]: {
    doctype: "io.cozy.contacts",
    path: "address",
    isPathArray: true,
    pathAttributes: ["code"],
  },
  [AutofillFieldQualifier.identityCountry]: {
    doctype: "io.cozy.contacts",
    path: "address",
    isPathArray: true,
    pathAttributes: ["country"],
  },
  [AutofillFieldQualifier.paperIdentityCardNumber]: {
    doctype: "io.cozy.files",
    path: "metadata.number",
    selector: { "metadata.qualification.label": "national_id_card" },
  },
  [AutofillFieldQualifier.paperPassportNumber]: {
    doctype: "io.cozy.files",
    path: "metadata.number",
    selector: { "metadata.qualification.label": "passport" },
  },
  [AutofillFieldQualifier.paperSocialSecurityNumber]: {
    doctype: "io.cozy.files",
    path: "metadata.number",
    selector: { "metadata.qualification.label": "national_health_insurance_card" },
  },
  [AutofillFieldQualifier.paperResidencePermitNumber]: {
    doctype: "io.cozy.files",
    path: "metadata.number",
    selector: { "metadata.qualification.label": "residence_permit" },
  },
  [AutofillFieldQualifier.paperDrivingLicenseNumber]: {
    doctype: "io.cozy.files",
    path: "metadata.number",
    selector: { "metadata.qualification.label": "driver_license" },
  },
  [AutofillFieldQualifier.paperVehicleRegistrationNumber]: {
    doctype: "io.cozy.files",
    path: "metadata.number",
    selector: { "metadata.qualification.label": "vehicle_registration" },
  },
  [AutofillFieldQualifier.paperVehicleRegistrationConfidentialCode]: {
    doctype: "io.cozy.files",
    path: "metadata.vehicle.confidentialNumber",
    selector: { "metadata.qualification.label": "vehicle_registration" },
  },
  [AutofillFieldQualifier.paperVehicleRegistrationLicensePlateNumber]: {
    doctype: "io.cozy.files",
    path: "metadata.vehicle.licenseNumber",
    selector: { "metadata.qualification.label": "vehicle_registration" },
  },
  [AutofillFieldQualifier.paperBankIbanNumber]: {
    doctype: "io.cozy.files",
    path: "metadata.number",
    selector: { "metadata.qualification.label": "bank_details" },
  },
  [AutofillFieldQualifier.paperBankBicNumber]: {
    doctype: "io.cozy.files",
    path: "metadata.bicNumber",
    selector: { "metadata.qualification.label": "bank_details" },
  },
  [AutofillFieldQualifier.paperGrossSalaryAmount]: {
    doctype: "io.cozy.files",
    path: "metadata.number",
    selector: { "metadata.qualification.label": "pay_sheet" },
  },
  [AutofillFieldQualifier.paperNetSalaryAmount]: {
    doctype: "io.cozy.files",
    path: "metadata.netSocialAmount",
    selector: { "metadata.qualification.label": "pay_sheet" },
  },
  [AutofillFieldQualifier.paperTaxNoticeNumber]: {
    doctype: "io.cozy.files",
    path: "metadata.number",
    selector: { "metadata.qualification.label": "tax_notice" },
  },
  [AutofillFieldQualifier.paperTaxNoticeRefTaxIncome]: {
    doctype: "io.cozy.files",
    path: "metadata.refTaxIncome",
    selector: {
      "metadata.qualification.label": "tax_notice",
      "metadata.refTaxIncome": { $gt: null }, // some tax notice do not have ref tax income set
    },
  },
};

// When a contact has multiple papers matching the mapping, it will by default return the first one
// Otherwise, we can now use filters to select a paper among other
export const FILTERS = {
  yearFilter: {
    regex: "20[0-9][0-9]", // the value we match in the autofill field
    attributePath: ["metadata.referencedDate", "metadata.issueDate"], // where we look for the value matched in "regex" attribute
  },
};

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

  const papersFromContact = papers.filter((paper: any) =>
    isPaperFromContact(paper, contactId, contactEmail, me),
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

const isReferencedByContact = (paper: any, contactId: string): boolean => {
  return paper?.relationships?.referenced_by?.data?.some(
    (reference: any) => reference.id === contactId && reference.type === "io.cozy.contacts",
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
