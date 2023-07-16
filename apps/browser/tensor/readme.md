
Steps to produce a new model with somme training data :
* run `node server.js`
* add data in bank-key-images.js
* in `script.js` : modify the value "DO_TRAIN" in order to
  * train the model against data
  * or just to reuse last computed model
* open http://localhost:3333/
* trained model will be saved in local folder in "model.json"

Documentation
* [TensorFlow api reference](https://js.tensorflow.org/api/4.8.0/)
* le [tuto officiel qui a servie de modèle](https://codelabs.developers.google.com/codelabs/tfjs-training-classfication?hl=fr#0)

Things to know :
* index-ori.html : the tensor flow tutorial
