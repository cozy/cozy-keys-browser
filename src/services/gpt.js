import axios from "axios";

import {
  AutoFillConstants,
} from "./autofillConstants";


// "title", "firstName", "lastName", "username", "email", "phone", "address", "city", "zipCode", "company", "password", "unknown"


const uploadByOpId = (fillScript, field, value) => {
  const script = ["upload_by_opid", field.opid, value];
  fillScript.script.push(script);
}

export const uploadFile = (fillScript, field) => {
  let name = field["label-tag"]
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "");
  name = name + ".pdf"
  
  const value = {
    name,
    content: [""],
    type: 'application/pdf'
  }
  uploadByOpId(fillScript, field, value)
}

export const fillFieldsByGPT = async (fillScript, pageDetails, options, fillFct) => {
  const userIdentity = options.cipher.identity
  for (const f of pageDetails.fields) {
    if (!f.tagName === "span") {
      continue;
    }
    if (AutoFillConstants.ExcludedAutofillTypes.indexOf(f.type) > -1) {
      continue;
    }
    if (!f['label-tag']) {
      continue
    }

    if (f.type === "file") {
      console.log('found file input : ', f)
      uploadFile(fillScript, f);
    }


    // Taken from IdentityAutoFillConstants.IdentityAttributes. Some might missing, but not sure about releveance
    const fieldDesc = {
      label: f["label-tag"],
    };
    console.log("ask openAI for field : ", fieldDesc);
    let category = await getMultipleFieldsCategoryFromOpenAI(fieldDesc);
    console.log("OpenAI resp : ", category);

    if (category && category != "unknown") {
      if (category === "address") {
        category = "address1"
      }
      const value = userIdentity[category]
      console.log('value : ', value);
      if (value) {
        fillFct(fillScript, f, value, "identity");
      }
    }
  }
  return fillScript
};



export const fillFieldsAtOnceByGPT = async (fillScript, pageDetails, options, fillFct) => {
  try {
    const userIdentity = options.cipher.identity;
    console.log('user identity : ', userIdentity);

    const fieldsLabels = pageDetails.fields
      .filter((f) => {
        if (!f.tagName === "span") {
          return false
        }
        if (AutoFillConstants.ExcludedAutofillTypes.indexOf(f.type) > -1) {
          return false
        }
        if (!f["label-tag"]) {
          return false
        }
        if (f.type === "file") {
          return false
        }
        return true
      })
      .map((f) => f["label-tag"])

    for (const f of pageDetails.fields) {
      if (f.type === "file") {
        console.log("found file input : ", f);
        uploadFile(fillScript, f);
      }
    }

    console.log("fields : ", fieldsLabels );
    const resp = await getMultipleFieldsCategoryFromOpenAI(fieldsLabels);
    console.log("OpenAI resp : ", resp);

    const fields = getJSONFromResponse(resp);
    if (!fields) {
      console.log('not JSON')
      return fillScript;
    }

    for (const field of fields) {
      let category = field.category;
      if (category !== "unknown") {
        if (category === "address") {
          category = "address1";
        }
        const f = pageDetails.fields.find(f => f['label-tag'] === field.label)
        if (!f) {
          console.error("Could not find matching field ", field)
          continue
        }
        const value = userIdentity[category];
        console.log("value : ", value);
        if (value) {
          fillFct(fillScript, f, value, "identity");
        }
      }
    }
  } catch (err) {
    console.error('err : ', err)
  }

  return fillScript;
};

const getJSONFromResponse = (response) => {
  try {
    const respJSON = JSON.parse(response)
    return respJSON
  } catch (err) {
    return null
  }
}

const getSingleFieldCategoryFromOpenAI = async (field) => {
  try {
    const resp = await axios.post(
      "http://localhost:3000/openai/fieldCategory",
      { field },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    return resp.data.data

  } catch (error) {
    if (error.response) {
      console.log(error.response.status);
      console.log(error.response.data);
    } else {
      console.log(error.message);
    }
  }
};

const getMultipleFieldsCategoryFromOpenAI = async (labels) => {
  try {
    const resp = await axios.post("http://localhost:8000/openai/categories", { labels }, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    return resp.data.data;
  } catch (error) {
    if (error.response) {
      console.log(error.response.status);
      console.log(error.response.data);
    } else {
      console.log(error.message);
    }
  }
};

