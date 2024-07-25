import CozyClient, { Q } from "cozy-client";
import _ from "lodash";

import {
  AutofillFieldQualifier,
  AutofillFieldQualifierType,
} from "../../apps/browser/src/autofill/enums/autofill-field.enums";
import { CozyProfile } from "../../apps/browser/src/autofill/services/abstractions/autofill.service";

export type CozyAttributesModel = {
  doctype: string;
  path: string;
  isPathArray?: boolean;
  pathAttributes?: string[]; // pathAttibutess are joined to form the final value
  selector?: {
    [key: string]: string;
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
    selector: { "metadata.qualification.label": "tax_notice" },
  },
};

interface GetCozyValueType {
  client: CozyClient;
  contactId: string;
  fieldQualifier: AutofillFieldQualifierType;
  cozyProfile?: CozyProfile;
}

export const getCozyValue = async ({
  client,
  contactId,
  fieldQualifier,
  cozyProfile,
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
      cozyAttributeModel,
      cozyProfile,
    });
  }
};

interface GetCozyValueInDataType {
  client: CozyClient;
  contactId: string;
  cozyAttributeModel: CozyAttributesModel;
  cozyProfile?: CozyProfile;
}

const getCozyValueInContact = async ({
  client,
  contactId,
  cozyAttributeModel,
  cozyProfile,
}: GetCozyValueInDataType) => {
  // FIXME: Temporary way to query data. We want to avoid online request.
  const { data: contact } = await client.query(Q("io.cozy.contacts").getById(contactId));

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
  cozyAttributeModel,
}: GetCozyValueInDataType) => {
  // FIXME: Temporary way to query data. We want to avoid online request.
  const { data: papers } = await client.query(
    Q("io.cozy.files").where({
      ...cozyAttributeModel.selector,
    }),
  );

  const papersFromContact = papers.filter((paper: any) => isReferencedByContact(paper, contactId));

  return _.get(papersFromContact[0], cozyAttributeModel.path);
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

  const customLabelAndTypeAddress = data.find((d) => d.label === label && d.type === type);

  if (customLabelAndTypeAddress) {
    return customLabelAndTypeAddress;
  }

  const labelOnly = data.find((d) => d.label === label);

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
