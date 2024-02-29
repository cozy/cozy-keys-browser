import { PaperType } from "@bitwarden/common/enums/paperType";
import { PaperApi } from "@bitwarden/common/models/api/paper.api";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CipherResponse } from "@bitwarden/common/vault/models/response/cipher.response";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { PaperView } from "@bitwarden/common/vault/models/view/paper.view";

interface PaperConversionOptions {
  baseUrl: string;
}

export const convertPaperToCipherResponse = async (
  cipherService: any,
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
  cipherView.paper.ownerName = paper.contacts.data[0]?.displayName;
  cipherView.paper.illustrationThumbnailUrl = new URL(paper.links.tiny, baseUrl).toString();

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
