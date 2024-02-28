import { PaperApi } from "@bitwarden/common/models/api/paper.api";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CipherResponse } from "@bitwarden/common/vault/models/response/cipher.response";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { PaperView } from "@bitwarden/common/vault/models/view/paper.view";

export const convertPaperToCipherResponse = async (
  cipherService: any,
  paper: any,
  baseUrl: string
): Promise<CipherResponse> => {
  const cipherView = new CipherView();
  cipherView.id = paper.id;
  cipherView.name = paper.name;
  cipherView.type = CipherType.Paper;
  cipherView.paper = new PaperView();
  cipherView.paper.ownerName = paper.contacts.data[0]?.displayName;
  cipherView.paper.illustrationThumbnailUrl = new URL(baseUrl, paper.links.tiny).toString();

  const cipherEncrypted = await cipherService.encrypt(cipherView);
  const cipherViewEncrypted = new CipherView(cipherEncrypted);
  const cipherViewResponse = new CipherResponse(cipherViewEncrypted);
  cipherViewResponse.id = cipherEncrypted.id;
  cipherViewResponse.name = cipherEncrypted.name.encryptedString;

  cipherViewResponse.paper = new PaperApi();
  cipherViewResponse.paper.ownerName = cipherView.paper.ownerName;
  cipherViewResponse.paper.illustrationThumbnailUrl = cipherView.paper.illustrationThumbnailUrl;

  return cipherViewResponse;
};
