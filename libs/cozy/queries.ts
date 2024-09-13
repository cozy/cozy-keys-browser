import { Q } from "cozy-client";
import CozyClient from "cozy-client/types/CozyClient";
import { IOCozyContact } from "cozy-client/types/types";

import { CONTACTS_DOCTYPE, FILES_DOCTYPE } from "./constants";

const buildFilesQueryWithQualificationLabel = () => {
  const select = [
    "name",
    "mime",
    "referenced_by",
    "metadata",
    "metadata.qualification.label",
    "cozyMetadata.createdAt",
    "cozyMetadata.updatedAt",
    "cozyMetadata.createdByApp",
    "cozyMetadata.sourceAccountIdentifier",
    "cozyMetadata.favorite",
    "created_at",
    "dir_id",
    "updated_at",
    "type",
    "trashed",
  ];

  return {
    definition: () =>
      Q(FILES_DOCTYPE)
        .where({
          type: "file",
          trashed: false,
        })
        .partialIndex({
          "metadata.qualification.label": {
            $exists: true,
          },
          "cozyMetadata.createdByApp": { $exists: true },
        })
        .select(select)
        .limitBy(1000)
        .include(["contacts"])
        .indexFields(["type", "trashed"]),
    options: {
      as: `${FILES_DOCTYPE}/metadata_qualification_label`,
    },
  };
};

const buildFileQueryById = (_id: string) => {
  return {
    definition: () => Q(FILES_DOCTYPE).getById(_id),
    options: {
      as: `${FILES_DOCTYPE}/byId`,
      singleDocData: true,
    },
  };
};

export const fetchPapers = async (client: CozyClient) => {
  const filesQueryByLabels = buildFilesQueryWithQualificationLabel();

  const data = await client.queryAll(filesQueryByLabels.definition(), filesQueryByLabels.options);

  const hydratedData = client.hydrateDocuments(FILES_DOCTYPE, data);

  return hydratedData;
};

export const fetchPaper = async (client: CozyClient, _id: string) => {
  const fileQueryWithContact = buildFileQueryById(_id);

  const { data } = await client.query(
    fileQueryWithContact.definition(),
    fileQueryWithContact.options,
  );

  return data;
};

// Contacts

export const buildContactsQuery = () => ({
  definition: Q(CONTACTS_DOCTYPE)
    .where({
      "indexes.byFamilyNameGivenNameEmailCozyUrl": {
        $gt: null,
      },
    })
    .partialIndex({
      $or: [
        {
          trashed: {
            $exists: false,
          },
        },
        {
          trashed: false,
        },
      ],
      "indexes.byFamilyNameGivenNameEmailCozyUrl": {
        $exists: true,
      },
    })
    .indexFields(["indexes.byFamilyNameGivenNameEmailCozyUrl"])
    .sortBy([{ "indexes.byFamilyNameGivenNameEmailCozyUrl": "asc" }])
    .limitBy(1000),
  options: {
    as: `${CONTACTS_DOCTYPE}/indexedByFamilyNameGivenNameEmailCozyUrl`,
  },
});

export const fetchContacts = async (client: CozyClient): Promise<IOCozyContact[]> => {
  const contactsQuery = buildContactsQuery();

  const data: IOCozyContact[] = await client.queryAll(
    contactsQuery.definition,
    contactsQuery.options,
  );

  return data;
};

export const fetchContact = async (client: CozyClient, _id: string): Promise<IOCozyContact> => {
  const { data }: { data: IOCozyContact } = await client.query(Q(CONTACTS_DOCTYPE).getById(_id));

  return data;
};
