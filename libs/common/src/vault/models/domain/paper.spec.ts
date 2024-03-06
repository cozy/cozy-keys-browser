// Cozy customization
import { PaperType } from "../../../enums/paperType";
import { PaperData } from "../data/paper.data";

import { Paper } from "./paper";

describe("Paper", () => {
  let data: PaperData;

  beforeEach(() => {
    data = {
      type: PaperType.Paper,
      ownerName: "Alice",
      illustrationThumbnailUrl: "https://example.com/image",
      noteContent: undefined,
    };
  });

  it("Convert from empty", () => {
    const data = new PaperData();
    const paper = new Paper(data);

    expect(paper).toEqual({
      type: undefined,
      ownerName: undefined,
      illustrationThumbnailUrl: undefined,
      noteContent: undefined,
    });
  });

  it("Convert Paper", () => {
    const paper = new Paper(data);

    expect(paper).toEqual({
      type: 1,
      ownerName: "Alice",
      illustrationThumbnailUrl: "https://example.com/image",
      noteContent: undefined,
    });
  });

  it("Decrypt", async () => {
    const paper = new Paper();
    paper.type = PaperType.Paper;
    paper.ownerName = "Alice";
    paper.illustrationThumbnailUrl = "https://example.com/image";
    paper.noteContent = undefined;

    const view = await paper.decrypt(null);

    expect(view).toEqual({
      type: 1,
      ownerName: "Alice",
      illustrationThumbnailUrl: "https://example.com/image",
      noteContent: undefined,
    });
  });
});
// Cozy customization end
