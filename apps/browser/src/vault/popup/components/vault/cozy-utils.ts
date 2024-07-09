import { EventEmitter } from "@angular/core";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { CozyClientService } from "src/popup/services/cozyClient.service";

import { DialogService } from "../../../../../../../libs/components/src/dialog";
import { ToastService } from "../../../../../../../libs/components/src/toast";

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
  dialogService: DialogService,
  toastService: ToastService,
  cipher: CipherView,
  cozyClientService: CozyClientService,
  organizationService: OrganizationService,
): Promise<boolean> => {
  const organizations = await organizationService.getAll();
  const [cozyOrganization] = Object.values(organizations).filter((org) => org.name === "Cozy");
  const isCozyOrganization = cipher.organizationId === cozyOrganization.id;

  const confirmationMessage = isCozyOrganization
    ? i18nService.t("deleteSharedItemConfirmation")
    : i18nService.t("deleteItemConfirmation");

  const confirmationTitle = isCozyOrganization
    ? i18nService.t("deleteSharedItem")
    : i18nService.t("deleteItem");

  const confirmed = await dialogService.openSimpleDialog({
    title: confirmationTitle,
    content: confirmationMessage,
    type: "warning",
  });

  if (!confirmed) {
    return false;
  }

  try {
    const deletePromise = cipher.isDeleted
      ? cipherService.deleteWithServer(cipher.id)
      : cipherService.softDeleteWithServer(cipher.id);
    const message = i18nService.t(cipher.isDeleted ? "permanentlyDeletedItem" : "deletedItem");
    await deletePromise;
    toastService.showToast({ title: message, message, variant: "success" });
    const onDeletedCipher = new EventEmitter<CipherView>();
    onDeletedCipher.emit(cipher);
  } catch {
    //
  }

  return true;
};
