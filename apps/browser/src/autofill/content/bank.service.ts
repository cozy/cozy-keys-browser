import {Dtmf, PhoneTonePlayer} from '../services/phone-tone-player';

interface BankServiceInterface {
  observeDomForBank(collectFunction: any): boolean;
  getCurrentBankName(): string;
  typeOnKeyboard(codeToType: string, isARecall? : any): void;
  getBankKeyboarMenudEl(): HTMLElement;
}

class BaseBankService {
  getCurrentBankName(){
    return CURRENT_BANK_NAME;
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
      console.log("observeDomForBank ! ! ! ! ");
      collectFunction();
    }, 5000);
    return true;
  }

  getCurrentBankName(): string{
    return CURRENT_BANK_NAME;
  }

  async typeOnKeyboard(codeToType: string, isARecall = false): Promise<void>{
    console.log("typeOnKeyboard()", CURRENT_BANK_NAME , codeToType)
    if (codeToType === "" ) { return }
    const key = codeToType.charAt(0);
    await playKeySound(key);
    this.typeOnKeyboard(codeToType.slice(1), true);
  }

  getBankKeyboarMenudEl(): HTMLElement{
    // console.log("getBankKeyboarMenudEl()", currentBankName)
    return document.querySelector(".keyboard");
  }
}



/***********************************************************/
 // BankService for CAISSEDEPARGNE - WIP - needs OCR
/****/
class BankService_caissedepargne extends BaseBankService implements BankServiceInterface {

  private buttonElements: NodeList;
  private correspondanceTable = new Array<number>(10);
  private keyImageHashes:{ [index: string]: number } = {};
  private iframePromise: Promise<void>;

  constructor(initOcr?: boolean) {
    super();
    if (!initOcr) {
      return
    }
    // create iframe where Tensorflow model will be run to OCR the keys
    window.addEventListener("load", () => {
      const iframe = document.createElement("iframe");
      iframe.src = chrome.runtime.getURL("tensor/index.html");
      iframe.style.cssText = `display: none`;
      document.body.append(iframe);
      this.iframePromise = new Promise((resolve)=>{
        iframe.addEventListener("load", () => {
          resolve();
        })
      })
    })
  }

  observeDomForBank(collectFunction: any): boolean{
    return false;
  }

  getBankKeyboarMenudEl(): HTMLElement{
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
    const promise = new Promise((resolve) => {
      this.iframePromise.then(() => {
        // send key images to OCR
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

  async typeOnKeyboard(codeToType: string, isARecall = false): Promise<void>{
    console.log("typeOnKeyboard", CURRENT_BANK_NAME, codeToType);
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
      setTimeout( () => { // just wait for the page to delete preiously typed password
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
    console.log("observeDom trigered for LCL !!! web page", document.location.href);
    const observer = new MutationObserver((mutations) => {
      console.log("LCL dom mutations in", mutations)
      for (let i = 0; i < mutations.length; i++) {
        const target = mutations[i].target;
        if ((target as HTMLElement).className === "pad-code") {
          console.log("DOM MUTATIONS VALIDATED => collect()");
          collectFunction();
          observer.disconnect();
          break;
        }
      }
    });
    observer.observe(document.querySelector("body"), { childList: true, subtree: true });
    return true;
  }

  getBankKeyboarMenudEl(): HTMLElement{
    return document.querySelector(".pad-code");
  }

  getCurrentBankName(): string{
    return CURRENT_BANK_NAME;
  }

  async typeOnKeyboard(codeToType: string, isARecall = false): Promise<void>{
    console.log("typeOnKeyboard", CURRENT_BANK_NAME, codeToType);
    if (codeToType === "" ) { return }
    if (!isARecall) {
      if (document.querySelector(".pad-dot.is-filled")) {
        (document.querySelector(".pad-reset") as HTMLButtonElement).click();
        await playKeySound("A", 50);
        setTimeout( () => { // just wait for the page to delete preiously typed password
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
  private correspondanceTable = new Array<number>(10);
  private keyImageHashes:{ [index: string]: number } = {"0":-1961266208,"1":1806502122,"2":383789923,"3":-1617329400,"4":-323759857,"5":-2028372521,"6":1483506720,"7":927833434,"8":269012712,"9":1964989521}

  observeDomForBank(collectFunction: any): boolean{
    return false;
  }

  getBankKeyboarMenudEl(): HTMLElement{
    return document.querySelector("[data-id='form_fakePassword']");
  }

  getCurrentBankName(): string{
    return CURRENT_BANK_NAME;
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
    console.log("typeOnKeyboard", CURRENT_BANK_NAME, codeToType);
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
      setTimeout( () => { // just wait for the page to delete preiously typed password
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
        default:
      case "boursorama":
        return new BankService_boursorama();
      case "caissedepargne":
        return new BankService_caissedepargne(initOcr);
      case "lcl":
        return new BankService_lcl();
    }
  }
}


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
  if (document.location.href === "bnp") {
    CURRENT_BANK_NAME = 'bnp'
  }
  // banquepopulaire
  if (document.location.href === "banquepopulaire") {
    CURRENT_BANK_NAME = 'banquepopulaire'
  }
  // banquepostale
  if (document.location.href === "banquepostale") {
    CURRENT_BANK_NAME = 'banquepostale'
  }
  // boursorama
  if (document.location.href === "boursorama") {
    CURRENT_BANK_NAME = 'boursorama'
  }
  if (document.location.href === "https://clients.boursorama.com/connexion/saisie-mot-de-passe" ) {
    CURRENT_BANK_NAME = "boursorama";
  }
  // cagricole
  if (document.location.href === "cagricole") {
    CURRENT_BANK_NAME = 'cagricole'
  }
  // caissedepargne
  if (document.location.href === "https://www.caisse-epargne.fr/se-connecter/mot-de-passe") {
    CURRENT_BANK_NAME = 'caissedepargne'
  }
  // créditdunord
  if (document.location.href === "créditdunord") {
    CURRENT_BANK_NAME = 'créditdunord'
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
  if (document.location.href === "societegenerale") {
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
