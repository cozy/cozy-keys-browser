import CozyClient, { Q, models } from "cozy-client";
import { IOCozyContact } from "cozy-client/types/types";
import * as _ from "lodash";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { AutofillFieldQualifierType } from "../../apps/browser/src/autofill/enums/autofill-field.enums";

import { getOrCreateAppFolderWithReference } from "./helpers/folder";
import { createPDFWithText } from "./helpers/pdf";
import { COZY_ATTRIBUTES_MAPPING, CozyAttributesModel } from "./mapping";

const {
  document: { Qualification, locales },
  file: { uploadFileWithConflictStrategy },
} = models;

export interface AutofillValue {
  value: string;
  type?: string;
  label?: string;
}

interface CreateOrUpdateCozyDoctypeType {
  client: CozyClient;
  cipher: CipherView;
  fieldQualifier: AutofillFieldQualifierType;
  newAutofillValue: AutofillValue;
  i18nService: I18nService;
}

export const createOrUpdateCozyDoctype = async ({
  client,
  cipher,
  fieldQualifier,
  newAutofillValue,
  i18nService,
}: CreateOrUpdateCozyDoctypeType) => {
  const cozyAttributeModel = COZY_ATTRIBUTES_MAPPING[fieldQualifier];

  if (!cozyAttributeModel) {
    return;
  }

  const { data: contact } = (await client.query(Q("io.cozy.contacts").getById(cipher.id))) as {
    data: IOCozyContact;
  };

  if (cozyAttributeModel.doctype === "io.cozy.contacts") {
    // only update for the moment
    const updatedContact = await createOrUpdateCozyContact({
      contact,
      cozyAttributeModel,
      newAutofillValue,
    });

    await client.save(updatedContact);
  } else if (cozyAttributeModel.doctype === "io.cozy.files") {
    // only create for the moment
    const createdPaper = await createOrUpdateCozyPaper({
      client,
      cozyAttributeModel,
      newAutofillValue,
      i18nService,
      contact,
    });

    await client.save(createdPaper);
  }
};

interface CreateOrUpdateCozyContactType {
  contact: IOCozyContact;
  cozyAttributeModel: CozyAttributesModel;
  newAutofillValue: AutofillValue;
}

export const createOrUpdateCozyContact = async ({
  contact,
  cozyAttributeModel,
  newAutofillValue,
}: CreateOrUpdateCozyContactType): Promise<IOCozyContact> => {
  // Address is not supported for the moment (it makes little sense to create an address with only one attribute like "rue principale")
  if (cozyAttributeModel.path === "address") {
    return;
  }

  if (cozyAttributeModel.isPathArray) {
    const arrayData = _.get(contact, cozyAttributeModel.path) || [];

    const newValueLabel = cozyAttributeModel.pathAttributes[0];

    const newValue = {
      [newValueLabel]: newAutofillValue.value,
      primary: !arrayData.length,
    };

    if (newAutofillValue.label) {
      newValue.label = newAutofillValue.label;
    }

    if (newAutofillValue.type) {
      newValue.type = newAutofillValue.type;
    }

    arrayData.push(newValue);

    _.set(contact, cozyAttributeModel.path, arrayData);
  } else {
    _.set(contact, cozyAttributeModel.path, newAutofillValue.value);
  }

  return contact;
};

interface CreateOrUpdateCozyPaperType {
  client: CozyClient;
  cozyAttributeModel: CozyAttributesModel;
  newAutofillValue: AutofillValue;
  i18nService: I18nService;
  contact: IOCozyContact,
}

export const createOrUpdateCozyPaper = async ({
  client,
  cozyAttributeModel,
  newAutofillValue,
  i18nService,
  contact,
}: CreateOrUpdateCozyPaperType): Promise<any> => {
  const [, qualificationLabelValue] = Object.entries(cozyAttributeModel.selector)[0];

  const qualification = Qualification.getByLabel(qualificationLabelValue as string);

  // Create the PDF
  const pdfText = `${qualificationLabelValue} ${newAutofillValue.value}`;
  const pdfBytes = await createPDFWithText(pdfText);

  // Build the io.cozy.files document
  const dir = await getOrCreateAppFolderWithReference(client, i18nService);

  const t = locales.getBoundT(i18nService.translationLocale || "en");

  const paperOptions = {
    name: t(`Scan.items.${qualification.label}`) + ".pdf",
    contentType: "application/pdf",
    metadata: {
      qualification,
      paperProps: {
        isBlank: true,
      },
    },
    dirId: dir._id,
    conflictStrategy: "rename",
  };

  _.set(paperOptions, cozyAttributeModel.path, newAutofillValue.value);

  const { data: fileCreated } = await uploadFileWithConflictStrategy(
    client,
    pdfBytes,
    paperOptions,
  );

  // Add contact
  const fileCollection = client.collection('io.cozy.files')
  const references = [{
    _id: contact._id,
    _type: 'io.cozy.contacts'
  }]

  await fileCollection.addReferencedBy(fileCreated, references)

  return fileCreated;
};
