import { mockEnc } from "../../../../spec/utils";
import { PaperType } from "../../../enums/paperType";
import { PaperData } from "../../../vault/models/data/paper.data";
import { Paper } from "../../models/domain/paper";

describe("Paper", () => {
  let data: PaperData;

  beforeEach(() => {
    data = {
      type: PaperType.Paper,
      ownerName: "encOwnerName",
      illustrationThumbnailUrl: "encIllustrationThumbnailUrl",
      illustrationUrl: "encIllustrationUrl",
      qualificationLabel: "encQualificationLabel",
      noteContent: "encNoteContent",
    };
  });

  it("Convert from empty", () => {
    const data = new PaperData();
    const paper = new Paper(data);

    expect(paper).toEqual({
      type: undefined,
      ownerName: null,
      illustrationThumbnailUrl: null,
      illustrationUrl: null,
      qualificationLabel: null,
      noteContent: null,
    });
  });

  it("Convert", () => {
    const paper = new Paper(data);

    expect(paper).toEqual({
      type: 1,
      ownerName: { encryptedString: "encOwnerName", encryptionType: 0 },
      illustrationThumbnailUrl: {
        encryptedString: "encIllustrationThumbnailUrl",
        encryptionType: 0,
      },
      illustrationUrl: { encryptedString: "encIllustrationUrl", encryptionType: 0 },
      qualificationLabel: { encryptedString: "encQualificationLabel", encryptionType: 0 },
      noteContent: { encryptedString: "encNoteContent", encryptionType: 0 },
    });
  });

  it("Decrypt", async () => {
    const paper = new Paper();
    paper.type = PaperType.Paper;
    paper.ownerName = mockEnc("ownerName");
    paper.illustrationThumbnailUrl = mockEnc("illustrationThumbnailUrl");
    paper.illustrationUrl = mockEnc("illustrationUrl");
    paper.qualificationLabel = mockEnc("qualificationLabel");
    paper.noteContent = mockEnc("noteContent");

    const view = await paper.decrypt(null);

    expect(view).toEqual({
      type: 1,
      ownerName: "ownerName",
      illustrationThumbnailUrl: "illustrationThumbnailUrl",
      illustrationUrl: "illustrationUrl",
      qualificationLabel: "qualificationLabel",
      noteContent: "noteContent",
    });
  });
});
