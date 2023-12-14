import {Dtmf, PhoneTonePlayer} from '../services/phone-tone-player';

interface BankServiceInterface {
  observeDomForBank(collectFunction: any): boolean;
  getCurrentBankName(): string;
  typeOnKeyboard(codeToType: string, isARecall? : any): void;
  getBankKeyboardMenudEl(): HTMLElement;
}

class BaseBankService {

  protected correspondanceTable = new Array<number>(10);

  getCurrentBankName(){
    return CURRENT_BANK_NAME;
  }
  observeDomForBank(collectFunction: any): boolean{
    return false;
  }
}

class BaseOcrBankService extends BaseBankService {

  private iframePromise: Promise<void>;

  constructor(initOcr: boolean, modelName: string) {
    super();
    if (!initOcr) {
      return
    }
    // create iframe where Tensorflow model will be run to OCR the keys
    window.addEventListener("DOMContentLoaded", () => {
      const iframe = document.createElement("iframe");
      iframe.src = chrome.runtime.getURL("tensor/index.html?model=" + modelName);
      iframe.style.cssText = `display: none`;
      document.body.append(iframe);
      this.iframePromise = new Promise((resolve)=>{
        iframe.addEventListener("load", () => {
          resolve();
        })
      })
    })
  }

  protected async ocr(dataUrls: string[]) {
    const promise = new Promise((resolve) => {
      this.iframePromise.then(() => {
        // send key images to OCR in iframe
        chrome.runtime.sendMessage({
          command: "toTensorIframe-keysToOCR",
          dataUrls,
        },
        (r)=>{
          r.forEach( ( val: number, imageIndex: number ) => {
            this.correspondanceTable[val] = imageIndex;
          });
          resolve(this.correspondanceTable)
        }
      )})
    })
    return promise;
  }

}

let CURRENT_BANK_NAME: string;


/***********************************************************/
 // BankService for the test page
 // T04.0-Login-bank-keyboard.html
/****/
class BankService_test extends BaseBankService implements BankServiceInterface {

  observeDomForBank(collectFunction: any): boolean{
    setTimeout(() => {
      collectFunction();
    }, 5000);
    return true;
  }

  async typeOnKeyboard(codeToType: string, isARecall = false): Promise<void>{
    if (codeToType === "" ) { return }
    const key = codeToType.charAt(0);
    await playKeySound(key);
    this.typeOnKeyboard(codeToType.slice(1), true);
  }

  getBankKeyboardMenudEl(): HTMLElement{
    // console.log("getBankKeyboarMenudEl()", currentBankName)
    return document.querySelector(".keyboard");
  }
}



/***********************************************************/
 // BankService for banquepostale
/****/
class BankService_banquepostale extends BaseBankService implements BankServiceInterface {

  private keysElements: NodeList;

  getBankKeyboardMenudEl(): HTMLElement{
    return document.querySelector(".tb-container-cvdPsw");
  }

  buildCorrespondanceTable() {
    // iterate on current keyboard to find the correspondance table
    this.keysElements = document.querySelectorAll("[data-tb-cvd-id=password] button");
    this.keysElements.forEach( (button: HTMLButtonElement, keyIndex: number) => {
      this.correspondanceTable[parseInt(button.textContent)] = keyIndex;
    });
  }

  async typeOnKeyboard(codeToType: string, isARecall = false): Promise<void>{
    if (codeToType === "" ) { return }
    if (!isARecall) {
      const isKeyboardInHiddenElmt = !!document.querySelector(".ecran .tb-volet-hidden [data-tb-form-id='motdepasse']")
      if (isKeyboardInHiddenElmt) { return }
      this.buildCorrespondanceTable();
      // check if there are some keys already typed
      const selectedPuce = document.querySelector(".tb-container-cvdPsw .--select") as HTMLInputElement;
      if (selectedPuce) {
        (document.querySelector("#reset-password button") as HTMLButtonElement).click();
        await playKeySound("A", 50);
        setTimeout( () => { // just wait for the page to delete previously typed password
          this.typeOnKeyboard(codeToType, true);
        }, 200);
      } else {
        this.typeOnKeyboard(codeToType, true);
      }
    } else {
      // find key element and click on it
      const key = codeToType.charAt(0)
      const keyEl = (this.keysElements[this.correspondanceTable[parseInt(key)]] as HTMLButtonElement);
      keyEl.style.cssText = "background: #3b51d5; color: #f0f3ff;"
      keyEl.click();
      await playKeySound(key);
      this.typeOnKeyboard(codeToType.slice(1), true);
      keyEl.style.cssText = "";
    }
  }
}


/***********************************************************/
 // BankService for Société Générale
/****/
class BankService_societegenerale extends BaseOcrBankService implements BankServiceInterface {

  private keysElements: NodeList | HTMLElement[];

  constructor(initOcr: boolean) {
    super(initOcr, "societegenerale")
  }

  getBankKeyboardMenudEl(): HTMLElement{
    const element = document.querySelector('#codeSecret')?.parentElement as HTMLElement;
    return element;
  }

  async buildCorrespondanceTable() {
    // get the keyboard image
    const keyboardEl: HTMLImageElement = document.querySelector("#img_clavier");
    const img = new Image()
    img.src = keyboardEl.src;
    const promise = new Promise((resolve)=>{
      img.onload = resolve
    })
    await promise;

    //* Image geometry
    const
      X0 = 4,
      Y0 = 4,
      Dx = 15,
      Dy = 10,
      STEP_X = 64-X0,
      STEP_Y = 64-Y0,
      IMG_W = 55-2*Dx-X0+1,
      IMG_H = 55-2*Dy-Y0+1;

    //* canvas
    const canvasForKeys = document.createElement("canvas");
    canvasForKeys.width = 22;
    canvasForKeys.height = 32;
    const ctxForKeys = canvasForKeys.getContext('2d');

    //* ************************************************************************
    //* the keyboard is a single image, we have to split it into an image
    //* for each key and run ocr
    //* ************************************************************************
    const dataUrls = [];
    for (let j = 0; j < 4; j++) {
      for (let i = 0; i < 4; i++) {
        const x = X0 + i * STEP_X + Dx;
        const y = Y0 + j * STEP_Y + Dy;
        ctxForKeys.drawImage(img, x, y, IMG_W, IMG_H, 0, 0, 22, 32) // all key images must be 22*32 to be ocr-ized
        dataUrls.push(canvasForKeys.toDataURL())
      }
    }
    // remove dataUrls corresponding to empty keys
    const emptyDataUrl = dataUrls.reduce((shortestDataUrl: string, currentValue: string) => {
      return currentValue.length < shortestDataUrl.length ? currentValue : shortestDataUrl
    }, dataUrls[0]);
    const nonEmptydataUrls = dataUrls.filter(url => url !== emptyDataUrl );
    // run OCR
    await this.ocr(nonEmptydataUrls);
    // usefull to get data urls of keys in order to train the model
    // console.log("\ndataUrls");
    // console.log(dataUrls);

    // find the correct position in the matrix
    let key_position = 0;
    let key_value;
    const correspondanceTableWithEmptykeys = new Array(10);
    for (let k = 0; k < dataUrls.length; k++) {
      const url = dataUrls[k];
      if (url !== emptyDataUrl) {
        key_value = this.correspondanceTable.findIndex(pos => pos === key_position)
        correspondanceTableWithEmptykeys[key_value] = k;
        key_position += 1;
      }
    }
    this.correspondanceTable = correspondanceTableWithEmptykeys;
  }

  async typeOnKeyboard(codeToType: string, isARecall = false): Promise<void>{
    if (codeToType === "" ) { return }
    if (!isARecall) {
      this.keysElements = Array.from(document.querySelectorAll("#img_container > div"));
      // Convert buttons NodeList to an array
      this.keysElements.splice(16);
      this.keysElements.reverse();
      if (this.correspondanceTable[0] == undefined) {
        await this.buildCorrespondanceTable();
      }
      const regex = /auth-pwd-[123456789]/;
      const inputEl = document.querySelector("#codeSecret");
      const hasActiveBullets = inputEl.className.search(regex) > -1;
      if (hasActiveBullets) {
        (document.querySelector("#codeSecret-delete") as HTMLButtonElement).click();
        await playKeySound("A", 50);
      }
      setTimeout( () => { // just wait for the page to delete previously typed password
        this.typeOnKeyboard(codeToType, true);
      }, 200);
    } else {
      // find key element and click on it
      const key = codeToType.charAt(0)
      const keyEl: HTMLButtonElement = (this.keysElements[this.correspondanceTable[parseInt(key)]] as HTMLButtonElement);
      keyEl.click();
      await playKeySound(key);
      this.typeOnKeyboard(codeToType.slice(1), true);
    }
  }
}


/***********************************************************/
 // BankService for BNP
/****/
class BankService_bnp extends BaseOcrBankService implements BankServiceInterface {

  private keysElements: NodeList;

  constructor(initOcr: boolean) {
    super(initOcr, "bnp")
  }

  getBankKeyboardMenudEl(): HTMLElement{
    const element = document.querySelector("#initPass") as HTMLElement;
    return element;
  }

  async buildCorrespondanceTable() {
    // get the keyboard image
    const keyboardEl = document.querySelector("#secret-nbr-keyboard") as HTMLDivElement;
    const style = window.getComputedStyle(keyboardEl);
    const imgUrl = style.backgroundImage.slice(4, -1).replace(/"/g, "")
    const img = new Image()
    img.src = imgUrl;
    const promise = new Promise((resolve)=>{
      img.onload = resolve
    })
    await promise;
    // the keyboard is a single image, we have to split it into an image
    // Image geometry parameters
    const
      X0 = 3,
      Y0 = 2,
      IMG_W = 77 - 28 - 27, // 22 px
      IMG_H = 75 - 21 - 22, // 32 px
      STEP_X = 86-X0,
      STEP_Y = 82-Y0;

    // canvas
    const canvasForKeys = document.createElement("canvas");
    canvasForKeys.width = 22;
    canvasForKeys.height = 32;
    const ctxForKeys = canvasForKeys.getContext('2d');
    // get dataUrls for each key
    const dataUrls: string[] = [];
    for (let j = 0; j < 2; j++) {
      for (let i = 0; i < 5; i++) {
        const x = X0 + i * STEP_X;
        const y = Y0 + j * STEP_Y;
        ctxForKeys.drawImage(img, x + 28, y + 21, IMG_W, IMG_H, 0, 0, 22, 32) // all key images must be 22*32 to be ocr-ized
        dataUrls.push(canvasForKeys.toDataURL())
      }
    }
    // run ocr
    await this.ocr(dataUrls);
    // usefull to get data urls of keys in order to train the model
    // console.log("\ndataUrls");
    // console.log(dataUrls);
  }

  async typeOnKeyboard(codeToType: string, isARecall = false): Promise<void>{
    if (codeToType === "" ) { return }
    if (!isARecall) {
      this.keysElements = document.querySelectorAll("#secret-nbr-keyboard a");
      if (this.correspondanceTable[0] == undefined) {
        await this.buildCorrespondanceTable();
      }
      const hasActiveBullets = (document.querySelector("#secret-nbr") as HTMLInputElement).value !== '';
      if (hasActiveBullets) {
        (document.querySelector("#initPass") as HTMLButtonElement).click();
        await playKeySound("A", 50);
      }
      setTimeout( () => { // just wait for the page to delete previously typed password
        this.typeOnKeyboard(codeToType, true);
      }, 200);
    } else {
      // find key element and click on it
      const key = codeToType.charAt(0)
      const keyEl: HTMLButtonElement = (this.keysElements[this.correspondanceTable[parseInt(key)]] as HTMLButtonElement);
      keyEl.click();
      await playKeySound(key);
      this.typeOnKeyboard(codeToType.slice(1), true);
    }
  }
}



/***********************************************************/
 // BankService for creditagricole
/****/
class BankService_creditagricole extends BaseBankService implements BankServiceInterface {

  private keysElements: NodeList;

  getBankKeyboardMenudEl(): HTMLElement{
    return document.querySelector("#clavier_num");
  }

  buildCorrespondanceTable() {
    // iterate on current keyboard to find the correspondance table
    this.keysElements = document.querySelectorAll(".Login-keypad .Login-key div");
    this.keysElements.forEach( (div: HTMLElement, keyIndex: number) => {
      this.correspondanceTable[parseInt(div.textContent)] = keyIndex;
    });
  }

  async typeOnKeyboard(codeToType: string, isARecall = false): Promise<void>{
    if (codeToType === "" ) { return }
    if (!isARecall) {
      this.buildCorrespondanceTable();
      // check if there are some keys already typed
      const currentlyTypedInput = document.querySelector("input#Login-password") as HTMLInputElement;
      if ( currentlyTypedInput.value !== "") {
        (document.querySelector(".add-clear-span span") as HTMLButtonElement).click();
        await playKeySound("A", 50);
        setTimeout( () => { // just wait for the page to delete previously typed password
          this.typeOnKeyboard(codeToType, true);
        }, 200);
      } else {
        this.typeOnKeyboard(codeToType, true);
      }
    } else {
      // find key element and click on it
      const key = codeToType.charAt(0)
      const keyEl = (this.keysElements[this.correspondanceTable[parseInt(key)]] as HTMLButtonElement);
      keyEl.style.cssText = "background: #3b51d5; color: #f0f3ff;"
      keyEl.click();
      await playKeySound(key);
      this.typeOnKeyboard(codeToType.slice(1), true);
      keyEl.style.cssText = "";
    }
  }
}



/***********************************************************/
 // BankService for all banks of BPCE group :
 //   * CAISSEDEPARGNE
 //   * banquepopulaire
 //   * créditfoncier
 //   * créditcooperatif
 //   * banquepalatine
/****/
class BankService_BPCE_group extends BaseOcrBankService implements BankServiceInterface {

  private buttonElements: NodeList;

  constructor(initOcr: boolean) {
    super(initOcr, "caisse_epargne")
  }

  getBankKeyboardMenudEl(): HTMLElement{
    // console.log("getBankKeyboarMenudEl", document.querySelector("as-row-circles-password"));
    return document.querySelector("as-row-circles-password");
  }

  async buildCorrespondanceTable() {
    if (this.correspondanceTable[0]) {
      return
    }
    // iterate on current keyboard to find the correspondance table
    const dataUrls: string[] = [];
    const keysEls = document.querySelectorAll("as-virtual-keyboard as-keyboard-button button") as NodeListOf<HTMLElement>
    keysEls.forEach(keyEl => {
      const url = keyEl.style.background.slice(5,-26)
      dataUrls.push(url)
    });
    // send dataUrls to TensorFlow iframe
    return this.ocr(dataUrls);
  }

  async typeOnKeyboard(codeToType: string, isARecall = false): Promise<void>{
    if (codeToType === "" ) { return }
    if (!isARecall) {
      this.buttonElements = document.querySelectorAll("as-keyboard-button > button");
      await this.buildCorrespondanceTable();
      let hasActiveBullets = document.querySelector("as-row-circles-password .check") !== null;
      for (let i = 0; hasActiveBullets; i++) {
        (document.querySelector("as-row-circles-password button") as HTMLButtonElement).click();
        await playKeySound("A", 50);
        hasActiveBullets = document.querySelector("as-row-circles-password .check") !== null;
      }
      setTimeout( () => { // just wait for the page to delete previously typed password
        this.typeOnKeyboard(codeToType, true);
      }, 200);
    } else {
      // find key element and click on it
      const key = codeToType.charAt(0)
      const keyEl: HTMLButtonElement = (this.buttonElements[this.correspondanceTable[parseInt(key)]] as HTMLButtonElement);
      keyEl.click();
      await playKeySound(key);
      this.typeOnKeyboard(codeToType.slice(1), true);
    }
  }
}



/***********************************************************/
 // BankService for LCL
/****/
class BankService_lcl extends BaseBankService implements BankServiceInterface {

  observeDomForBank(collectFunction: any): boolean{
    const observer = new MutationObserver((mutations) => {
      for (let i = 0; i < mutations.length; i++) {
        const target = mutations[i].target;
        if ((target as HTMLElement).className === "pad-code") {
          collectFunction();
          observer.disconnect();
          break;
        }
      }
    });
    observer.observe(document.querySelector("body"), { childList: true, subtree: true });
    return true;
  }

  getBankKeyboardMenudEl(): HTMLElement{
    return document.querySelector(".pad-code");
  }

  async typeOnKeyboard(codeToType: string, isARecall = false): Promise<void>{
    if (codeToType === "" ) { return }
    if (!isARecall) {
      if (document.querySelector(".pad-dot.is-filled")) {
        (document.querySelector(".pad-reset") as HTMLButtonElement).click();
        await playKeySound("A", 50);
        setTimeout( () => { // just wait for the page to delete previously typed password
          this.typeOnKeyboard(codeToType, true);
        }, 200);
      } else {
        this.typeOnKeyboard(codeToType, true);
      }
    } else {
      // find key element and click on it
      const key = codeToType.charAt(0)
      const keyEl: HTMLElement  = document.querySelector(`.pad-keys > [value='${key}']`);
      keyEl.style.cssText = "background: #3b51d5; color: #f0f3ff;"
      keyEl.click();
      await playKeySound(key);
      this.typeOnKeyboard(codeToType.slice(1), true);
      keyEl.style.cssText = "";
    }
  }
}



/***********************************************************/
 // BankService for BOURSORAMA
/****/
class BankService_boursorama extends BaseBankService implements BankServiceInterface {

  private buttonElements: NodeList;
  private keyImageHashes:{ [index: string]: number } = {"0":-1961266208,"1":1806502122,"2":383789923,"3":-1617329400,"4":-323759857,"5":-2028372521,"6":1483506720,"7":927833434,"8":269012712,"9":1964989521}

  getBankKeyboardMenudEl(): HTMLElement{
    return document.querySelector("[data-id='form_fakePassword']");
  }

  buildCorrespondanceTable() {
    // iterate on current keyboard to find the correspondance table
    const keysElements = document.querySelectorAll(".password-input img");
    keysElements.forEach( (buttonImg: HTMLImageElement, imageIndex: number) => {
      const imageHash = hashCode(buttonImg.src);
      for (const key in this.keyImageHashes) {
        const h = this.keyImageHashes[key];
        if (h === imageHash) {
          this.correspondanceTable[parseInt(key)] = imageIndex;
          break;
        }
      }
    });
  }

  async typeOnKeyboard(codeToType: string, isARecall = false): Promise<void>{
    if (codeToType === "" ) { return }
    if (!isARecall) {
      this.buttonElements = document.querySelectorAll(".password-input button");
      this.buildCorrespondanceTable();
      let hasActiveBullets = document.querySelector(".c-circle-password__item.is-active") !== null;
      for (let i = 0; hasActiveBullets; i++) {
        (document.querySelector(".form-row-circles-password__backspace-icon") as HTMLButtonElement).click();
        await playKeySound("A", 50);
        hasActiveBullets = document.querySelector(".c-circle-password__item.is-active") !== null;
      }
      setTimeout( () => { // just wait for the page to delete previously typed password
        this.typeOnKeyboard(codeToType, true);
      }, 200);
    } else {
      // find key element and click on it
      const key = codeToType.charAt(0)
      const keyEl: HTMLButtonElement = (this.buttonElements[this.correspondanceTable[parseInt(key)]] as HTMLButtonElement);
      keyEl.click();
      await playKeySound(key);
      this.typeOnKeyboard(codeToType.slice(1), true);
    }
  }
}



/***********************************************************/
 // factory
 // const bankService = BankServiceFactory.createService()
/****/
export class BankServiceFactory {

  static createService(initOcr: boolean): BankServiceInterface {
    const currentBankName = getCurrentBankName();
    switch (currentBankName) {
      case "test":
        return new BankService_test();
      case "banquepostale":
        return new BankService_banquepostale();
      case "bnp":
        return new BankService_bnp(initOcr);
      case "boursorama":
        return new BankService_boursorama();
      case "caissedepargne":
      case "banquepopulaire":
      case "créditfoncier":
      case "créditcooperatif":
      case "banquepalatine":
        return new BankService_BPCE_group(initOcr);
      case "lcl":
        return new BankService_lcl();
      case "cagricole":
        return new BankService_creditagricole();
      case "societegenerale":
        return new BankService_societegenerale(initOcr);
    }
  }
}



/***********************************************************/
 // return the bank name of the current web page
 // (undefined if not a bank)
/****/
export const getCurrentBankName = (): string => {

  // console.log("getCurrentBankName", document.location.href);
  if (CURRENT_BANK_NAME) { return CURRENT_BANK_NAME }

  // test
  if (document.location.href === "http://localhost:3333/T04.0-Login-bank-keyboard.html" ) {
    CURRENT_BANK_NAME = "test"
  }
  // axabanque
  if (document.location.href === "axabanque") {
    CURRENT_BANK_NAME = 'axabanque'
  }
  // bnp
  if (document.location.hostname === "connexion-mabanque.bnpparibas") {
    CURRENT_BANK_NAME = 'bnp'
  }
  // banquepalatine
  if (document.location.href === "https://www.icgauth.epalatine.fr/se-connecter/mot-de-passe") {
    CURRENT_BANK_NAME = 'banquepalatine'
  }
  // banquepopulaire
  if (document.location.href === "https://www.banquepopulaire.fr/se-connecter/mot-de-passe") {
    CURRENT_BANK_NAME = 'banquepopulaire'
  }
  // banquepostale
  if (document.location.hostname === "voscomptesenligne.labanquepostale.fr") {
    CURRENT_BANK_NAME = 'banquepostale'
  }
  // boursorama
  if (document.location.href === "https://clients.boursorama.com/connexion/saisie-mot-de-passe" ) {
    CURRENT_BANK_NAME = "boursorama";
  }
  // cagricole
  const firstIndex = document.location.href.indexOf("https://www.credit-agricole.fr/");
  const secondIndex = document.location.href.indexOf("/particulier/acceder-a-mes-comptes.html");
  if (firstIndex === 0 && secondIndex > 0) {
    CURRENT_BANK_NAME = 'cagricole'
  }
  // caissedepargne
  if (document.location.href === "https://www.caisse-epargne.fr/se-connecter/mot-de-passe") {
    CURRENT_BANK_NAME = 'caissedepargne'
  }
  // créditcooperatif
  if (document.location.href === "https://www.credit-cooperatif.coop/se-connecter/identifier") {
    CURRENT_BANK_NAME = 'créditcooperatif'
  }
  // créditdunord
  if (document.location.href === "créditdunord") {
    CURRENT_BANK_NAME = 'créditdunord'
  }
  // créditfoncier
  if (document.location.href === "https://www.icgauth.creditfoncier.fr/se-connecter/mot-de-passe") {
    CURRENT_BANK_NAME = 'créditfoncier'
  }
  // creditmutuel
  if (document.location.href === "creditmutuel") {
    CURRENT_BANK_NAME = 'creditmutuel'
  }
  // cic
  if (document.location.href === "cic") {
    CURRENT_BANK_NAME = 'cic'
  }
  // fortuneo
  if (document.location.href === "fortuneo") {
    CURRENT_BANK_NAME = 'fortuneo'
  }
  // lcl
  if (document.location.href === "lcl") {
    CURRENT_BANK_NAME = 'lcl'
  }
  if (document.location.href === "https://monespace.lcl.fr/connexion" ) {
    CURRENT_BANK_NAME = "lcl";
  }
  // monabanq
  if (document.location.href === "monabanq") {
    CURRENT_BANK_NAME = 'monabanq'
  }
  // n26
  if (document.location.href === "n26") {
    CURRENT_BANK_NAME = 'n26'
  }
  // orangebank
  if (document.location.href === "orangebank") {
    CURRENT_BANK_NAME = 'orangebank'
  }
  // societegenerale
  if (document.location.hostname === "particuliers.sg.fr") {
    CURRENT_BANK_NAME = 'societegenerale'
  }
  // console.log("bank.service.currentBankName =", currentBankName);
  return CURRENT_BANK_NAME;
}



/***********************************************************/
 // Simple hash function only used for comparing images
 // of keyboard keys.
 // NOT for crypto
 /****/
function hashCode(strg: string): number {

  let hash = 0,
      i: number,
      chr: number;

  if (strg.length === 0) { return hash; }

  for (i = 0; i < strg.length; i++) {
    chr = strg.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }

  return hash;

}



/***********************************************************/
 // Play a key sound
/****/
function playKeySound(key: string, durationPause = 200){
  const audioContext = new AudioContext();
  const phoneTonePlayer = new PhoneTonePlayer(audioContext);
  const {stop} = phoneTonePlayer.playDtmf(key as Dtmf);
  return new Promise<void>( resolve => {
    setTimeout(() => {
      stop();
      audioContext.close();
      // start a random pause before typing a new key
      setTimeout(() => {
        resolve();
      }, durationPause);
    }, 300);
  });
}
