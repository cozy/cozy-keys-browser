import { Q } from "cozy-client";
import CozyClient from "cozy-client/types/CozyClient";

import { PaperType } from "@bitwarden/common/enums/paperType";
import { PaperApi } from "@bitwarden/common/models/api/paper.api";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CipherResponse } from "@bitwarden/common/vault/models/response/cipher.response";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { PaperView } from "@bitwarden/common/vault/models/view/paper.view";

import { buildFieldsFromPaper, copyEncryptedFields } from "./fields.helper";

interface NoteConversionOptions {
  client: CozyClient;
  noteThumbnailUrl: string;
}

export const isNote = (document: any) => document.mime === "text/vnd.cozy.note+markdown";

export const fetchNoteThumbnailUrl = async (client: CozyClient) => {
  const { data: app } = await client.query(Q("io.cozy.apps").getById("notes"));

  const baseUrl = client.getStackClient().uri;

  const fullUrl = new URL(app.links.icon, baseUrl).toString();

  return fullUrl;
};

export const convertNoteToCipherResponse = async (
  cipherService: any,
  i18nService: any,
  paper: any,
  options: NoteConversionOptions
): Promise<CipherResponse> => {
  const { client, noteThumbnailUrl } = options;

  const cipherView = new CipherView();
  cipherView.id = paper.id;
  cipherView.name = paper.name.replace(".cozy-note", "");
  cipherView.type = CipherType.Paper;
  cipherView.paper = new PaperView();
  cipherView.paper.type = PaperType.Note;
  cipherView.paper.noteContent = await client
    .getStackClient()
    .fetchJSON("GET", "/notes/" + paper.id + "/text");
  cipherView.paper.illustrationThumbnailUrl = noteThumbnailUrl;
  cipherView.fields = buildFieldsFromPaper(i18nService, paper);

  const cipherEncrypted = await cipherService.encrypt(cipherView);
  const cipherViewEncrypted = new CipherView(cipherEncrypted);
  const cipherViewResponse = new CipherResponse(cipherViewEncrypted);
  cipherViewResponse.id = cipherEncrypted.id;
  cipherViewResponse.name = cipherEncrypted.name.encryptedString;

  cipherViewResponse.paper = new PaperApi();
  cipherViewResponse.paper.type = cipherView.paper.type;
  cipherViewResponse.paper.noteContent = cipherView.paper.noteContent;
  cipherViewResponse.paper.illustrationThumbnailUrl = cipherView.paper.illustrationThumbnailUrl;
  cipherViewResponse.fields = copyEncryptedFields(cipherEncrypted.fields);

  return cipherViewResponse;
};
