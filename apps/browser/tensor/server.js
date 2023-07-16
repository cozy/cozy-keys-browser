/* ===============================================================================

A node server to display a page which runs a taining and stores the resulting
model

Edit : script.js to select training or testing.
See readme.md

open: http://localhost:3333/

=================================================================================== */

const http       = require('http')
const fs         = require('fs'  ).promises
const path       = require('path')

http.createServer(async function (req, res){

  var filePath = '.' + req.url
  console.log("request of file :", filePath);

  if (filePath === './') {
    filePath = 'index.html'
  }

  if (filePath === './last-model.json') {
    filePath = await lastModelPath();
  }

  if (filePath === "./save") {
    console.log("SAVE requested");
    let body = [];
    req.on('error', (err) => {
      console.error(err);
    }).on('data', (chunk) => {
      body.push(chunk);
    }).on('end', () => {
      body = Buffer.concat(body).toString();
      // At this point, we have the headers, method, url and body, and can now
      // do whatever we need to in order to respond to this request.
      fs.writeFile("model.json",body);
    });
    return
  }

  if (!await fileExists(filePath)) {
    console.log("file doesnt exist", filePath);
    res.writeHead(404, {'Content-Type': 'text/plain'})
    res.write('404 Not Found\n');
    res.end();
    return
  }

  console.log(filePath, path.extname(filePath));
  if (path.extname(filePath) === '.json') {
    res.writeHead(200, {'Content-Type': 'application/json'})
  } else if (path.extname(filePath) !== '.html') {
    res.writeHead(200, {'Content-Type': 'application/javascript'})
  }
  res.end(await fs.readFile(filePath))

}).listen(3333);



const writeFile = async(filename, data, increment = 0) => {
  const name = `${path.basename(filename, path.extname(filename))}${increment || ""}${path.extname(filename)}`
  return await fs.writeFile(name, data, { encoding: 'utf8', flag: 'wx' })
  .then(async (err)=>{
    if (err) {
      if (err.code === "EEXIST") return await writeFile(filename, data, increment += 1)
      throw err
    }
  });
}


const findNewFilename = async(filename, increment = 0) => {
  const name = `${path.basename(filename, path.extname(filename))}${increment || ""}${path.extname(filename)}`
  if (await fileExists(name)) {
    return findNewFilename(filename, increment += 1);
  }
  return name;
}


const lastModelPath = async(filename = "model.json", increment = 1) => {
  const name = `${path.basename(filename, path.extname(filename))}${increment || ""}${path.extname(filename)}`
  if (await fileExists(name)) {
    return lastModelPath(filename, increment += 1);
  }
  let res;
  if (increment === 1 ) {
    res = "model.json"
  } else {
    res = `${path.basename(filename, path.extname(filename))}${increment-1 || ""}${path.extname(filename)}`;
  }
  return res;
}


async function fileExists (path) {
  try {
    await fs.access(path)
    return true
  } catch {
    return false
  }
}

console.log('server listening http://localhost:3333/');
