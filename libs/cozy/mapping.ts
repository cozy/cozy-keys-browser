import {
  AutofillFieldQualifier,
  AutofillFieldQualifierType,
} from "../../apps/browser/src/autofill/enums/autofill-field.enums";

import { CONTACTS_DOCTYPE, FILES_DOCTYPE } from "./constants";

type CozyAttributesModel = {
  doctype: string;
  path: string;
  isPathArray?: boolean;
  pathAttributes?: string[]; // pathAttibutess are joined to form the final value
  selector?: {
    [key: string]: string | object;
  };
};

export type ContactAttributesModel = CozyAttributesModel & {
  name: CozyContactFieldNames;
};
export type PaperAttributesModel = CozyAttributesModel & {
  name: CozyPaperFieldNames;
};

export const isContactAttributesModel = (
  model: CozyAttributesModel,
): model is ContactAttributesModel => {
  return model.doctype === CONTACTS_DOCTYPE;
};
export const isPaperAttributesModel = (
  model: CozyAttributesModel,
): model is PaperAttributesModel => {
  return model.doctype === FILES_DOCTYPE;
};
export const areContactAttributesModels = (
  model: CozyAttributesModel[],
): model is ContactAttributesModel[] => {
  return model[0].doctype === CONTACTS_DOCTYPE;
};
export const arePaperAttributesModels = (
  model: CozyAttributesModel[],
): model is PaperAttributesModel[] => {
  return model[0].doctype === FILES_DOCTYPE;
};

export type CozyAttributesMapping = {
  [key in AutofillFieldQualifierType]?: ContactAttributesModel | PaperAttributesModel;
};
export type CozyPaperFieldNames =
  | "number"
  | "confidentialNumber"
  | "licenseNumber"
  | "bicNumber"
  | "netSocialAmount"
  | "refTaxIncome";
export type CozyContactFieldNames =
  | "number"
  | "address"
  | "street"
  | "code"
  | "city"
  | "region"
  | "locality"
  | "floor"
  | "stairs"
  | "apartment"
  | "building"
  | "entrycode"
  | "state"
  | "postalCode"
  | "country"
  | "phone"
  | "displayName"
  | "givenName"
  | "additionalName"
  | "familyName"
  | "company"
  | "email";

export type CozyFieldsNamesMapping = {
  [key in CozyContactFieldNames]: AutofillFieldQualifierType;

};

export const COZY_ATTRIBUTES_MAPPING: CozyAttributesMapping = {
  [AutofillFieldQualifier.identityFullName]: {
    doctype: CONTACTS_DOCTYPE,
    name: "displayName",
    path: "displayName",
  },
  [AutofillFieldQualifier.identityFirstName]: {
    doctype: CONTACTS_DOCTYPE,
    name: "givenName",
    path: "name.givenName",
  },
  [AutofillFieldQualifier.identityMiddleName]: {
    doctype: CONTACTS_DOCTYPE,
    name: "additionalName",
    path: "name.additionalName",
  },
  [AutofillFieldQualifier.identityLastName]: {
    doctype: CONTACTS_DOCTYPE,
    name: "familyName",
    path: "name.familyName",
  },
  [AutofillFieldQualifier.identityCompany]: {
    doctype: CONTACTS_DOCTYPE,
    name: "company",
    path: "company",
  },
  [AutofillFieldQualifier.identityPhone]: {
    doctype: CONTACTS_DOCTYPE,
    path: "phone",
    name: "phone",
    isPathArray: true,
    pathAttributes: ["number"],
  },
  [AutofillFieldQualifier.identityEmail]: {
    doctype: CONTACTS_DOCTYPE,
    path: "email",
    name: "email",
    isPathArray: true,
    pathAttributes: ["address"],
  },
  [AutofillFieldQualifier.identityAddress1]: {
    doctype: CONTACTS_DOCTYPE,
    path: "address",
    name: "address",
    isPathArray: true,
    pathAttributes: ["number", "street"],
  },
  [AutofillFieldQualifier.identityCity]: {
    doctype: CONTACTS_DOCTYPE,
    path: "address",
    name: "city",
    isPathArray: true,
    pathAttributes: ["city"],
  },
  [AutofillFieldQualifier.identityState]: {
    doctype: CONTACTS_DOCTYPE,
    path: "address",
    name: "state",
    isPathArray: true,
    pathAttributes: ["region"],
  },
  [AutofillFieldQualifier.identityPostalCode]: {
    doctype: CONTACTS_DOCTYPE,
    path: "address",
    name: "postalCode",
    isPathArray: true,
    pathAttributes: ["code"],
  },
  [AutofillFieldQualifier.identityCountry]: {
    doctype: CONTACTS_DOCTYPE,
    path: "address",
    name: "country",
    isPathArray: true,
    pathAttributes: ["country"],
  },
  [AutofillFieldQualifier.addressLocality]: {
    doctype: CONTACTS_DOCTYPE,
    path: "address",
    name: "locality",
    isPathArray: true,
    pathAttributes: ["extendedAddress.locality"],
  },
  [AutofillFieldQualifier.addressFloor]: {
    doctype: CONTACTS_DOCTYPE,
    path: "address",
    name: "floor",
    isPathArray: true,
    pathAttributes: ["extendedAddress.floor"],
  },
  [AutofillFieldQualifier.addressBuilding]: {
    doctype: CONTACTS_DOCTYPE,
    path: "address",
    name: "building",
    isPathArray: true,
    pathAttributes: ["extendedAddress.building"],
  },
  [AutofillFieldQualifier.addressStairs]: {
    doctype: CONTACTS_DOCTYPE,
    path: "address",
    name: "stairs",
    isPathArray: true,
    pathAttributes: ["extendedAddress.stairs"],
  },
  [AutofillFieldQualifier.addressApartment]: {
    doctype: CONTACTS_DOCTYPE,
    path: "address",
    name: "apartment",
    isPathArray: true,
    pathAttributes: ["extendedAddress.apartment"],
  },
  [AutofillFieldQualifier.addressEntrycode]: {
    doctype: CONTACTS_DOCTYPE,
    path: "address",
    name: "entrycode",
    isPathArray: true,
    pathAttributes: ["extendedAddress.entrycode"],
  },
  [AutofillFieldQualifier.paperIdentityCardNumber]: {
    doctype: FILES_DOCTYPE,
    path: "metadata.number",
    name: "number",
    selector: { "metadata.qualification.label": "national_id_card" },
  },
  [AutofillFieldQualifier.paperPassportNumber]: {
    doctype: FILES_DOCTYPE,
    path: "metadata.number",
    name: "number",
    selector: { "metadata.qualification.label": "passport" },
  },
  [AutofillFieldQualifier.paperSocialSecurityNumber]: {
    doctype: FILES_DOCTYPE,
    path: "metadata.number",
    name: "number",
    selector: { "metadata.qualification.label": "national_health_insurance_card" },
  },
  [AutofillFieldQualifier.paperResidencePermitNumber]: {
    doctype: FILES_DOCTYPE,
    path: "metadata.number",
    name: "number",
    selector: { "metadata.qualification.label": "residence_permit" },
  },
  [AutofillFieldQualifier.paperDrivingLicenseNumber]: {
    doctype: FILES_DOCTYPE,
    path: "metadata.number",
    name: "number",
    selector: { "metadata.qualification.label": "driver_license" },
  },
  [AutofillFieldQualifier.paperVehicleRegistrationNumber]: {
    doctype: FILES_DOCTYPE,
    path: "metadata.number",
    name: "number",
    selector: { "metadata.qualification.label": "vehicle_registration" },
  },
  [AutofillFieldQualifier.paperVehicleRegistrationConfidentialCode]: {
    doctype: FILES_DOCTYPE,
    path: "metadata.vehicle.confidentialNumber",
    name: "confidentialNumber",
    selector: { "metadata.qualification.label": "vehicle_registration" },
  },
  [AutofillFieldQualifier.paperVehicleRegistrationLicensePlateNumber]: {
    doctype: FILES_DOCTYPE,
    path: "metadata.vehicle.licenseNumber",
    name: "licenseNumber",
    selector: { "metadata.qualification.label": "vehicle_registration" },
  },
  [AutofillFieldQualifier.paperBankIbanNumber]: {
    doctype: FILES_DOCTYPE,
    path: "metadata.number",
    name: "number",
    selector: { "metadata.qualification.label": "bank_details" },
  },
  [AutofillFieldQualifier.paperBankBicNumber]: {
    doctype: FILES_DOCTYPE,
    path: "metadata.bicNumber",
    name: "bicNumber",
    selector: { "metadata.qualification.label": "bank_details" },
  },
  [AutofillFieldQualifier.paperGrossSalaryAmount]: {
    doctype: FILES_DOCTYPE,
    path: "metadata.number",
    name: "number",
    selector: { "metadata.qualification.label": "pay_sheet" },
  },
  [AutofillFieldQualifier.paperNetSalaryAmount]: {
    doctype: FILES_DOCTYPE,
    path: "metadata.netSocialAmount",
    name: "netSocialAmount",
    selector: { "metadata.qualification.label": "pay_sheet" },
  },
  [AutofillFieldQualifier.paperTaxNoticeNumber]: {
    doctype: FILES_DOCTYPE,
    path: "metadata.number",
    name: "number",
    selector: { "metadata.qualification.label": "tax_notice" },
  },
  [AutofillFieldQualifier.paperTaxNoticeRefTaxIncome]: {
    doctype: FILES_DOCTYPE,
    path: "metadata.refTaxIncome",
    name: "refTaxIncome",
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
