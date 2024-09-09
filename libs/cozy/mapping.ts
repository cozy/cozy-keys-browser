import {
  AutofillFieldQualifier,
  AutofillFieldQualifierType,
} from "../../apps/browser/src/autofill/enums/autofill-field.enums";

export type CozyAttributesModel = {
  doctype: string;
  path: string;
  name: string;
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
  [AutofillFieldQualifier.identityFullName]: {
    doctype: "io.cozy.contacts",
    name: "displayName",
    path: "displayName",
  },
  [AutofillFieldQualifier.identityFirstName]: {
    doctype: "io.cozy.contacts",
    name: "givenName",
    path: "name.givenName",
  },
  [AutofillFieldQualifier.identityMiddleName]: {
    doctype: "io.cozy.contacts",
    name: "additionalName",
    path: "name.additionalName",
  },
  [AutofillFieldQualifier.identityLastName]: {
    doctype: "io.cozy.contacts",
    name: "familyName",
    path: "name.familyName",
  },
  [AutofillFieldQualifier.identityCompany]: {
    doctype: "io.cozy.contacts",
    name: "company",
    path: "company",
  },
  [AutofillFieldQualifier.identityPhone]: {
    doctype: "io.cozy.contacts",
    path: "phone",
    name: "phone",
    isPathArray: true,
    pathAttributes: ["number"],
  },
  [AutofillFieldQualifier.identityEmail]: {
    doctype: "io.cozy.contacts",
    path: "email",
    name: "email",
    isPathArray: true,
    pathAttributes: ["address"],
  },
  [AutofillFieldQualifier.identityAddress1]: {
    doctype: "io.cozy.contacts",
    path: "address",
    name: "address",
    isPathArray: true,
    pathAttributes: ["number", "street"],
  },
  [AutofillFieldQualifier.identityCity]: {
    doctype: "io.cozy.contacts",
    path: "address",
    name: "address",
    isPathArray: true,
    pathAttributes: ["city"],
  },
  [AutofillFieldQualifier.identityState]: {
    doctype: "io.cozy.contacts",
    path: "address",
    name: "address",
    isPathArray: true,
    pathAttributes: ["region"],
  },
  [AutofillFieldQualifier.identityPostalCode]: {
    doctype: "io.cozy.contacts",
    path: "address",
    name: "address",
    isPathArray: true,
    pathAttributes: ["code"],
  },
  [AutofillFieldQualifier.identityCountry]: {
    doctype: "io.cozy.contacts",
    path: "address",
    name: "address",
    isPathArray: true,
    pathAttributes: ["country"],
  },
  [AutofillFieldQualifier.paperIdentityCardNumber]: {
    doctype: "io.cozy.files",
    path: "metadata.number",
    name: "number",
    selector: { "metadata.qualification.label": "national_id_card" },
  },
  [AutofillFieldQualifier.paperPassportNumber]: {
    doctype: "io.cozy.files",
    path: "metadata.number",
    name: "number",
    selector: { "metadata.qualification.label": "passport" },
  },
  [AutofillFieldQualifier.paperSocialSecurityNumber]: {
    doctype: "io.cozy.files",
    path: "metadata.number",
    name: "number",
    selector: { "metadata.qualification.label": "national_health_insurance_card" },
  },
  [AutofillFieldQualifier.paperResidencePermitNumber]: {
    doctype: "io.cozy.files",
    path: "metadata.number",
    name: "number",
    selector: { "metadata.qualification.label": "residence_permit" },
  },
  [AutofillFieldQualifier.paperDrivingLicenseNumber]: {
    doctype: "io.cozy.files",
    path: "metadata.number",
    name: "number",
    selector: { "metadata.qualification.label": "driver_license" },
  },
  [AutofillFieldQualifier.paperVehicleRegistrationNumber]: {
    doctype: "io.cozy.files",
    path: "metadata.number",
    name: "number",
    selector: { "metadata.qualification.label": "vehicle_registration" },
  },
  [AutofillFieldQualifier.paperVehicleRegistrationConfidentialCode]: {
    doctype: "io.cozy.files",
    path: "metadata.vehicle.confidentialNumber",
    name: "confidentialNumber",
    selector: { "metadata.qualification.label": "vehicle_registration" },
  },
  [AutofillFieldQualifier.paperVehicleRegistrationLicensePlateNumber]: {
    doctype: "io.cozy.files",
    path: "metadata.vehicle.licenseNumber",
    name: "licenseNumber",
    selector: { "metadata.qualification.label": "vehicle_registration" },
  },
  [AutofillFieldQualifier.paperBankIbanNumber]: {
    doctype: "io.cozy.files",
    path: "metadata.number",
    name: "number",
    selector: { "metadata.qualification.label": "bank_details" },
  },
  [AutofillFieldQualifier.paperBankBicNumber]: {
    doctype: "io.cozy.files",
    path: "metadata.bicNumber",
    name: "bicNumber",
    selector: { "metadata.qualification.label": "bank_details" },
  },
  [AutofillFieldQualifier.paperGrossSalaryAmount]: {
    doctype: "io.cozy.files",
    path: "metadata.number",
    name: "number",
    selector: { "metadata.qualification.label": "pay_sheet" },
  },
  [AutofillFieldQualifier.paperNetSalaryAmount]: {
    doctype: "io.cozy.files",
    path: "metadata.netSocialAmount",
    name: "netSocialAmount",
    selector: { "metadata.qualification.label": "pay_sheet" },
  },
  [AutofillFieldQualifier.paperTaxNoticeNumber]: {
    doctype: "io.cozy.files",
    path: "metadata.number",
    name: "number",
    selector: { "metadata.qualification.label": "tax_notice" },
  },
  [AutofillFieldQualifier.paperTaxNoticeRefTaxIncome]: {
    doctype: "io.cozy.files",
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
