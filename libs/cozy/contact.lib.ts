// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
// Most of this file will be imported from cozy-client soon

import { CozyContactFieldNames } from "./mapping";

const gender = [
  {
    value: "male",
    label: "man",
  },
  {
    value: "female",
    label: "woman",
  },
];

export const phoneFieldOptions = [
  {
    value: "",
    label: "none",
  },
  {
    value: { type: "cell", label: "home" },
    label: "cellHome",
  },
  {
    value: { type: "cell", label: "work" },
    label: "cellWork",
  },
  {
    value: { type: "voice", label: "home" },
    label: "voiceHome",
  },
  {
    value: { type: "voice", label: "work" },
    label: "voiceWork",
  },
  {
    value: { type: "fax", label: "home" },
    label: "faxHome",
  },
  {
    value: { type: "fax", label: "work" },
    label: "faxWork",
  },
];
export const emailFieldOptions = [
  {
    value: "",
    label: "none",
  },
  {
    value: { label: "home" },
    label: "home",
  },
  {
    value: { label: "work" },
    label: "work",
  },
];
export const addressFieldOptions = [
  {
    value: "",
    label: "none",
  },
  {
    value: { label: "home" },
    label: "home",
  },
  {
    value: { label: "work" },
    label: "work",
  },
];

export type ExtendedAddressFields =
  | "locality"
  | "floor"
  | "building"
  | "stairs"
  | "apartment"
  | "entrycode";

export const extendedAddressFields = [
  "locality",
  "floor",
  "building",
  "stairs",
  "apartment",
  "entrycode",
];

export type SubField = {
  name: ExtendedAddressFields;
  icon: string | null;
  type: string;
};

export type Field = {
  name: CozyContactFieldNames;
  icon: string | null;
  type: string;
  select?: boolean;
  selectValue?: any;
  isObject?: boolean;
  subFields?: SubField[];
  hasLabel?: boolean;
  value?: string;
  isArray?: boolean;
  isMultiline?: boolean;
  labelProps?: Record<string, any>;
};

export const fields: Field[] = [
  {
    name: "gender",
    icon: "people",
    type: "text",
    select: true,
    selectValue: gender,
  },
  {
    name: "name",
    icon: null,
    isObject: true,
    subFields: [
      {
        name: "givenName",
        icon: null,
        type: "text",
      },
      {
        name: "additionalName",
        icon: null,
        type: "text",
      },
      {
        name: "familyName",
        icon: null,
        type: "text",
      },
      {
        name: "surname",
        icon: null,
        type: "text",
      },
    ],
  },
  {
    name: "company",
    icon: "company",
    type: "text",
  },
  {
    name: "jobTitle",
    icon: null,
    type: "text",
  },
  {
    name: "phone",
    icon: "telephone",
    type: "tel",
    hasLabel: true,
    value: "number",
    isArray: true,
  },
  {
    name: "email",
    icon: "email",
    type: "email",
    hasLabel: true,
    value: "address",
    isArray: true,
  },
  {
    name: "address",
    icon: "location",
    type: "button",
    subFields: [
      {
        name: "number",
        icon: null,
        type: "text",
      },
      {
        name: "street",
        icon: null,
        type: "text",
      },
      {
        name: "code",
        icon: null,
        type: "text",
      },
      {
        name: "city",
        icon: null,
        type: "text",
      },
      {
        name: "country",
        icon: null,
        type: "text",
      },
      {
        name: "locality",
        icon: null,
        type: "text",
      },
      {
        name: "building",
        icon: null,
        type: "text",
      },
      {
        name: "stairs",
        icon: null,
        type: "text",
      },
      {
        name: "floor",
        icon: null,
        type: "text",
      },
      {
        name: "apartment",
        icon: null,
        type: "text",
      },
      {
        name: "entrycode",
        icon: null,
        type: "text",
      },
    ],
    hasLabel: true,
    value: "formattedAddress",
    isArray: true,
  },
  {
    name: "cozy",
    icon: "cloud",
    type: "url",
    hasLabel: true,
    value: "url",
    isArray: true,
  },
  {
    name: "birthday",
    icon: "calendar",
    type: "date",
    labelProps: { shrink: true },
  },
  {
    name: "birthplace",
    icon: null,
    type: "text",
  },
  {
    name: "note",
    icon: "comment",
    type: "text",
    isMultiline: true,
  },
];

const CONTACT_FIELDS_FR = {
  gender: "Civilité",
  givenName: "Prénom",
  familyName: "Nom",
  additionalName: "2e prénom",
  surname: "Nom d'usage",
  phone: "Téléphone",
  email: "Email",
  address: "Adresse",
  cozy: "URL du Cozy",
  company: "Entreprise",
  jobTitle: "Fonction",
  birthday: "Anniversaire",
  birthplace: "Lieu de naissance",
  note: "Notes",
  label: "Libellé",
  number: "Numéro de voie",
  street: "Adresse postale",
  code: "Code postal",
  city: "Ville",
  country: "Pays",
  locality: "Lieu-dit",
  building: "Bâtiment",
  stairs: "Escalier",
  floor: "Etage",
  apartment: "Appartement",
  entrycode: "Code d'entrée",
  required: "Un de ces champs doit être renseigné",
  male: "Homme",
  female: "Femme",
};

const CONTACT_FIELDS_EN = {
  gender: "Civility",
  givenName: "Firstname",
  familyName: "Lastname",
  additionalName: "2nd firstname",
  surname: "Name in use",
  phone: "Phone",
  email: "Email",
  address: "Address",
  cozy: "Cozy URL",
  company: "Company",
  jobTitle: "Job title",
  birthday: "Birthday",
  birthplace: "Birthplace",
  note: "Notes",
  label: "Label",
  number: "Lane number",
  street: "Postal address",
  code: "Postal code",
  city: "City",
  country: "Country",
  locality: "locality",
  building: "Building",
  stairs: "Stairs",
  floor: "Floor",
  apartment: "Apartment",
  entrycode: "Entry code",
  required: "One of these fields must be filled in",
  male: "Man",
  female: "Woman",
};

export const getTranslatedNameForContactField = (name, { lang }) => {
  if (lang === "fr") {
    return CONTACT_FIELDS_FR[name];
  } else {
    return CONTACT_FIELDS_EN[name];
  }
};

export const getFormattedValueForContactField = (value, { field, lang }) => {
  if (field.type === "date") {
    return new Date(value).toLocaleString(lang, {
      year: "numeric",
      month: "numeric",
      day: "numeric",
    });
  } else if (field.name === "gender") {
    if (lang === "fr") {
      return CONTACT_FIELDS_FR[value];
    } else {
      return CONTACT_FIELDS_EN[value];
    }
  } else {
    return value;
  }
};
