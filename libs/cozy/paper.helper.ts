import { PaperType } from "@bitwarden/common/enums/paperType";
import { PaperApi } from "@bitwarden/common/models/api/paper.api";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CipherResponse } from "@bitwarden/common/vault/models/response/cipher.response";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { PaperView } from "@bitwarden/common/vault/models/view/paper.view";

import { buildFieldsFromPaper, copyEncryptedFields } from "./fields.helper";

interface PaperConversionOptions {
  baseUrl: string;
}

const DEFAULT_THUMBNAIL_URL = "/popup/images/icon-file-type-text.svg";

const buildOwnerName = (i18nService: any, paper: any) => {
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

const buildIllustrationUrl = (paper: any, baseUrl: string) => {
  return paper.links.medium
    ? new URL(paper.links.medium, baseUrl).toString()
    : DEFAULT_THUMBNAIL_URL;
};

export const convertPaperToCipherResponse = async (
  cipherService: any,
  i18nService: any,
  paper: any,
  options: PaperConversionOptions
): Promise<CipherResponse> => {
  const { baseUrl } = options;

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

  const cipherEncrypted = await cipherService.encrypt(cipherView);
  const cipherViewEncrypted = new CipherView(cipherEncrypted);
  const cipherViewResponse = new CipherResponse(cipherViewEncrypted);
  cipherViewResponse.id = cipherEncrypted.id;
  cipherViewResponse.name = cipherEncrypted.name.encryptedString;

  cipherViewResponse.paper = new PaperApi();
  cipherViewResponse.paper.type = cipherView.paper.type;
  cipherViewResponse.paper.ownerName = cipherEncrypted.paper.ownerName?.encryptedString ?? "";
  cipherViewResponse.paper.illustrationThumbnailUrl =
    cipherEncrypted.paper.illustrationThumbnailUrl.encryptedString;
  cipherViewResponse.paper.illustrationUrl = cipherEncrypted.paper.illustrationUrl.encryptedString;
  cipherViewResponse.paper.qualificationLabel =
    cipherEncrypted.paper.qualificationLabel.encryptedString;
  cipherViewResponse.fields = copyEncryptedFields(cipherEncrypted.fields);
  cipherViewResponse.favorite = cipherEncrypted.favorite;
  cipherViewResponse.creationDate = paper.cozyMetadata.createdAt;
  cipherViewResponse.revisionDate = paper.cozyMetadata.updatedAt;

  return cipherViewResponse;
};
