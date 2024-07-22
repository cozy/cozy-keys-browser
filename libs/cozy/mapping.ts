import CozyClient, { Q } from "cozy-client";
import _ from "lodash";

import {
  AutofillFieldQualifier,
  AutofillFieldQualifierType,
} from "../../apps/browser/src/autofill/enums/autofill-field.enums";

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
};

interface GetCozyValueType {
  client: CozyClient;
  contactId: string;
  fieldQualifier: AutofillFieldQualifierType;
}

export const getCozyValue = async ({
  client,
  contactId,
  fieldQualifier,
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
    });
  } else if (cozyAttributeModel.doctype === "io.cozy.files") {
    return await getCozyValueInPaper({
      client,
      contactId,
      cozyAttributeModel,
    });
  }
};

interface GetCozyValueInDataType {
  client: CozyClient;
  contactId: string;
  cozyAttributeModel: CozyAttributesModel;
}

const getCozyValueInContact = async ({
  client,
  contactId,
  cozyAttributeModel,
}: GetCozyValueInDataType) => {
  // FIXME: Temporary way to query data. We want to avoid online request.
  const { data: contact } = await client.query(
    Q("io.cozy.contacts").getById(contactId),
  );

 if(cozyAttributeModel.isPathArray) {
  const dataArray = _.get(contact, cozyAttributeModel.path);

  // TODO: take into account the profile instead of selecting the first one
  const selectedData = dataArray?.[0]
  const selectedValue = cozyAttributeModel.pathAttributes.map((pathAttribute) => _.get(selectedData, pathAttribute)).join(' ')

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

const isReferencedByContact = (paper: any, contactId: string) => {
  return paper?.relationships?.referenced_by?.data?.find(
    (reference: any) => reference.id === contactId && reference.type === "io.cozy.contacts",
  );
};
