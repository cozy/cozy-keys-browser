import CozyClient, { Q, models } from "cozy-client";
import type { IOCozyContact } from "cozy-client/types/types";
import * as _ from "lodash";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import type { InputRefValue } from "../../apps/browser/src/autofill/overlay/inline-menu/abstractions/autofill-inline-menu-list";

import { CONTACTS_DOCTYPE, FILES_DOCTYPE } from "./constants";
import { createOrUpdateCozyContactAddress } from "./contact.helper";
import { getOrCreateAppFolderWithReference } from "./helpers/folder";
import { createPDFWithText } from "./helpers/pdf";
import {
  areContactAttributesModels,
  arePaperAttributesModels,
  COZY_ATTRIBUTES_MAPPING,
  COZY_FIELDS_NAMES_MAPPING,
} from "./mapping";
import type {
  ContactAttributesModel,
  CozyContactFieldNames,
  PaperAttributesModel,
} from "./mapping";

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
  inputValues: InputRefValue;
  i18nService: I18nService;
  logService: LogService;
}

export const createOrUpdateCozyDoctype = async ({
  client,
  cipher,
  inputValues,
  i18nService,
  logService,
}: CreateOrUpdateCozyDoctypeType) => {
  const cozyAttributeModels = (Object.keys(inputValues) as CozyContactFieldNames[])
    .map((key) => COZY_ATTRIBUTES_MAPPING[COZY_FIELDS_NAMES_MAPPING[key]])
    .filter(Boolean);

  if (cozyAttributeModels.length === 0) {
    logService.error("No Cozy attribute model found for the given inputValues", inputValues);
    return;
  }

  const firstCozyAttributeModel = cozyAttributeModels[0];
  const isSameDoctype = cozyAttributeModels.every(
    (cozyAttributeModel) => cozyAttributeModel.doctype === firstCozyAttributeModel.doctype,
  );
  if (!isSameDoctype) {
    logService.error("All fields must be of the same doctype", inputValues);
    return;
  }

  const { data: contact } = (await client.query(Q(CONTACTS_DOCTYPE).getById(cipher.id))) as {
    data: IOCozyContact;
  };

  if (areContactAttributesModels(cozyAttributeModels)) {
    // only update for the moment
    const updatedContact = await createOrUpdateCozyContact({
      contact,
      cozyAttributeModels,
      inputValues,
    });

    await client.save(updatedContact);
  } else if (arePaperAttributesModels(cozyAttributeModels)) {
    // only create for the moment
    const createdPaper = await createOrUpdateCozyPaper({
      client,
      cozyAttributeModel: cozyAttributeModels[0],
      newAutofillValue: Object.values(inputValues)[0],
      i18nService,
      contact,
    });

    await client.save(createdPaper);
  }
};

interface CreateOrUpdateCozyContactType {
  contact: IOCozyContact;
  cozyAttributeModels: ContactAttributesModel[];
  inputValues: InputRefValue;
}

export const createOrUpdateCozyContact = async ({
  contact,
  cozyAttributeModels,
  inputValues,
}: CreateOrUpdateCozyContactType): Promise<IOCozyContact> => {
  if (cozyAttributeModels[0].path === "address") {
    return createOrUpdateCozyContactAddress(contact, cozyAttributeModels[0].path, inputValues);
  }

  for (const cozyAttributeModel of cozyAttributeModels) {
    if (cozyAttributeModel.isPathArray) {
      const arrayData = _.get(contact, cozyAttributeModel.path) || [];
      const newValueLabel = cozyAttributeModel.pathAttributes[0];

      const newValue = {
        [newValueLabel]: inputValues[cozyAttributeModel.name],
        ...(inputValues.label && { label: inputValues.label }),
        ...(inputValues.type && { type: inputValues.type }),
        primary: !arrayData.length,
      };

      arrayData.push(newValue);

      _.set(contact, cozyAttributeModel.path, arrayData);
    } else {
      _.set(contact, cozyAttributeModel.path, Object.values(inputValues)[0]);
    }
  }

  return contact;
};

interface CreateOrUpdateCozyPaperType {
  client: CozyClient;
  cozyAttributeModel: PaperAttributesModel;
  newAutofillValue: any;
  i18nService: I18nService;
  contact: IOCozyContact;
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
  const fileCollection = client.collection(FILES_DOCTYPE);
  const references = [
    {
      _id: contact._id,
      _type: CONTACTS_DOCTYPE,
    },
  ];

  await fileCollection.addReferencedBy(fileCreated, references);

  return fileCreated;
};
