import { PaperType } from "@bitwarden/common/enums/paperType";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CipherData } from "@bitwarden/common/vault/models/data/cipher.data";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { PaperView } from "@bitwarden/common/vault/models/view/paper.view";

import { buildFieldsFromPaper } from "./fields.helper";

interface PaperConversionOptions {
  baseUrl: string;
}

const DEFAULT_THUMBNAIL_URL = "/popup/images/icon-file-type-text.svg";

const buildOwnerName = (i18nService: I18nService, paper: any) => {
  if (paper.contacts.data[0]?.displayName) {
    return paper.contacts.data[0]?.displayName;
  } else if (paper.cozyMetadata.createdByApp && paper.cozyMetadata.sourceAccountIdentifier) {
    return `${i18nService.t("account")} ${paper.cozyMetadata.createdByApp.toUpperCase()} : ${
      paper.cozyMetadata.sourceAccountIdentifier
    }`;
  } else {
    return "";
  }
};

const buildIllustrationThumbnailUrl = (paper: any, baseUrl: string) => {
  return paper.links.tiny ? new URL(paper.links.tiny, baseUrl).toString() : DEFAULT_THUMBNAIL_URL;
};

export const buildIllustrationUrl = (paper: any, baseUrl: string) => {
  return paper.links.medium
    ? new URL(paper.links.medium, baseUrl).toString()
    : DEFAULT_THUMBNAIL_URL;
};

export const convertPaperToCipherData = async (
  cipherService: CipherService,
  i18nService: I18nService,
  paper: any,
  options: PaperConversionOptions,
  key?: SymmetricCryptoKey,
): Promise<CipherData> => {
  const { baseUrl } = options;

  const cozyMetadata = paper.cozyMetadata;

  const cipherView = new CipherView();
  cipherView.id = paper.id;
  cipherView.name = paper.name;
  cipherView.type = CipherType.Paper;
  cipherView.paper = new PaperView();
  cipherView.paper.type = PaperType.Paper;
  cipherView.paper.ownerName = buildOwnerName(i18nService, paper);
  cipherView.paper.illustrationThumbnailUrl = buildIllustrationThumbnailUrl(paper, baseUrl);
  cipherView.paper.illustrationUrl = buildIllustrationUrl(paper, baseUrl);
  cipherView.paper.qualificationLabel = paper.metadata.qualification.label;
  cipherView.fields = buildFieldsFromPaper(i18nService, paper);
  cipherView.favorite = !!paper.cozyMetadata.favorite;
  if (cozyMetadata?.createdAt) {
    cipherView.creationDate = new Date(cozyMetadata.createdAt);
  }
  if (cozyMetadata?.updatedAt) {
    cipherView.revisionDate = new Date(cozyMetadata.updatedAt);
  }

  const cipherEncrypted = await cipherService.encrypt(cipherView, key);

  const cipherData = cipherEncrypted.toCipherData();

  return cipherData;
};
