import CozyClient, { models } from "cozy-client";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

const { MAGIC_FOLDERS, ensureMagicFolder, getReferencedFolder } = models.folder;

export const APPS_DOCTYPE = "io.cozy.apps";
const APP_DIR_REF = `${APPS_DOCTYPE}/mypapers`;

export const getOrCreateAppFolderWithReference = async (
  client: CozyClient,
  i18nService: I18nService,
) => {
  const existingFolders = await getReferencedFolder(client, {
    _id: APP_DIR_REF,
    _type: APPS_DOCTYPE,
  });

  if (existingFolders) {
    return existingFolders;
  } else {
    const { path: administrativeFolderPath } = await ensureMagicFolder(
      client,
      MAGIC_FOLDERS.ADMINISTRATIVE,
      `/${i18nService.t("administrativeFolder")}`,
    );

    const appFolder = await ensureMagicFolder(
      client,
      MAGIC_FOLDERS.PAPERS,
      `${administrativeFolderPath}/${i18nService.t("papersFolder")}`,
    );

    return appFolder;
  }
};
