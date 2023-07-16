import {LearnData} from './data.js';

const classNames     = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
const IMAGE_CHANNELS = 1;

let IMAGE_WIDTH, IMAGE_HEIGHT;

let TEST_CONTAINER, DATA, MODEL;

/******************************/
/*   EDIT                     */
/* true = train against data  */
/* false = test last model    */
const DO_TRAIN       = false;
/*****************************/


/****************************
 * main
 */
async function run() {
  console.log("run()");
  TEST_CONTAINER = document.querySelector("#test-container")

  DATA = new LearnData();
  await DATA.load();
  IMAGE_WIDTH = DATA.image_width;
  IMAGE_HEIGHT = DATA.image_height;
  await showExamples(DATA);
  if (DO_TRAIN) {
    MODEL = initiateModel();
  } else {
    MODEL = await fetchModelJson();
  }
  tfvis.show.modelSummary({name: 'Model Architecture', tab: 'Model'}, MODEL);
  if (DO_TRAIN) await train(MODEL, DATA);
  if (DO_TRAIN) await showAccuracy(MODEL, DATA);
  if (DO_TRAIN) await showConfusion(MODEL, DATA);
  if (DO_TRAIN) await saveModelJson(MODEL);
  await runLocalTests();
}


/*******************************
 * run tests on a serie of images
 */
async function runLocalTests() {
  const dataUrlsForTests = DATA.dataUrlsForTests;
  const title = document.createElement("p")
  title.textContent = "Test model"
  document.body.appendChild(TEST_CONTAINER)
  for (const dataUrl of dataUrlsForTests) {
    await testDataUrl(dataUrl);
  }
  const addRowEl = document.createElement("div")
  const btn = document.createElement("button")
  const input = document.createElement("input")
  btn.textContent = "Test data url"
  btn.onclick = () => {
    testDataUrl(input.value)
  }
  input.placeholder = "new data url"
  addRowEl.appendChild(input)
  addRowEl.appendChild(btn)

  document.body.appendChild(addRowEl)
}


/*******************************
 * run a test on a data url
 */
async function testDataUrl(dataUrl) {
  const testEl = document.createElement("div");
  testEl.className = "testRow"
  const img =  new Image();
  const promise = new Promise(resolve => {
    img.onload = ()=> {
      const tensorImage = DATA.createTensorFromImage(img);
      const pred = MODEL.predict(tensorImage).argMax(-1);
      txtEl.textContent = "prediction = " + pred.dataSync()[0] ;
      resolve();
    }
  })
  img.src = dataUrl;
  testEl.appendChild(img);
  const txtEl = document.createElement("span");
  testEl.appendChild(txtEl)
  TEST_CONTAINER.appendChild(testEl)
  return promise;
}


/****************************
 * save on the server a json of the model
 * in model.json
 */
async function saveModelJson(model) {
  const result = await model.save(tf.io.withSaveHandler(async modelArtifacts => modelArtifacts));
  result.weightData = arrayBufferToBase64(result.weightData);
  const jsonStr = JSON.stringify(result);
  fetch('http://localhost:3333/save', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: jsonStr
  })
  .then(response => console.log(response.status))
  return jsonStr;
}


/****************************
 * Fetch, parse and initialze the model stored
 * in model.json
 */
async function fetchModelJson() {
  const resp = await fetch('./model.json')
  const jsonModel = await resp.json();
  const model = await deserializeJsonModel(jsonModel)
  return model;
}


/****************************
 * Turn a json into a TFJS model a JSON.
 * The json can be a string or an object.
 */
async function deserializeJsonModel(jsonModel) {

  if (typeof jsonModel === "string") {
    jsonModel = JSON.parse(jsonModel);
  }

  const newModel = await tf.loadLayersModel(tf.io.fromMemory(
    jsonModel.modelTopology,
    jsonModel.weightSpecs,
    base64ToArrayBuffer(jsonModel.weightData)
  ));

  return newModel;
}

function arrayBufferToBase64( buffer ) {
	var binary = '';
	var bytes = new Uint8Array( buffer );
	var len = bytes.byteLength;
	for (var i = 0; i < len; i++) {
		binary += String.fromCharCode( bytes[ i ] );
	}
	return window.btoa( binary );
}

function base64ToArrayBuffer(base64) {
  var binary_string =  window.atob(base64);
  var len = binary_string.length;
  var bytes = new Uint8Array( len );
  for (var i = 0; i < len; i++)        {
      bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}


/****************************
 * Create the model topography
 */
function initiateModel() {

  const model = tf.sequential();

  // In the first layer of our convolutional neural network we have
  // to specify the input shape. Then we specify some parameters for
  // the convolution operation that takes place in this layer.
  model.add(tf.layers.conv2d({
    inputShape: [IMAGE_WIDTH, IMAGE_HEIGHT, IMAGE_CHANNELS],
    kernelSize: 5,
    filters: 8,
    strides: 1,
    activation: 'relu',
    kernelInitializer: 'varianceScaling'
  }));

  // The MaxPooling layer acts as a sort of downsampling using max values
  // in a region instead of averaging.
  model.add(tf.layers.maxPooling2d({poolSize: [2, 2], strides: [2, 2]}));

  // Repeat another conv2d + maxPooling stack.
  // Note that we have more filters in the convolution.
  model.add(tf.layers.conv2d({
    kernelSize: 5,
    filters: 16,
    strides: 1,
    activation: 'relu',
    kernelInitializer: 'varianceScaling'
  }));
  model.add(tf.layers.maxPooling2d({poolSize: [2, 2], strides: [2, 2]}));

  // Now we flatten the output from the 2D filters into a 1D vector to prepare
  // it for input into our last layer. This is common practice when feeding
  // higher dimensional data to a final classification output layer.
  model.add(tf.layers.flatten());

  // Our last layer is a dense layer which has 10 output units, one for each
  // output class (i.e. 0, 1, 2, 3, 4, 5, 6, 7, 8, 9).
  const NUM_OUTPUT_CLASSES = 10;
  model.add(tf.layers.dense({
    units: NUM_OUTPUT_CLASSES,
    kernelInitializer: 'varianceScaling',
    activation: 'softmax'
  }));

  // Choose an optimizer, loss function and accuracy metric,
  // then compile and return the model
  const optimizer = tf.train.adam();
  model.compile({
    optimizer: optimizer,
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy'],
  });

  return model;
}


/****************************
 * train model against data
 */
async function train(model, data) {
  const metrics = ['loss', 'val_loss', 'acc', 'val_acc'];
  const container = {
    name: 'Model Training', tab: 'Model', styles: { height: '1000px' }
  };
  const fitCallbacks = () => {
    tfvis.show.fitCallbacks(container, metrics)();
    console.log("fitCallbacks end !");
  }

  const BATCH_SIZE = 4;
  const TRAIN_DATA_SIZE = 30;
  const TEST_DATA_SIZE = 10;

  const [trainXs, trainYs] = tf.tidy(() => {
    const d = data.nextTrainBatch(TRAIN_DATA_SIZE);
    return [
      d.xs.reshape([TRAIN_DATA_SIZE, IMAGE_WIDTH, IMAGE_HEIGHT, IMAGE_CHANNELS]),
      d.labels
    ];
  });

  const [testXs, testYs] = tf.tidy(() => {
    const d = data.nextTestBatch(TEST_DATA_SIZE);
    return [
      d.xs.reshape([TEST_DATA_SIZE, IMAGE_WIDTH, IMAGE_HEIGHT, IMAGE_CHANNELS]),
      d.labels
    ];
  });
  console.log("start fit");
  return model.fit(trainXs, trainYs, {
    batchSize: BATCH_SIZE,
    validationData: [testXs, testYs],
    epochs: 10,
    shuffle: true,
    callbacks: fitCallbacks
  });
}


/****************************
 * run tests
 */
function doPrediction(model, data, testDataSize = 500) {
  console.log('doPrediction()');
  const testData = data.nextTestBatch(testDataSize);
  const testxs = testData.xs.reshape([testDataSize, IMAGE_WIDTH, IMAGE_HEIGHT, IMAGE_CHANNELS]);
  const labels = testData.labels.argMax(-1);
  const preds = model.predict(testxs).argMax(-1);

  testxs.dispose();
  return [preds, labels];
}


/****************************
 * accuracy
 */
async function showAccuracy(model, data) {
  const [preds, labels] = doPrediction(model, data);
  const classAccuracy = await tfvis.metrics.perClassAccuracy(labels, preds);
  const container = {name: 'Accuracy', tab: 'Evaluation'};
  tfvis.show.perClassAccuracy(container, classAccuracy, classNames);

  labels.dispose();
}



/****************************
 * confusion
 */
async function showConfusion(model, data) {
  const [preds, labels] = doPrediction(model, data);
  const confusionMatrix = await tfvis.metrics.confusionMatrix(labels, preds);
  const container = {name: 'Confusion Matrix', tab: 'Evaluation'};
  tfvis.render.confusionMatrix(container, {values: confusionMatrix, tickLabels: classNames});

  labels.dispose();
}


/****************************
 * display a set of image exemples in the tensor flow right tab
 */
async function showExamples() {
  // Create a container in the visor
  const surface =
    tfvis.visor().surface({ name: 'Input Data Examples', tab: 'Input Data'});

  // Get the examples
  const examples = DATA.nextTestBatch(20);
  const numExamples = examples.xs.shape[0];

  // Create a canvas element to render each example
  for (let i = 0; i < numExamples; i++) {
    const imageTensor = tf.tidy(() => {
      // Reshape the image to their size in px
      return examples.xs
        .slice([i, 0], [1, examples.xs.shape[1]])
        .reshape([DATA.image_width, DATA.image_height, IMAGE_CHANNELS]);
    });

    const canvas = document.createElement('canvas');
    canvas.width = DATA.image_width;
    canvas.height = DATA.image_height;
    canvas.style = 'margin: 4px;';
    await tf.browser.toPixels(imageTensor, canvas);
    surface.drawArea.appendChild(canvas);

    imageTensor.dispose();
  }
}


/****************************
 * start main
 */
document.addEventListener('DOMContentLoaded', run);
