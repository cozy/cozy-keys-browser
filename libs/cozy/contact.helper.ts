import { ContactApi } from "@bitwarden/common/models/api/contact.api";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CipherResponse } from "@bitwarden/common/vault/models/response/cipher.response";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { ContactView } from "@bitwarden/common/vault/models/view/contact.view";

const getPrimaryEmail = (contact: any): string | undefined => {
  return contact.email.find((email: any) => email.primary)?.address;
};

export const convertContactToCipherResponse = async (
  cipherService: any,
  contact: any
): Promise<CipherResponse> => {
  const cipherView = new CipherView();
  cipherView.id = contact.id;
  cipherView.name = contact.displayName;
  cipherView.type = CipherType.Contact;
  cipherView.contact = new ContactView();
  cipherView.contact.displayName = contact.displayName;
  cipherView.contact.primaryEmail = getPrimaryEmail(contact);
  cipherView.favorite = !!contact.cozyMetadata?.favorite;

  const cipherEncrypted = await cipherService.encrypt(cipherView);
  const cipherViewEncrypted = new CipherView(cipherEncrypted);
  const cipherViewResponse = new CipherResponse(cipherViewEncrypted);
  cipherViewResponse.id = cipherEncrypted.id;
  cipherViewResponse.name = cipherEncrypted.name.encryptedString;
  cipherViewResponse.contact = new ContactApi();
  cipherViewResponse.contact.displayName = cipherEncrypted.contact.displayName.encryptedString;
  cipherViewResponse.contact.primaryEmail =
    cipherEncrypted.contact.primaryEmail?.encryptedString ?? "";
  cipherViewResponse.favorite = cipherEncrypted.favorite;
  cipherViewResponse.creationDate = contact.cozyMetadata?.createdAt;
  cipherViewResponse.revisionDate = contact.cozyMetadata?.updatedAt;

  return cipherViewResponse;
};
