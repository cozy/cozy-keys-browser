import { models } from "cozy-client";

import { FieldType } from "@bitwarden/common/enums/fieldType";
import { FieldApi } from "@bitwarden/common/models/api/field.api";
import { FieldView } from "@bitwarden/common/vault/models/view/field.view";

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
} = models.paper;

const buildField = (name: string, value: string): FieldView => {
  const field = new FieldView();
  field.type = FieldType.Text;
  field.name = name;
  field.value = value;
  return field;
};

export const buildFieldsFromPaper = (i18nService: any, paper: any): FieldView[] => {
  const fields: FieldView[] = [];

  const qualificationLabels = formatMetadataQualification(paper.metadata);
  const qualificationLabel = paper.metadata.qualification.label;
  const lang = i18nService.translationLocale;
  const f = (a: string) => {
    return new Date(a).toLocaleString(lang, { year: "numeric", month: "numeric", day: "numeric" });
  };

  qualificationLabels.forEach((label: { name: string; value: string }) => {
    const metadataQualificationType = getMetadataQualificationType(label.name);
    let formattedName;
    let formattedValue;

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
      return;
    }

    const field = buildField(formattedName, formattedValue);
    fields.push(field);
  });

  return fields;
};

export const copyEncryptedFields = (fields: Field[]): FieldApi[] => {
  const encryptedFields = [];

  for (const field of fields) {
    encryptedFields.push(
      new FieldApi({
        Type: field.type,
        Name: field.name.encryptedString,
        Value: field.value.encryptedString,
      })
    );
  }

  return encryptedFields;
};
