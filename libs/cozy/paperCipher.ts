/* eslint-disable no-console */
// Cozy customization
import CozyClient from "cozy-client/types/CozyClient";

import { CryptoService } from "@bitwarden/common/abstractions/crypto.service";
import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/abstractions/platformUtils.service";
import { StateService } from "@bitwarden/common/abstractions/state.service";
import { PaperType } from "@bitwarden/common/enums/paperType";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CipherData } from "@bitwarden/common/vault/models/data/cipher.data";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { CozyClientService } from "../../apps/browser/src/popup/services/cozyClient.service";

import { convertNoteToCipherData, isNote, fetchNoteIllustrationUrl } from "./note.helper";
import { convertPaperToCipherData } from "./paper.helper";
import { fetchPapers, fetchPaper } from "./queries";

export const convertPapersAsCiphers = async (
  cipherService: CipherService,
  cryptoService: CryptoService,
  i18nService: I18nService,
  client: CozyClient,
  papers: any
): Promise<CipherData[]> => {
  const baseUrl = client.getStackClient().uri;

  const papersCiphers = [];

  const noteIllustrationUrl = await fetchNoteIllustrationUrl(client);

  const key = await cryptoService.getKeyForUserEncryption();

  for (const paper of papers) {
    let cipherData;
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
      if (e.message === "No encryption key provided.") {
        throw e;
      }

      console.log(`Error during conversion of paper ${paper.id}`, paper, e);
    }
  }

  return papersCiphers;
};

export const fetchPapersAndConvertAsCiphers = async (
  cipherService: CipherService,
  cryptoService: CryptoService,
  cozyClientService: CozyClientService,
  i18nService: I18nService
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

    return papersCiphers;
  } catch (e) {
    console.log(
      "Error while fetching papers and converting them as ciphers. Fallbacking to stored papers.",
      e
    );

    return (await cipherService.getAll())
      .filter((cipher) => cipher.type === CipherType.Paper)
      .map((cipher) => cipher.toCipherData());
  }
};

export const favoritePaperCipher = async (
  cipherService: CipherService,
  i18nService: I18nService,
  cipher: CipherView,
  cozyClientService: CozyClientService
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

  let cipherData;

  if (cipher.paper.type === PaperType.Paper) {
    cipherData = await convertPaperToCipherData(
      cipherService,
      i18nService,
      updatePaperWithContacts,
      {
        baseUrl: client.getStackClient().uri,
      }
    );
  } else if (cipher.paper.type === PaperType.Note) {
    cipherData = await convertNoteToCipherData(
      cipherService,
      i18nService,
      updatePaperWithContacts,
      {
        noteIllustrationUrl: await fetchNoteIllustrationUrl(client),
      }
    );
  }

  await cipherService.upsert(cipherData);

  return true;
};

export const deletePaperCipher = async (
  cipherService: CipherService,
  i18nService: I18nService,
  platformUtilsService: PlatformUtilsService,
  cipher: CipherView,
  stateService: StateService,
  cozyClientService: CozyClientService
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
