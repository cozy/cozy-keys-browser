// import realRawData1 from "./CAISSEDEPARGNE/bank-key-images.js"
// import realRawData2 from "./BNP/bank-key-images.js"
// const realRawData = realRawData1.concat(realRawData2);

// import realRawData1 from "./CAISSEDEPARGNE/bank-key-images.js"
// import realRawData2 from "./BNP/bank-key-images.js"
// var realRawData = [];
// for (let i = 0; i < 1500; i++) {
//   realRawData = realRawData.concat(realRawData1);
//   realRawData = realRawData.concat(realRawData2);
// }


// import realRawData from "./CAISSEDEPARGNE/bank-key-images.js"
import realRawData from "./BNP/bank-key-images.js"

const TARGET_IMAGE_WIDTH = 48;
const TARGET_IMAGE_HEIGHT = 48;
const IMAGE_SIZE = TARGET_IMAGE_WIDTH*TARGET_IMAGE_HEIGHT;
const NUM_CLASSES = 10;
const NUM_DATASET_ELEMENTS = realRawData.length * 10;

const NUM_TRAIN_ELEMENTS = NUM_DATASET_ELEMENTS-10;
const NUM_TEST_ELEMENTS = NUM_DATASET_ELEMENTS - NUM_TRAIN_ELEMENTS;

const CANVAS = document.createElement('canvas');
const CTX = CANVAS.getContext('2d');

let TRAIN_EXEMPLES_CONTAINER;

/******************************************************************************************
 * A class that prepare data (`load()`) and prepare batches of data (for training or test)
 ******************************************************************************************/
export class LearnData {

  constructor() {
    this.shuffledTrainIndex = 0;
    this.shuffledTestIndex = 0;
    this.image_width = TARGET_IMAGE_WIDTH;
    this.image_height = TARGET_IMAGE_HEIGHT;
    this.dataUrlsForTests = realRawData[realRawData.length-1][1];
    TRAIN_EXEMPLES_CONTAINER = document.querySelector("#train-exemples")
  }

  async load() {
    // prepare images
    const datasetBytesBuffer = new ArrayBuffer(NUM_DATASET_ELEMENTS * IMAGE_SIZE * 4);
    const chunkSize = 1;
    const imgRequestsPromises = [];
    for (let i = 0; i < realRawData.length; i++) {
      const dataSet = realRawData[i];
      for (let j = 0; j < dataSet[1].length; j++) {
        const dataUrl = dataSet[1][j];
        const img = new Image();
        const imgRequest = new Promise((resolve, reject) => {
          img.onload = () => {
            TRAIN_EXEMPLES_CONTAINER.appendChild(img)  // optionnal
            // prepare datasetBytesView to manipulate datasetBytesBuffer.
            // need 4 bytes for each pixel
            const datasetBytesView = new Float32Array(
              datasetBytesBuffer, (i*10+j) * IMAGE_SIZE * chunkSize * 4,
              IMAGE_SIZE * chunkSize);
            // black & white
            CTX.globalAlpha = 1;
            CTX.fillStyle = "white";
            CTX.filter = 'grayscale(1)';
            // ctx.filter = 'invert(100%)';
            CTX.fillRect(0, 0 , TARGET_IMAGE_WIDTH, TARGET_IMAGE_HEIGHT);
            // compute offset to center img in a square
            const dx = parseInt((TARGET_IMAGE_WIDTH - img.width)/2)
            const dy = parseInt((TARGET_IMAGE_HEIGHT - img.height)/2)
            // Draw image
            CTX.drawImage(img, dx, dy);
            // display result in the new canvas (optional)
            const reworkedImageCanvas = document.createElement('canvas');
            reworkedImageCanvas.width = TARGET_IMAGE_WIDTH;
            reworkedImageCanvas.height = TARGET_IMAGE_HEIGHT;
            TRAIN_EXEMPLES_CONTAINER.appendChild(reworkedImageCanvas); // optionnal
            const ctx2 = reworkedImageCanvas.getContext('2d');
            ctx2.drawImage(CANVAS, 0, 0);
            // get image data into datasetBytesBuffer
            const imageData = CTX.getImageData(0, 0, TARGET_IMAGE_WIDTH, TARGET_IMAGE_HEIGHT);
            for (let j = 0; j < IMAGE_SIZE; j++) {
              // All channels hold an equal value since the image is grayscale, so
              // just read the red channel.
              datasetBytesView[j] = imageData.data[j * 4] / 255;
            }
            resolve();
          }
          img.src = dataUrl;
        })
        imgRequestsPromises.push(imgRequest)
      }
    }
    const allPromises = Promise.all(imgRequestsPromises);
    await allPromises;

    this.datasetImages = new Float32Array(datasetBytesBuffer);

    // prepare labels
    const datasetLabels = new Uint8Array(NUM_DATASET_ELEMENTS * 10);
    this.datasetLabels = datasetLabels;
    for (let i = 0; i < realRawData.length; i++) {
      const dataSet = realRawData[i];
      for (let j = 0; j < dataSet[1].length; j++) {
        const labelValue = dataSet[0][j];
        // all class items are null, except labelValue-ith
        datasetLabels[i*100+j*10+labelValue] = 1;
      }
    }


    // Create shuffled indices into the train/test set for when we select a
    // random dataset element for training / validation.
    this.trainIndices = tf.util.createShuffledIndices(NUM_TRAIN_ELEMENTS);
    this.testIndices = tf.util.createShuffledIndices(NUM_TEST_ELEMENTS);

    // Slice the the images and labels into train and test sets.
    this.trainImages =
        this.datasetImages.slice(0, IMAGE_SIZE * NUM_TRAIN_ELEMENTS);
    this.testImages = this.datasetImages.slice(IMAGE_SIZE * NUM_TRAIN_ELEMENTS);
    this.trainLabels =
        this.datasetLabels.slice(0, NUM_CLASSES * NUM_TRAIN_ELEMENTS);
    this.testLabels =
        this.datasetLabels.slice(NUM_CLASSES * NUM_TRAIN_ELEMENTS);
  }

  nextTrainBatch(batchSize) {
    return this.nextBatch(
        batchSize, [this.trainImages, this.trainLabels], () => {
          this.shuffledTrainIndex =
              (this.shuffledTrainIndex + 1) % this.trainIndices.length;
          return this.trainIndices[this.shuffledTrainIndex];
        });
  }

  nextTestBatch(batchSize) {
    return this.nextBatch(batchSize, [this.testImages, this.testLabels], () => {
      this.shuffledTestIndex =
          (this.shuffledTestIndex + 1) % this.testIndices.length;
      return this.testIndices[this.shuffledTestIndex];
    });
  }

  nextBatch(batchSize, data, index) {
    const batchImagesArray = new Float32Array(batchSize * IMAGE_SIZE);
    const batchLabelsArray = new Uint8Array(batchSize * NUM_CLASSES);

    for (let i = 0; i < batchSize; i++) {
      const idx = index();

      const image = data[0].slice(idx * IMAGE_SIZE, idx * IMAGE_SIZE + IMAGE_SIZE);
      batchImagesArray.set(image, i * IMAGE_SIZE);

      const label = data[1].slice(idx * NUM_CLASSES, idx * NUM_CLASSES + NUM_CLASSES);
      batchLabelsArray.set(label, i * NUM_CLASSES);
    }

    const xs = tf.tensor2d(batchImagesArray, [batchSize, IMAGE_SIZE]);
    const labels = tf.tensor2d(batchLabelsArray, [batchSize, NUM_CLASSES]);

    return {xs, labels};
  }


  createTensorFromImage(img) {
    const datasetBytesBuffer = new ArrayBuffer(IMAGE_SIZE * 4);
    // prepare datasetBytesView to manipulate datasetBytesBuffer.
    // need 4 bytes for each pixel
    const datasetBytesView = new Float32Array(
      datasetBytesBuffer, 0, IMAGE_SIZE);
    // black & white
    CTX.globalAlpha = 1;
    CTX.fillStyle = "white";
    CTX.filter = 'grayscale(1)';
    // ctx.filter = 'invert(100%)';
    CTX.fillRect(0, 0 , TARGET_IMAGE_WIDTH, TARGET_IMAGE_HEIGHT);
    // compute offset to center img in a square
    const dx = parseInt((TARGET_IMAGE_WIDTH - img.width)/2)
    const dy = parseInt((TARGET_IMAGE_HEIGHT - img.height)/2)
    // Draw image
    CTX.drawImage(img, dx, dy);
    // display result in the new canvas (optional)
    // const reworkedImageCanvas = document.createElement('canvas');
    // reworkedImageCanvas.width = TARGET_IMAGE_WIDTH;
    // reworkedImageCanvas.height = TARGET_IMAGE_HEIGHT;
    // TEST_CONTAINER.appendChild(reworkedImageCanvas);
    // const ctx2 = reworkedImageCanvas.getContext('2d');
    // ctx2.drawImage(canvas, 0, 0);
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

}
