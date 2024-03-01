import { PaperType } from "@bitwarden/common/enums/paperType";
import { PaperApi } from "@bitwarden/common/models/api/paper.api";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CipherResponse } from "@bitwarden/common/vault/models/response/cipher.response";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { PaperView } from "@bitwarden/common/vault/models/view/paper.view";

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

  const cipherEncrypted = await cipherService.encrypt(cipherView);
  const cipherViewEncrypted = new CipherView(cipherEncrypted);
  const cipherViewResponse = new CipherResponse(cipherViewEncrypted);
  cipherViewResponse.id = cipherEncrypted.id;
  cipherViewResponse.name = cipherEncrypted.name.encryptedString;

  cipherViewResponse.paper = new PaperApi();
  cipherViewResponse.paper.type = cipherView.paper.type;
  cipherViewResponse.paper.ownerName = cipherView.paper.ownerName;
  cipherViewResponse.paper.illustrationThumbnailUrl = cipherView.paper.illustrationThumbnailUrl;

  return cipherViewResponse;
};
