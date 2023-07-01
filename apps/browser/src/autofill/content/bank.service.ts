import {Dtmf, PhoneTonePlayer} from '../services/phone-tone-player';

interface BankService {
  observeDomForBank(collectFunction: any): boolean;
  getCurrentBankName(): string;
  typeOnKeyboard(codeToType: string, isARecall? : any): void;
  getBankKeyboarMenudEl(): HTMLElement;
}

let currentBankName: string;


/***********************************************************/
 // BankService for the test page
 // T04.0-Login-bank-keyboard.html
/****/
class BankService_test implements BankService {

  observeDomForBank(collectFunction: any): boolean{
    setTimeout(() => {
      console.log("observeDomForBank ! ! ! ! ");
      collectFunction();
    }, 5000);
    return true;
  }

  getCurrentBankName(): string{
    return currentBankName;
  }

  async typeOnKeyboard(codeToType: string, isARecall = false): Promise<void>{
    console.log("typeOnKeyboard()", currentBankName , codeToType)
    if (codeToType === "" ) { return }
    const key = codeToType.charAt(0);
    await playKeySound(key);
    this.typeOnKeyboard(codeToType.slice(1), true);
  }

  getBankKeyboarMenudEl(): HTMLElement{
    console.log("getBankKeyboarMenudEl()", currentBankName)
    return document.querySelector(".keyboard");
  }
}



/***********************************************************/
 // BankService for CAISSEDEPARGNE - WIP - needs OCR
/****/
class BankService_caissedepargne implements BankService {

  private buttonElements: NodeList;
  private correspondanceTable = new Array<number>(10);
  private keyImageHashes:{ [index: string]: number } = {};

  observeDomForBank(collectFunction: any): boolean{
    return false;
  }

  getBankKeyboarMenudEl(): HTMLElement{
    return document.querySelector("as-row-circles-password");
  }

  getCurrentBankName(): string{
    return currentBankName;
  }

  buildCorrespondanceTable() {
    // iterate on current keyboard to find the correspondance table
    const keysElements = document.querySelectorAll("as-keyboard-button button");
    keysElements.forEach( (buttonImg: HTMLImageElement, imageIndex: number) => {
      const imageHash = hashCode(buttonImg.style.background);
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
    console.log("typeOnKeyboard", currentBankName, codeToType);
    if (codeToType === "" ) { return }
    if (!isARecall) {
      this.buttonElements = document.querySelectorAll(".password-input button");
      this.buildCorrespondanceTable();
      let hasActiveBullets = document.querySelector(".c-circle-password__item.is-active") !== null;
      for (let i = 0; hasActiveBullets; i++) {
        (document.querySelector("[aria-label='Effacer le mot de passe saisi']") as HTMLButtonElement).click();
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
 // BankService for LCL
/****/
class BankService_lcl implements BankService {

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
    return currentBankName;
  }

  async typeOnKeyboard(codeToType: string, isARecall = false): Promise<void>{
    console.log("typeOnKeyboard", currentBankName, codeToType);
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
class BankService_boursorama implements BankService {

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
    return currentBankName;
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
    console.log("typeOnKeyboard", currentBankName, codeToType);
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

  static createService(): BankService {
    const currentBankName = this.getCurrentBankName();
    switch (currentBankName) {
      case "test":
        return new BankService_test();
        default:
      case "boursorama":
        return new BankService_boursorama();
      case "caissedepargne":
        return new BankService_caissedepargne();
      case "lcl":
        return new BankService_lcl();
    }
  }

  private static getCurrentBankName = (): string => {
    console.log("getCurrentBankName", document.location.href);
    if (!currentBankName) {
      // test
      if (document.location.href === "http://localhost:3333/T04.0-Login-bank-keyboard.html" ) {
        currentBankName = "test"
      }
      // axabanque
      if (document.location.href === "axabanque") {
        currentBankName = 'axabanque'
      }
      // bnp
      if (document.location.href === "bnp") {
        currentBankName = 'bnp'
      }
      // banquepopulaire
      if (document.location.href === "banquepopulaire") {
        currentBankName = 'banquepopulaire'
      }
      // banquepostale
      if (document.location.href === "banquepostale") {
        currentBankName = 'banquepostale'
      }
      // boursorama
      if (document.location.href === "boursorama") {
        currentBankName = 'boursorama'
      }
      if (document.location.href === "https://clients.boursorama.com/connexion/saisie-mot-de-passe" ) {
        currentBankName = "boursorama";
      }
      // cagricole
      if (document.location.href === "cagricole") {
        currentBankName = 'cagricole'
      }
      // caissedepargne
      if (document.location.href === "https://www.caisse-epargne.fr/se-connecter/mot-de-passe") {
        currentBankName = 'caissedepargne'
      }
      // créditdunord
      if (document.location.href === "créditdunord") {
        currentBankName = 'créditdunord'
      }
      // creditmutuel
      if (document.location.href === "creditmutuel") {
        currentBankName = 'creditmutuel'
      }
      // cic
      if (document.location.href === "cic") {
        currentBankName = 'cic'
      }
      // fortuneo
      if (document.location.href === "fortuneo") {
        currentBankName = 'fortuneo'
      }
      // lcl
      if (document.location.href === "lcl") {
        currentBankName = 'lcl'
      }
      if (document.location.href === "https://monespace.lcl.fr/connexion" ) {
        currentBankName = "lcl";
      }
      // monabanq
      if (document.location.href === "monabanq") {
        currentBankName = 'monabanq'
      }
      // n26
      if (document.location.href === "n26") {
        currentBankName = 'n26'
      }
      // orangebank
      if (document.location.href === "orangebank") {
        currentBankName = 'orangebank'
      }
      // societegenerale
      if (document.location.href === "societegenerale") {
        currentBankName = 'societegenerale'
      }
    }
    console.log("bank.service.currentBankName =", currentBankName);
    return currentBankName;
  }

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
