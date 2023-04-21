import AutofillPageDetails from "../../models/autofillPageDetails";

export abstract class AutofillService {
  getFormsWithPasswordFields: (pageDetails: AutofillPageDetails) => any[];
  doAutoFill: (options: any) => Promise<string>;
  doAutoFillActiveTab: (pageDetails: any, fromCommand: boolean) => Promise<string>;
  generateFieldsForInPageMenuScripts: (
    pageDetails: any,
    connected: boolean,
    frameId: number
  ) => any;
  postFilterFieldsForInPageMenu: (scriptsObj: any, forms: any, fields: any) => void;
}
