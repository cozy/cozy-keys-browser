import { IOCozyFile } from "cozy-client/types/types";

import { CozyAutofillOptions } from "../../apps/browser/src/autofill/services/abstractions/autofill.service";

import { FILES_DOCTYPE } from "./constants";
import { selectPaper, selectDataWithCozyProfile } from "./getCozyValue";

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

const HOME_ONLY_ELEMENT = { phone: "0", label: "home" };

const HOME_AND_TYPE_ELEMENT = { phone: "1", label: "home", type: "iPhone" };

const WORK_ONLY_ELEMENT = { phone: "2", label: "work" };

const WORK_AND_TYPE_ELEMENT = { phone: "3", label: "work", type: "Cozy Cloud" };

describe("getCozyValue", () => {
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

const RIB1 = {
  _id: "b4698ba56c7d0ae2faeb9571d4e0ce60",
  _type: FILES_DOCTYPE,
  name: "RIB 1 - Bob John Doe.pdf",
  metadata: {
    bicNumber: "BIC99999999",
    datetime: "2024-09-12T09:24:59.000Z",
    datetimeLabel: "datetime",
    number: "FR9999999999999999999999999",
    qualification: {
      icon: "bank-check",
      label: "bank_details",
      purpose: "attestation",
      sourceCategory: "bank",
      subjects: ["bank_account"],
    },
  },
} as unknown as IOCozyFile;

const RIB2 = {
  _id: "6bfca732cd8f258cde5b012f3b48dd67",
  _type: FILES_DOCTYPE,
  name: "RIB 2 - Bob John Doe.pdf",
  metadata: {
    bicNumber: "BIC11111111",
    datetime: "2024-07-25T10:13:17.000Z",
    datetimeLabel: "datetime",
    number: "FR1111111111111111111111111",
    qualification: {
      icon: "bank-check",
      label: "bank_details",
      purpose: "attestation",
      sourceCategory: "bank",
      subjects: ["bank_account"],
    },
  },
} as unknown as IOCozyFile;

describe("getCozyValue", () => {
  describe("selectPaper", () => {
    it("should return the corresponding paper if it exists", () => {
      const selectedPaper = selectPaper({
        papers: [RIB1, RIB2],
        cozyAutofillOptions: {
          value: "FR1111111111111111111111111",
        },
      });

      // Add your assertions here
      expect(selectedPaper).toEqual(RIB2);
    });

    it("should return the first paper if no corresponding paper exists", () => {
      const selectedPaper = selectPaper({
        papers: [RIB1, RIB2],
        cozyAutofillOptions: { value: "non-existing-value" },
      });

      expect(selectedPaper).toEqual(RIB1);
    });
  });
});
