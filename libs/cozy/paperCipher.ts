/* eslint-disable no-console */
// Cozy customization
import CozyClient from "cozy-client/types/CozyClient";

import { CryptoService } from "@bitwarden/common/abstractions/crypto.service";
import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/abstractions/platformUtils.service";
import { StateService } from "@bitwarden/common/abstractions/state.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherData } from "@bitwarden/common/vault/models/data/cipher.data";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { convertNoteToCipherData, isNote, fetchNoteIllustrationUrl } from "./note.helper";
import { convertPaperToCipherData } from "./paper.helper";
import { fetchPapers, fetchPaper } from "./queries";

export const convertPapersAsCiphers = async (
  cipherService: any,
  cryptoService: CryptoService,
  i18nService: any,
  client: CozyClient,
  papers: any
): Promise<CipherData[]> => {
  const baseUrl = client.getStackClient().uri;

  const papersCiphers = [];

  const noteIllustrationUrl = await fetchNoteIllustrationUrl(client);

  const key = await cryptoService.getKeyForUserEncryption();

  for (const paper of papers) {
    let cipherData: CipherData;
    try {
      if (isNote(paper)) {
        cipherData = await convertNoteToCipherData(
          cipherService,
          i18nService,
          paper,
          {
            noteIllustrationUrl,
          },
          key
        );
      } else {
        cipherData = await convertPaperToCipherData(
          cipherService,
          i18nService,
          paper,
          {
            baseUrl,
          },
          key
        );
      }

      papersCiphers.push(cipherData);
    } catch (e) {
      console.log(`Error during conversion of paper ${paper.id}`, paper, e);
    }
  }

  return papersCiphers;
};

export const fetchPapersAndConvertAsCiphers = async (
  cipherService: any,
  cryptoService: CryptoService,
  cozyClientService: any,
  i18nService: any
): Promise<CipherData[]> => {
  const client = await cozyClientService.getClientInstance();

  try {
    const papers = await fetchPapers(client);

    const papersCiphers = await convertPapersAsCiphers(
      cipherService,
      cryptoService,
      i18nService,
      client,
      papers
    );

    console.log(`${papersCiphers.length} papers ciphers will be added`);

    return papersCiphers;
  } catch (e) {
    console.log("Error while fetching papers and converting them as ciphers", e);

    return [];
  }
};

export const favoritePaperCipher = async (
  cipherService: CipherService,
  i18nService: I18nService,
  cipher: CipherView,
  cozyClientService: any
): Promise<boolean> => {
  const client = await cozyClientService.getClientInstance();

  const paper = await fetchPaper(client, cipher.id);

  const { data: updatedPaper } = await client.save({
    ...paper,
    cozyMetadata: {
      ...paper.cozyMetadata,
      favorite: !cipher.favorite,
    },
  });

  const [updatePaperWithContacts] = client.hydrateDocuments("io.cozy.files", [updatedPaper]);

  const cipherData = await convertPaperToCipherData(
    cipherService,
    i18nService,
    updatePaperWithContacts,
    {
      baseUrl: client.getStackClient().uri,
    }
  );

  await cipherService.upsert(cipherData);

  return true;
};

export const deletePaperCipher = async (
  cipherService: CipherService,
  i18nService: I18nService,
  platformUtilsService: PlatformUtilsService,
  cipher: CipherView,
  stateService: StateService,
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
