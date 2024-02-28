// Cozy customization
import { PaperData } from "../data/paper.data";

import { Paper } from "./paper";

describe("Paper", () => {
  let data: PaperData;

  beforeEach(() => {
    data = {
      ownerName: "Alice",
      illustrationThumbnailUrl: "https://example.com/image",
    };
  });

  it("Convert from empty", () => {
    const data = new PaperData();
    const paper = new Paper(data);

    expect(paper).toEqual({
      type: undefined,
      illustrationThumbnailUrl: undefined,
    });
  });

  it("Convert", () => {
    const paper = new Paper(data);

    expect(paper).toEqual({
      ownerName: "Alice",
      illustrationThumbnailUrl: "https://example.com/image",
    });
  });

  it("Decrypt", async () => {
    const paper = new Paper();
    paper.ownerName = "Alice";
    paper.illustrationThumbnailUrl = "https://example.com/image";

    const view = await paper.decrypt(null);

    expect(view).toEqual({
      ownerName: "Alice",
      illustrationThumbnailUrl: "https://example.com/image",
    });
  });
});
// Cozy customization end
