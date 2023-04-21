import { zeroPadLeftUntilTwoChars } from "./strings";

describe("strings", () => {
  describe("zeroPadLeftUntilTwoChars", () => {
    it(`should return '00' if the input is empty`, () => {
      const result = zeroPadLeftUntilTwoChars("");
      expect(result).toEqual("00");
    });

    it(`should return '21' if the input is '2021'`, () => {
      const result = zeroPadLeftUntilTwoChars("2021");
      expect(result).toEqual("21");
    });

    it(`should return '21' if the input is '21'`, () => {
      const result = zeroPadLeftUntilTwoChars("21");
      expect(result).toEqual("21");
    });
  });
});
