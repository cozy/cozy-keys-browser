import CozyClient from "cozy-client/types/CozyClient";
import { Node, Schema } from "prosemirror-model";
import { EditorState } from "prosemirror-state";

import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { PaperType } from "@bitwarden/common/enums/paperType";
import { SymmetricCryptoKey } from "@bitwarden/common/models/domain/symmetric-crypto-key";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CipherData } from "@bitwarden/common/vault/models/data/cipher.data";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { PaperView } from "@bitwarden/common/vault/models/view/paper.view";

import { buildFieldsFromPaper, buildField } from "./fields.helper";

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
export const convertNoteToCipherData = async (
  cipherService: CipherService,
  i18nService: I18nService,
  paper: any,
  options: NoteConversionOptions,
  key?: SymmetricCryptoKey
): Promise<CipherData> => {
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
  cipherView.favorite = !!paper.cozyMetadata.favorite;
  cipherView.creationDate = new Date(paper.cozyMetadata.createdAt);
  cipherView.revisionDate = new Date(paper.cozyMetadata.updatedAt);

  const cipherEncrypted = await cipherService.encrypt(cipherView, key);

  const cipherData = cipherEncrypted.toCipherData();

  return cipherData;
};
