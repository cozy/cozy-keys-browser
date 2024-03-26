import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CipherResponse } from "@bitwarden/common/vault/models/response/cipher.response";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

export const convertContactToCipherResponse = async (
  cipherService: any,
  contact: any,
): Promise<CipherResponse> => {

  const cipherView = new CipherView();
  cipherView.id = contact.id;
  cipherView.name = contact.displayName;
  cipherView.type = CipherType.Contact;

  const cipherEncrypted = await cipherService.encrypt(cipherView);
  const cipherViewEncrypted = new CipherView(cipherEncrypted);
  const cipherViewResponse = new CipherResponse(cipherViewEncrypted);
  cipherViewResponse.id = cipherEncrypted.id;
  cipherViewResponse.name = cipherEncrypted.name.encryptedString;

  return cipherViewResponse;
};
