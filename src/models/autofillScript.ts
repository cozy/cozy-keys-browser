export default class AutofillScript {
  script: any[][] = [];
  documentUUID: any = {};
  properties: any = {};
  options: any = {};
  metadata: any = {};
  autosubmit: any = null;
  type: string = null;

  constructor(documentUUID: string) {
    this.documentUUID = documentUUID;
  }
}
