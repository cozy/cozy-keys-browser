#!/bin/bash

# Create cozy-keys archive 
git archive HEAD -o dist/cozy-keys.zip .
# Create jslib archive
zip -r dist/jslib.zip jslib
cd dist
# Merge both archives into one
unzip -d tmp -o -u cozy-keys.zip
unzip -d tmp -o -u jslib.zip
cd tmp; zip -D -r ../sources.zip .; cd ..
# Cleanup
rm jslib.zip
rm cozy-keys.zip
rm -r tmp
