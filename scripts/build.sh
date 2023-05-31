#!/bin/bash

# --exclude='./.git'
# --exclude='./jslib'

tar \
    --exclude='./node_modules' \
    --exclude='./dist'         \
    --exclude='./build'        \
    -zcvf dist/sources.tar.gz ./

# delete and recreate a directory where to test the tar
rm -rf ../cozy-keys-browser-sources-test
mkdir ../cozy-keys-browser-sources-test
tar -zvxf dist/sources.tar.gz --directory ../cozy-keys-browser-sources-test

# build a dist with the source code of the tar
cd ../cozy-keys-browser-sources-test
npm install
npm run dist:firefox

# compare the two files
sha256sum ./dist/dist-firefox.zip
cd -
sha256sum ./dist/dist-firefox.zip

