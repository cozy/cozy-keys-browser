export default class AutofillScript {
    script: string[][] = [];
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
