import CozyClient from "cozy-client/types/CozyClient";
import { Node, Schema } from "prosemirror-model";
import { EditorState } from "prosemirror-state";

import { PaperType } from "@bitwarden/common/enums/paperType";
import { PaperApi } from "@bitwarden/common/models/api/paper.api";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CipherResponse } from "@bitwarden/common/vault/models/response/cipher.response";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { PaperView } from "@bitwarden/common/vault/models/view/paper.view";

import { buildFieldsFromPaper, copyEncryptedFields, buildField } from "./fields.helper";

interface NoteConversionOptions {
  noteIllustrationUrl: string;
}

export const isNote = (document: any) => document.mime === "text/vnd.cozy.note+markdown";

export const fetchNoteIllustrationUrl = async (client: CozyClient) => {
  const icon = await client.getStackClient().getIconURL({
    type: "app",
    slug: "notes",
  });

  return icon;
};

export const noteToText = (note: any): string => {
  const schema = new Schema({
    marks: Object.fromEntries(note.attributes.metadata.schema.marks),
    nodes: Object.fromEntries(note.attributes.metadata.schema.nodes),
  });

  const node = Node.fromJSON(schema, note.attributes.metadata.content);

  const state = EditorState.create({
    schema,
    doc: node,
  });

  const textContent: string[] = [];

  state.doc.content.descendants((node) => {
    if (node.isTextblock) {
      textContent.push(node.textContent);
    }
  });

  const textOnly = textContent?.join("\n");

  return textOnly;
};
export const convertNoteToCipherResponse = async (
  cipherService: any,
  i18nService: any,
  paper: any,
  options: NoteConversionOptions
): Promise<CipherResponse> => {
  const { noteIllustrationUrl } = options;

  const cipherView = new CipherView();
  cipherView.id = paper.id;
  cipherView.name = paper.name.replace(".cozy-note", "");
  cipherView.type = CipherType.Paper;
  cipherView.paper = new PaperView();
  cipherView.paper.type = PaperType.Note;
  cipherView.paper.noteContent = noteToText(paper);

  cipherView.paper.illustrationThumbnailUrl = noteIllustrationUrl;
  cipherView.paper.illustrationUrl = noteIllustrationUrl;
  cipherView.paper.qualificationLabel = paper.metadata.qualification.label;
  cipherView.fields = buildFieldsFromPaper(i18nService, paper);
  cipherView.fields.push(buildField(i18nService.t("content"), cipherView.paper.noteContent));

  const cipherEncrypted = await cipherService.encrypt(cipherView);
  const cipherViewEncrypted = new CipherView(cipherEncrypted);
  const cipherViewResponse = new CipherResponse(cipherViewEncrypted);
  cipherViewResponse.id = cipherEncrypted.id;
  cipherViewResponse.name = cipherEncrypted.name.encryptedString;

  cipherViewResponse.paper = new PaperApi();
  cipherViewResponse.paper.type = cipherView.paper.type;
  cipherViewResponse.paper.noteContent = cipherEncrypted.paper.noteContent?.encryptedString ?? "";
  cipherViewResponse.paper.illustrationThumbnailUrl =
    cipherEncrypted.paper.illustrationThumbnailUrl.encryptedString;
  cipherViewResponse.paper.illustrationUrl = cipherEncrypted.paper.illustrationUrl.encryptedString;
  cipherViewResponse.paper.qualificationLabel =
    cipherEncrypted.paper.qualificationLabel.encryptedString;
  cipherViewResponse.fields = copyEncryptedFields(cipherEncrypted.fields);
  cipherViewResponse.creationDate = paper.cozyMetadata.createdAt;
  cipherViewResponse.revisionDate = paper.cozyMetadata.updatedAt;

  return cipherViewResponse;
};
