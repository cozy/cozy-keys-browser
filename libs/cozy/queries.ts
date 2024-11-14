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
    "cozyMetadata.sourceAccount",
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
        .partialIndex({
          type: "file",
          trashed: false,
          "metadata.qualification.label": {
            $exists: true,
          },
          "cozyMetadata.createdByApp": { $exists: true },
        })
        .select(select)
        .limitBy(1000)
        .include(["contacts"]),
    options: {
      as: `${FILES_DOCTYPE}/metadata_qualification_label`,
    },
  };
};

const buildFileQueryById = (_id: string) => {
  return {
    definition: () => Q(FILES_DOCTYPE).getById(_id),
    options: {
      as: `${FILES_DOCTYPE}/byId/${_id}`,
      singleDocData: true,
    },
  };
};

export const fetchPapers = async (client: CozyClient) => {
  const filesQueryByLabels = buildFilesQueryWithQualificationLabel();

  const data = await client.queryAll(filesQueryByLabels.definition(), filesQueryByLabels.options);

  // Necessary because https://github.com/cozy/cozy-client/issues/493
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

export const fetchHydratedPaper = async (client: CozyClient, _id: string) => {
  const paper = await fetchPaper(client, _id);

  const hydratedPaper = client.hydrateDocuments(FILES_DOCTYPE, [paper])[0];

  return hydratedPaper;
};

// Contacts

export const buildMyselfQuery = () => {
  return {
    definition: Q(CONTACTS_DOCTYPE).where({ me: true }),
    options: {
      as: `${CONTACTS_DOCTYPE}/myself`
    },
  };
};

export const buildContactsQuery = () => ({
  definition: Q(CONTACTS_DOCTYPE)
    .where({
      "indexes.byFamilyNameGivenNameEmailCozyUrl": {
        $gt: null,
      },
    })
    .partialIndex({
      $and: [
        {
          $or: [
            {
              me: true,
            },
            {
              "cozyMetadata.favorite": true,
            },
          ],
        },
        {
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
        },
      ],
      "indexes.byFamilyNameGivenNameEmailCozyUrl": {
        $exists: true,
      },
    })
    .indexFields(["indexes.byFamilyNameGivenNameEmailCozyUrl"])
    .include(["related"])
    .limitBy(1000),
  options: {
    as: `${CONTACTS_DOCTYPE}/indexedByFamilyNameGivenNameEmailCozyUrl/meAndFavorite`,
  },
});

export const fetchMyself = async (client: CozyClient): Promise<IOCozyContact[]> => {
  const myselfQuery = buildMyselfQuery();

  const { data }: { data: IOCozyContact[] } = await client.query(
    myselfQuery.definition,
    myselfQuery.options,
  );

  return data;
};

export const fetchContacts = async (client: CozyClient): Promise<IOCozyContact[]> => {
  const contactsQuery = buildContactsQuery();

  const data: IOCozyContact[] = await client.queryAll(
    contactsQuery.definition,
    contactsQuery.options,
  );

  // Necessary because https://github.com/cozy/cozy-client/issues/493
  const hydratedData = client.hydrateDocuments(CONTACTS_DOCTYPE, data);

  return hydratedData;
};

export const fetchContact = async (client: CozyClient, _id: string): Promise<IOCozyContact> => {
  const { data }: { data: IOCozyContact } = await client.query(Q(CONTACTS_DOCTYPE).getById(_id));

  return data;
};

// Helpers

export const fetchContactsAndPapers = async (
  client: CozyClient,
): Promise<{ contacts: IOCozyContact[]; papers: any }> => {
  const fetchPromises = [fetchContacts(client), fetchPapers(client)];

  const [contactsPromise, papersPromise] = await Promise.allSettled(fetchPromises);

  let contacts: IOCozyContact[] = [];
  let papers: any[] = [];

  if (contactsPromise.status === "fulfilled") {
    contacts = contactsPromise.value;
  }

  if (papersPromise.status === "fulfilled") {
    papers = papersPromise.value;
  }

  return {
    contacts,
    papers,
  };
};
