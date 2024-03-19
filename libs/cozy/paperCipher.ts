/* eslint-disable no-console */
// Cozy customization
import { Q } from "cozy-client";
import CozyClient from "cozy-client/types/CozyClient";

import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/abstractions/platformUtils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherResponse } from "@bitwarden/common/vault/models/response/cipher.response";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { convertNoteToCipherResponse, isNote, fetchNoteIllustrationUrl } from "./note.helper";
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
    "metadata.AObtentionDate",
    "metadata.BObtentionDate",
    "metadata.CObtentionDate",
    "metadata.DObtentionDate",
    "metadata.page",
    "metadata.version",
    "cozyMetadata.createdByApp",
    "cozyMetadata.sourceAccountIdentifier",
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
  i18nService: any,
  client: CozyClient,
  papers: any
): Promise<CipherResponse[]> => {
  const baseUrl = client.getStackClient().uri;

  const papersCiphers = [];

  const noteIllustrationUrl = await fetchNoteIllustrationUrl(client);

  for (const paper of papers) {
    let cipherResponse: CipherResponse;
    if (isNote(paper)) {
      cipherResponse = await convertNoteToCipherResponse(cipherService, i18nService, paper, {
        client,
        noteIllustrationUrl,
      });
    } else {
      cipherResponse = await convertPaperToCipherResponse(cipherService, i18nService, paper, {
        baseUrl,
      });
    }
    papersCiphers.push(cipherResponse);
  }

  return papersCiphers;
};

export const fetchPapersAndConvertAsCiphers = async (
  cipherService: any,
  cozyClientService: any,
  i18nService: any
): Promise<CipherResponse[]> => {
  const client = await cozyClientService.getClientInstance();

  try {
    const papers = await fetchPapers(client);

    const papersCiphers = await convertPapersAsCiphers(cipherService, i18nService, client, papers);

    console.log(`${papersCiphers.length} papers ciphers will be added`);

    return papersCiphers;
  } catch (e) {
    console.log("Error while fetching papers and converting them as ciphers", e);

    throw e;
  }
};

export const deletePaperCipher = async (
  cipherService: CipherService,
  i18nService: I18nService,
  platformUtilsService: PlatformUtilsService,
  cipher: CipherView,
  cozyClientService: any
): Promise<boolean> => {
  const confirmed = await platformUtilsService.showDialog(
    i18nService.t("deletePaperItemConfirmation"),
    i18nService.t("deleteItem"),
    i18nService.t("yes"),
    i18nService.t("no"),
    "warning"
  );

  if (!confirmed) {
    return false;
  }

  const client = await cozyClientService.getClientInstance();
  await client.destroy({
    _id: cipher.id,
    _type: "io.cozy.files",
  });
  await cipherService.delete(cipher.id);

  const message = i18nService.t("deletedPaperItem");
  platformUtilsService.showToast("success", null, message);

  return true;
};

// Cozy customization end
