import { Q } from "cozy-client";
import CozyClient from "cozy-client/types/CozyClient";
import { IOCozyContact } from "cozy-client/types/types";

import { CONTACTS_DOCTYPE } from "./constants";

// Contacts

export const buildMyselfQuery = () => {
  return {
    definition: Q(CONTACTS_DOCTYPE).where({ me: true }),
    options: {
      as: `${CONTACTS_DOCTYPE}/myself`,
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
