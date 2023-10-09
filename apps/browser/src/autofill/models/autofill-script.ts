export default class AutofillScript {
  /* Cozy custo
  script: string[][] = [];
  */
  script: (string | string | string | any)[][] = [];
  /* end custo */
  documentUUID: any = {};
  properties: any = {};
  options: any = {};
  metadata: any = {};
  autosubmit: any = null;
  savedUrls: string[];
  untrustedIframe: boolean;
  type?: string; // Cozy custo

  constructor(documentUUID: string) {
    this.documentUUID = documentUUID;
  }
}
