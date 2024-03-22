import { Q } from "cozy-client";
import CozyClient from "cozy-client/types/CozyClient";

const buildFilesQueryWithQualificationLabel = () => {
  const select = [
    "name",
    "mime",
    "referenced_by",
    "metadata",
    "metadata.qualification.label",
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
