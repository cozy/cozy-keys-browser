import * as tf from '@tensorflow/tfjs';

var jsonModel: any;

const CANVAS = document.createElement('canvas');
const CTX = CANVAS.getContext('2d', {willReadFrequently:true});

const TARGET_IMAGE_WIDTH = 48;
const TARGET_IMAGE_HEIGHT = 48;
const IMAGE_SIZE = TARGET_IMAGE_WIDTH*TARGET_IMAGE_HEIGHT;

let MODEL: any;


/***************************************************************** */
/* Listen to messages sent by the content script "bank.service.ts" */
/* msg =                                                           */
/*   * .command : string "toTensorIframe"                          */
/*   * .dataUrls: sting[] ordered list of dataUrls                 */
/***************************************************************** */
chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (msg.command !== "toTensorIframe-keysToOCR") {
    return;
  }
  /*
  log useful for debug, keep for tests
  console.log('model-wrapper HEARD : ', {
    'command' : msg.command,
    'dataUrls': msg.dataUrls,
    "heard in": document.location.pathname
  });
  */
  (async () => { // the correct way to run async, see https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/onMessage#sending_an_asynchronous_response_using_sendresponse
    await getModel();
    const predPromises: Promise<number>[] = [];
    msg.dataUrls.forEach( (dataUrl: string) => {
      predPromises.push( predict(dataUrl) );
    });
    const promiseAll = Promise.allSettled(predPromises);
    promiseAll.then( (result: any) => {
      const response = result.map( (e: any ) => e.value); // TODO BJA : any pas jolis...
      sendResponse(response);
    });
  })()
  return true;
})


/*************************************/
/* return the trained MODEL          */
/*************************************/
async function getModel() {
  if (MODEL) {
    return;
  }
  if (!jsonModel) {
    await loadJsonModel();
  }
  MODEL = await tf.loadLayersModel(tf.io.fromMemory({
    modelTopology : jsonModel.modelTopology,
    weightSpecs : jsonModel.weightSpecs,
    weightData : base64ToArrayBuffer(jsonModel.weightData)
  }));
}


/**************************************/
/* return the json MODEL for the bank */
/**************************************/
async function loadJsonModel() {
  const urlParams = new URLSearchParams(window.location.search);
  const modelName = urlParams.get('model');
  switch (modelName) {

    case 'bnp':
      jsonModel = await import("./models_for_dist/model-bnp.json");
      break;

      case 'caisse_epargne':
      jsonModel = await import("./models_for_dist/model-caisse-epargne.json");
      break;

      case 'societegenerale':
      jsonModel = await import("./models_for_dist/model-societe-gale.json");
      break;

    default:
      break;
  }
  return jsonModel;
}


/*************************************/
/* run the prediction on a dataUrl   */
/*************************************/
async function predict(dataUrl: string): Promise<number> {
  const img =  new Image();
  img.src = dataUrl;
  console.log("predict");
  return new Promise(resolve => {
    img.onload = ()=>{
      const tensorImage = createTensorFromImage(img);
      const prediction = MODEL.predict(tensorImage).argMax(-1);
      resolve(prediction.dataSync()[0])
    }
  })
}


/*************************************/
/* create a tensor from an img       */
/*************************************/
function createTensorFromImage(img: HTMLImageElement) {
  const datasetBytesBuffer = new ArrayBuffer(IMAGE_SIZE * 4);
  // prepare datasetBytesView to manipulate datasetBytesBuffer.
  // need 4 bytes for each pixel
  const datasetBytesView = new Float32Array(
    datasetBytesBuffer, 0, IMAGE_SIZE);
  // black & white
  CTX.globalAlpha = 1;
  CTX.fillStyle = "white";
  CTX.filter = 'grayscale(1)';
  CTX.fillRect(0, 0 , TARGET_IMAGE_WIDTH, TARGET_IMAGE_HEIGHT);
  // compute offset to center img in a square
  const dx = Math.round((TARGET_IMAGE_WIDTH - img.width)/2);
  const dy = Math.round((TARGET_IMAGE_HEIGHT - img.height)/2);
  // Draw image
  CTX.drawImage(img, dx, dy);
  // get image data into datasetBytesBuffer
  const imageData = CTX.getImageData(0, 0, TARGET_IMAGE_WIDTH, TARGET_IMAGE_HEIGHT);
  for (let j = 0; j < IMAGE_SIZE; j++) {
    // All channels hold an equal value since the image is grayscale, so
    // just read the red channel.
    datasetBytesView[j] = imageData.data[j * 4] / 255;
  }
  const datasetImg = new Float32Array(datasetBytesBuffer)
  return tf.tensor4d(datasetImg, [1,TARGET_IMAGE_WIDTH, TARGET_IMAGE_HEIGHT,1]);
}


/**************************************/
/****** HELPERS ***********************/
/**************************************/

function base64ToArrayBuffer(base64: string) {
  var binary_string =  window.atob(base64);
  var len = binary_string.length;
  var bytes = new Uint8Array( len );
  for (var i = 0; i < len; i++)        {
      bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}



