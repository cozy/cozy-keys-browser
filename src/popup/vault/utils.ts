import {
  EventEmitter,
} from '@angular/core';

import { CipherService } from 'jslib/abstractions/cipher.service';
import { I18nService } from 'jslib/abstractions/i18n.service';
import { PlatformUtilsService } from 'jslib/abstractions/platformUtils.service';
import { UserService } from 'jslib/abstractions/user.service';
import { CipherView } from 'jslib/models/view/cipherView';

/**
 * @override by Cozy
 * This method is extracted from the jslib:
 * https://github.com/bitwarden/jslib/blob/
 * f30d6f8027055507abfdefd1eeb5d9aab25cc601/src/angular/components/view.component.ts#L117
 * We need to display a specific message for ciphers shared with Cozy.
 * This method is called by AddEditComponent and ViewComponent.
 */
export const deleteCipher = async (cipherService: CipherService, userService: UserService,
  i18nService: I18nService, platformUtilsService: PlatformUtilsService, cipher: CipherView): Promise<boolean>  => {
  const organizations = await userService.getAllOrganizations();
  const [cozyOrganization] = organizations.filter(
      (org) => org.name === 'Cozy',
  );
  const isCozyOrganization =
      cipher.organizationId === cozyOrganization.id;

  const confirmationMessage = isCozyOrganization
      ? i18nService.t('deleteSharedItemConfirmation')
      : i18nService.t('deleteItemConfirmation');

  const confirmationTitle = isCozyOrganization
      ? i18nService.t('deleteSharedItem')
      : i18nService.t('deleteItem');

  const confirmed = await platformUtilsService.showDialog(
      confirmationMessage,
      confirmationTitle,
      i18nService.t('yes'),
      i18nService.t('no'),
      'warning',
  );

  if (!confirmed) {
      return false;
  }

  try {
    const deletePromise = cipher.isDeleted ? cipherService.deleteWithServer(cipher.id)
            : cipherService.softDeleteWithServer(cipher.id);
    await deletePromise;
    platformUtilsService.eventTrack('Deleted Cipher');
    platformUtilsService.showToast('success', null, i18nService.t('deletedItem'));
    const onDeletedCipher = new EventEmitter<CipherView>();
    onDeletedCipher.emit(cipher);
  } catch { }

  return true;
};
