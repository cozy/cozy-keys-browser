import { Q } from "cozy-client";
import CozyClient from "cozy-client/types/CozyClient";

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

const buildFileQueryWithContacts = (_id: string) => {
  return {
    definition: () =>
      Q("io.cozy.files")
        .where({
          _id: _id,
        })
        .limitBy(1)
        .include(["contacts"]),
    options: {
      as: `io.cozy.files/byIdWithContacts`,
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
  const fileQueryWithContact = buildFileQueryWithContacts(_id);

  const { data } = await client.query(
    fileQueryWithContact.definition(),
    fileQueryWithContact.options
  );

  return data[0];
};

// Contacts

export const buildContactsQuery = () => ({
  definition: Q("io.cozy.contacts")
    .where({
      _id: {
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
    })
    .indexFields(["_id"])
    .limitBy(1000),
  options: {
    as: "io.cozy.contacts",
  },
});

export const fetchContacts = async (client: CozyClient) => {
  const contactsQuery = buildContactsQuery();

  const data = await client.queryAll(contactsQuery.definition, contactsQuery.options);

  return data;
};

export const fetchContact = async (client: CozyClient, _id: string) => {
  const { data } = await client.query(Q("io.cozy.contacts").getById(_id));

  return data;
};
