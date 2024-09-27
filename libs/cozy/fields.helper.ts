import { models } from "cozy-client";
import { IOCozyContact } from "cozy-client/types/types";

import { FieldSubType } from "@bitwarden/common/enums/fieldSubType";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { FieldType } from "@bitwarden/common/vault/enums";
import { ExpirationDateData } from "@bitwarden/common/vault/models/data/expiration-date.data";
import { LabelData } from "@bitwarden/common/vault/models/data/label.data";
import { FieldView } from "@bitwarden/common/vault/models/view/field.view";

import {
  fields as fieldsModels,
  getTranslatedNameForContactField,
  getFormattedValueForContactField,
  extendedAddressFields,
} from "./contact.lib";

const {
  formatMetadataQualification,
  getMetadataQualificationType,
  getTranslatedNameForDateMetadata,
  formatDateMetadataValue,
  getTranslatedNameForInformationMetadata,
  formatInformationMetadataValue,
  getTranslatedNameForOtherMetadata,
  formatOtherMetadataValue,
  getTranslatedNameForContact,
  formatContactValue,
  isExpired,
  isExpiringSoon,
} = models.paper;

interface FieldOptions {
  id?: string;
  parentId?: string;
  subtype?: FieldSubType;
  cozyType?: string;
  expirationData?: ExpirationDateData;
  label?: LabelData;
}

// Helpers

export const buildField = (name: string, value: string, options: FieldOptions = {}): FieldView => {
  const field = new FieldView();
  field.type = FieldType.Text;
  field.id = options.id;
  field.parentId = options.parentId;
  field.subtype = options.subtype ?? FieldSubType.Default;
  field.cozyType = options.cozyType;
  field.expirationData = options.expirationData;
  field.label = options.label;
  field.name = name;
  field.value = value;
  return field;
};

// Paper fields

export const buildFieldsFromPaper = (i18nService: I18nService, paper: any): FieldView[] => {
  const fields: FieldView[] = [];

  const qualificationLabels = formatMetadataQualification(paper.metadata);
  const qualificationLabel = paper.metadata.qualification.label;

  // @ts-expect-error I did not succeed in getting i18nService.translationLocale so I fallback to a private property
  const lang = i18nService.systemLanguage;

  const f = (a: string) => {
    return new Date(a).toLocaleString(lang, { year: "numeric", month: "numeric", day: "numeric" });
  };

  qualificationLabels.forEach((label: { name: string; value: string }) => {
    const metadataQualificationType = getMetadataQualificationType(label.name);
    let formattedName;
    let formattedValue;
    const fieldOptions: FieldOptions = {};

    if (metadataQualificationType === "information") {
      formattedName = getTranslatedNameForInformationMetadata(label.name, {
        lang,
        qualificationLabel,
      });
      formattedValue = formatInformationMetadataValue(label.value, {
        lang,
        name: label.name,
        qualificationLabel,
      });
    } else if (metadataQualificationType === "date") {
      formattedName = getTranslatedNameForDateMetadata(label.name, { lang });
      formattedValue = formatDateMetadataValue(label.value, { lang, f });

      if (label.name === "expirationDate" && (isExpired(paper) || isExpiringSoon(paper))) {
        fieldOptions.subtype = FieldSubType.ExpirationDate;
        fieldOptions.expirationData = {
          isExpired: isExpired(paper),
          isExpiringSoon: isExpiringSoon(paper),
          expirationDate: label.value,
        };
      }
    } else if (metadataQualificationType === "other") {
      formattedName = getTranslatedNameForOtherMetadata(label.name, { lang });
      formattedValue = formatOtherMetadataValue(label.value, {
        lang,
        name: label.name,
      });
    } else if (metadataQualificationType === "contact" && paper.contacts.data.length > 0) {
      formattedName = getTranslatedNameForContact({ lang });
      formattedValue = formatContactValue(paper.contacts.data);
    } else {
      // do nothing if metadata qualification type is unknown (new type, wrong type, unknown type, ...)
      return;
    }

    const field = buildField(formattedName, formattedValue, fieldOptions);
    fields.push(field);
  });

  return fields;
};

// Contact fields

const buildContactField = ({
  fieldModel,
  fieldName,
  fieldValue,
  lang,
  type,
  label,
  id,
  parentId,
}: any) => {
  const formattedName = getTranslatedNameForContactField(fieldName, { lang });
  const formattedValue = getFormattedValueForContactField(fieldValue, { field: fieldModel, lang });

  const fieldOptions: FieldOptions = {};

  if (type || label) {
    fieldOptions.label = {
      type,
      label,
    };
  }
  if (id) {
    fieldOptions.id = id;
  }

  if (parentId) {
    fieldOptions.parentId = parentId;
  }

  fieldOptions.cozyType = fieldName;

  const field = buildField(formattedName, formattedValue, fieldOptions);
  return field;
};

// We browse recursively the fieldsModels (what we want to display in the contact object) to
// - translate field name
// - format field value
// - create a Bitwarden Field for each field
const buildFieldsFromContactByBrowsingModels = ({
  models,
  data,
  lang,
  builtFields,
  parentId,
}: any) => {
  models.forEach((fieldModel: any) => {
    const fieldName = fieldModel.name;
    // Small hack to support extended fields inside extended address
    const fieldValue = extendedAddressFields.includes(fieldModel.name)
      ? data?.extendedAddress?.[fieldModel.name]
      : data[fieldModel.name];

    if (!fieldValue) {
      return;
    }

    if (fieldModel.isArray) {
      fieldValue.forEach((fieldValueItem: any) => {
        const field = buildContactField({
          fieldModel,
          fieldName,
          fieldValue: fieldValueItem[fieldModel.value],
          lang,
          type: fieldValueItem.type,
          label: fieldValueItem.label,
          id: fieldModel.name === "address" && Math.floor(Math.random() * Number.MAX_SAFE_INTEGER),
          parentId,
        });
        builtFields.push(field);

        if (fieldModel.subFields) {
          buildFieldsFromContactByBrowsingModels({
            models: fieldModel.subFields,
            data: fieldValueItem,
            lang,
            builtFields,
            parentId: fieldModel.name === "address" && field.id,
          });
        }
      });
    } else if (fieldModel.isObject) {
      if (fieldModel.subFields) {
        buildFieldsFromContactByBrowsingModels({
          models: fieldModel.subFields,
          data: fieldValue,
          lang,
          builtFields,
        });
      }
    } else {
      const field = buildContactField({
        fieldModel,
        fieldName,
        fieldValue,
        lang,
        type: fieldValue.type,
        label: fieldValue.label,
        parentId,
      });
      builtFields.push(field);
    }
  });
};

// Remove ids of addresses if they have no subfields. It is easier to do a post process
// to remove ids than checking in the recursive buildFieldsFromContactByBrowsingModels
// that addresses have subfields.
const cleanEmptyAddresses = (builtFields: FieldView[]): void => {
  builtFields.forEach((builtField) => {
    if (
      builtField.cozyType === "address" &&
      !builtFields.find((f) => f.parentId === builtField.id)
    ) {
      builtField.id = undefined;
    }
  });
};

export const buildFieldsFromContact = (
  i18nService: I18nService,
  contact: IOCozyContact,
): FieldView[] => {
  const builtFields: FieldView[] = [];

  // @ts-expect-error I did not succeed in getting i18nService.translationLocale so I fallback to a private property
  const lang = i18nService.systemLanguage;

  buildFieldsFromContactByBrowsingModels({
    models: fieldsModels,
    data: contact,
    lang,
    builtFields,
  });

  cleanEmptyAddresses(builtFields);

  return builtFields;
};
