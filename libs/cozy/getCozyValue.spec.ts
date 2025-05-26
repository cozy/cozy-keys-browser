import { CozyAutofillOptions } from "../../apps/browser/src/autofill/services/abstractions/autofill.service";

import { selectDataWithCozyProfile } from "./getCozyValue";

// PROFILES

const EMPTY_PROFILE: CozyAutofillOptions = {};

const HOME_ONLY_PROFILE: CozyAutofillOptions = {
  label: "home",
};

const HOME_AND_TYPE_PROFILE: CozyAutofillOptions = {
  label: "home",
  type: "iPhone",
};

const WORK_ONLY_PROFILE: CozyAutofillOptions = {
  label: "work",
};

const WORK_AND_TYPE_PROFILE: CozyAutofillOptions = {
  label: "work",
  type: "Cozy Cloud",
};

const EMPTY_PROFILE_WITH_PHONE: CozyAutofillOptions = {
  value: "0",
};

// ELEMENTS

const VALUE_ONLY_PHONE_ELEMENT = { number: "0" };

const HOME_ONLY_ELEMENT = { number: "0", label: "home" };

const HOME_AND_TYPE_ELEMENT = { number: "1", label: "home", type: "iPhone" };

const WORK_ONLY_ELEMENT = { number: "2", label: "work" };

const WORK_AND_TYPE_ELEMENT = { number: "3", label: "work", type: "Cozy Cloud" };

const OTHER_WORK_ONLY_ELEMENT = { number: "4", label: "work" };

describe("mapping", () => {
  describe("selectDataWithCozyProfile", () => {
    describe("with no element", () => {
      it("should handle undefined array", () => {
        const dataArray: any = undefined;

        expect(selectDataWithCozyProfile(dataArray, HOME_ONLY_PROFILE)).toEqual(undefined);
      });

      it("should handle empty array", () => {
        const dataArray: any = [];

        expect(selectDataWithCozyProfile(dataArray, HOME_ONLY_PROFILE)).toEqual(undefined);
      });
    });

    describe("with one element", () => {
      it("should return return the element whatever the cozy Profile", () => {
        const dataArray = [HOME_AND_TYPE_ELEMENT];

        expect(selectDataWithCozyProfile(dataArray, EMPTY_PROFILE)).toEqual(HOME_AND_TYPE_ELEMENT);
        expect(selectDataWithCozyProfile(dataArray, HOME_ONLY_PROFILE)).toEqual(
          HOME_AND_TYPE_ELEMENT,
        );
        expect(selectDataWithCozyProfile(dataArray, HOME_AND_TYPE_PROFILE)).toEqual(
          HOME_AND_TYPE_ELEMENT,
        );
        expect(selectDataWithCozyProfile(dataArray, WORK_ONLY_PROFILE)).toEqual(
          HOME_AND_TYPE_ELEMENT,
        );
        expect(selectDataWithCozyProfile(dataArray, WORK_AND_TYPE_PROFILE)).toEqual(
          HOME_AND_TYPE_ELEMENT,
        );
      });
    });

    describe("with multiple elements", () => {
      it("should return return first same label element if label only", () => {
        const dataArray = [HOME_ONLY_ELEMENT, WORK_ONLY_ELEMENT];

        expect(selectDataWithCozyProfile(dataArray, WORK_ONLY_PROFILE)).toEqual(WORK_ONLY_ELEMENT);
      });

      it("should return return corresponding value and same label element if value and label only", () => {
        const dataArray = [WORK_ONLY_ELEMENT, OTHER_WORK_ONLY_ELEMENT];

        expect(
          selectDataWithCozyProfile(dataArray, {
            value: "4",
            label: "work",
          }),
        ).toEqual(OTHER_WORK_ONLY_ELEMENT);
      });

      it("should return return first same label and type element if correct label and type", () => {
        const dataArray = [HOME_ONLY_ELEMENT, HOME_AND_TYPE_ELEMENT];

        expect(selectDataWithCozyProfile(dataArray, HOME_AND_TYPE_PROFILE)).toEqual(
          HOME_AND_TYPE_ELEMENT,
        );
      });

      it("should return return first same label element if no correct label and type", () => {
        const dataArray = [HOME_ONLY_ELEMENT, WORK_ONLY_ELEMENT];

        expect(selectDataWithCozyProfile(dataArray, HOME_AND_TYPE_PROFILE)).toEqual(
          HOME_ONLY_ELEMENT,
        );
      });

      it("should return return first random label element if no correct label and type neither label", () => {
        const dataArray = [WORK_ONLY_ELEMENT, WORK_AND_TYPE_ELEMENT];

        expect(selectDataWithCozyProfile(dataArray, HOME_AND_TYPE_PROFILE)).toEqual(
          WORK_ONLY_ELEMENT,
        );
      });

      it("should return return first random element if nothing", () => {
        const dataArray = [WORK_ONLY_ELEMENT, WORK_AND_TYPE_ELEMENT];

        expect(selectDataWithCozyProfile(dataArray, EMPTY_PROFILE)).toEqual(WORK_ONLY_ELEMENT);
      });

      it("should return correct data if selecting an element without profile", () => {
        const dataArray = [WORK_AND_TYPE_ELEMENT, VALUE_ONLY_PHONE_ELEMENT];

        expect(selectDataWithCozyProfile(dataArray, EMPTY_PROFILE_WITH_PHONE)).toEqual(
          VALUE_ONLY_PHONE_ELEMENT,
        );
      });

      it("should not match element empty profile with empty element", () => {
        const dataArray = [WORK_AND_TYPE_ELEMENT, VALUE_ONLY_PHONE_ELEMENT];

        expect(selectDataWithCozyProfile(dataArray, EMPTY_PROFILE)).toEqual(WORK_AND_TYPE_ELEMENT);
      });
    });
  });
});
