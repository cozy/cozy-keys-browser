/* eslint-disable no-console */
// Cozy customization
import { Q } from "cozy-client";
import CozyClient from "cozy-client/types/CozyClient";

import { CipherResponse } from "@bitwarden/common/vault/models/response/cipher.response";

import { convertPaperToCipherResponse } from "./paper.helper";

const fetchPapers = async (client: CozyClient) => {
  const filesQueryByLabels = buildFilesQueryWithQualificationLabel();

  const data = await client.queryAll(filesQueryByLabels.definition(), filesQueryByLabels.options);

  const hydratedData = client.hydrateDocuments("io.cozy.files", data);

  return hydratedData;
};

export const buildFilesQueryWithQualificationLabel = () => {
  const select = [
    "name",
    "mime",
    "referenced_by",
    "metadata.country",
    "metadata.datetime",
    "metadata.expirationDate",
    "metadata.noticePeriod",
    "metadata.qualification.label",
    "metadata.referencedDate",
    "metadata.number",
    "metadata.contractType",
    "metadata.refTaxIncome",
    "metadata.title",
    "metadata.version",
    "cozyMetadata.createdByApp",
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

const convertPapersAsCiphers = async (
  cipherService: any,
  client: CozyClient,
  papers: any
): Promise<CipherResponse[]> => {
  const baseUrl = client.getStackClient().uri;

  const papersCiphers = [];

  for (const paper of papers) {
    const cipherViewResponse = await convertPaperToCipherResponse(cipherService, paper, baseUrl);

    papersCiphers.push(cipherViewResponse);
  }

  return papersCiphers;
};

export const fetchPapersAndConvertAsCiphers = async (
  cipherService: any,
  cozyClientService: any
): Promise<CipherResponse[]> => {
  const client = await cozyClientService.getClientInstance();

  try {
    const papers = await fetchPapers(client);

    const papersCiphers = await convertPapersAsCiphers(cipherService, client, papers);

    console.log(`${papersCiphers.length} papers ciphers will be added`);

    return papersCiphers;
  } catch (e) {
    console.log("Error while fetching papers and converting them as ciphers", e);

    throw e;
  }
};
// Cozy customization end
