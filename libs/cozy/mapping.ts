import CozyClient, { Q } from "cozy-client";
import _ from "lodash";

import {
  AutofillFieldQualifier,
  AutofillFieldQualifierType,
} from "../../apps/browser/src/autofill/enums/autofill-field.enums";

export type CozyAttributesModel = {
  doctype: string;
  path: string;
  selector: {
    [key: string]: string;
  };
};

export type CozyAttributesMapping = {
  [key in AutofillFieldQualifierType]?: CozyAttributesModel;
};

export const COZY_ATTRIBUTES_MAPPING: CozyAttributesMapping = {
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

  if (cozyAttributeModel.doctype === "io.cozy.files") {
    return await getCozyValueInPaper({
      client,
      contactId,
      cozyAttributeModel,
    });
  }
};

interface GetCozyValueInPaperType {
  client: CozyClient;
  contactId: string;
  cozyAttributeModel: CozyAttributesModel;
}

const getCozyValueInPaper = async ({
  client,
  contactId,
  cozyAttributeModel,
}: GetCozyValueInPaperType) => {
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
