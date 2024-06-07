import { Q } from "cozy-client";
import CozyClient from "cozy-client/types/CozyClient";
import { IOCozyContact } from "cozy-client/types/types";

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
      Q("io.cozy.files")
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
      as: `io.cozy.files/metadata_qualification_label`,
    },
  };
};

const buildFileQueryById = (_id: string) => {
  return {
    definition: () => Q("io.cozy.files").getById(_id),
    options: {
      as: `io.cozy.files/byId`,
      singleDocData: true,
    },
  };
};

export const fetchPapers = async (client: CozyClient) => {
  const filesQueryByLabels = buildFilesQueryWithQualificationLabel();

  const data = await client.queryAll(filesQueryByLabels.definition(), filesQueryByLabels.options);

  const hydratedData = client.hydrateDocuments("io.cozy.files", data);

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
  definition: Q("io.cozy.contacts")
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
    as: "io.cozy.contacts/indexedByFamilyNameGivenNameEmailCozyUrl",
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
  const { data }: { data: IOCozyContact } = await client.query(Q("io.cozy.contacts").getById(_id));

  return data;
};
