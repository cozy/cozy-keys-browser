import { EventEmitter } from "@angular/core";

import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/abstractions/platformUtils.service";
import { StateService } from "@bitwarden/common/abstractions/state.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { CozyClientService } from "../../../../popup/services/cozyClient.service";

/**
 * Cozy custo
 * This method is extracted from the jslib:
 * https://github.com/bitwarden/jslib/blob/
 * f30d6f8027055507abfdefd1eeb5d9aab25cc601/src/angular/components/view.component.ts#L117
 * We need to display a specific message for ciphers shared with Cozy.
 * This method is called by AddEditComponent and ViewComponent.
 */
export const deleteCipher = async (
  cipherService: CipherService,
  i18nService: I18nService,
  platformUtilsService: PlatformUtilsService,
  cipher: CipherView,
  stateService: StateService,
  cozyClientService: CozyClientService
): Promise<boolean> => {
  const organizations = await stateService.getOrganizations();
  const [cozyOrganization] = Object.values(organizations).filter((org) => org.name === "Cozy");
  const isCozyOrganization = cipher.organizationId === cozyOrganization.id;

  const confirmationMessage = isCozyOrganization
    ? i18nService.t("deleteSharedItemConfirmation")
    : i18nService.t("deleteItemConfirmation");

  const confirmationTitle = isCozyOrganization
    ? i18nService.t("deleteSharedItem")
    : i18nService.t("deleteItem");

  const confirmed = await platformUtilsService.showDialog(
    confirmationMessage,
    confirmationTitle,
    i18nService.t("yes"),
    i18nService.t("no"),
    "warning"
  );

  if (!confirmed) {
    return false;
  }

  try {
    const deletePromise = cipher.isDeleted
      ? cipherService.deleteWithServer(cipher.id)
      : cipherService.softDeleteWithServer(cipher.id);
    const message = i18nService.t(cipher.isDeleted ? "permanentlyDeletedItem" : "deletedItem");
    await deletePromise;
    platformUtilsService.showToast("success", null, message);
    const onDeletedCipher = new EventEmitter<CipherView>();
    onDeletedCipher.emit(cipher);
  } catch {
    //
  }

  return true;
};
