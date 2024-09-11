import { IOCozyContact } from "cozy-client/types/types";

import { AutofillFieldQualifier } from "../../apps/browser/src/autofill/enums/autofill-field.enums";

import { createOrUpdateCozyContact } from "./createOrUpdateCozyDoctype";
import { COZY_ATTRIBUTES_MAPPING } from "./mapping";

describe("createOrUpdateCozyContact", () => {
  it("should add a new value to an array field with existing data", async () => {
    const contact = {
      name: {
        familyName: "Doe",
        givenName: "John",
      },
      email: [
        {
          address: "john.doe@example.com",
          primary: true,
          type: "home",
          label: "Home",
        },
      ],
    } as unknown as IOCozyContact;
    const fieldQualifier = AutofillFieldQualifier.identityEmail;
    const cozyAttributeModel = COZY_ATTRIBUTES_MAPPING[fieldQualifier];
    const newAutofillValue = {
      value: "jdoe@test.com",
      type: "work",
      label: "Work",
    };
    const expectedContact = {
      name: {
        familyName: "Doe",
        givenName: "John",
      },
      email: [
        {
          address: "john.doe@example.com",
          primary: true,
          type: "home",
          label: "Home",
        },
        {
          address: "jdoe@test.com",
          primary: false,
          type: "work",
          label: "Work",
        },
      ],
    };
    const result = await createOrUpdateCozyContact({
      contact,
      cozyAttributeModel,
      newAutofillValue,
    });
    expect(result).toEqual(expectedContact);
  });

  it("should add a new value to an empty array field", async () => {
    const contact = {
      name: {
        familyName: "Doe",
        givenName: "John",
      },
    } as unknown as IOCozyContact;
    const fieldQualifier = AutofillFieldQualifier.identityEmail;
    const cozyAttributeModel = COZY_ATTRIBUTES_MAPPING[fieldQualifier];
    const newAutofillValue = {
      value: "jdoe@test.com",
      type: "work",
      label: "Work",
    };
    const expectedContact = {
      name: {
        familyName: "Doe",
        givenName: "John",
      },
      email: [
        {
          address: "jdoe@test.com",
          primary: true,
          type: "work",
          label: "Work",
        },
      ],
    };
    const result = await createOrUpdateCozyContact({
      contact,
      cozyAttributeModel,
      newAutofillValue,
    });
    expect(result).toEqual(expectedContact);
  });

  it("should set a new value to an existing non-array field", async () => {
    const contact = {
      name: {
        familyName: "Doe",
        givenName: "John",
      },
    } as unknown as IOCozyContact;
    const fieldQualifier = AutofillFieldQualifier.identityFirstName;
    const cozyAttributeModel = COZY_ATTRIBUTES_MAPPING[fieldQualifier];
    const newAutofillValue = {
      value: "Jane",
    };
    const expectedContact = {
      name: {
        familyName: "Doe",
        givenName: "Jane",
      },
    };
    const result = await createOrUpdateCozyContact({
      contact,
      cozyAttributeModel,
      newAutofillValue,
    });
    expect(result).toEqual(expectedContact);
  });

  it("should set a new value to an empty non-array field", async () => {
    const contact = {} as unknown as IOCozyContact;
    const fieldQualifier = AutofillFieldQualifier.identityFirstName;
    const cozyAttributeModel = COZY_ATTRIBUTES_MAPPING[fieldQualifier];
    const newAutofillValue = {
      value: "Jane",
    };
    const expectedContact = {
      name: {
        givenName: "Jane",
      },
    };
    const result = await createOrUpdateCozyContact({
      contact,
      cozyAttributeModel,
      newAutofillValue,
    });
    expect(result).toEqual(expectedContact);
  });
});
