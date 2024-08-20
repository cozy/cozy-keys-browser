#!/bin/bash

# move to script directory and then to project root
cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null
cd ..

# Create cozy-keys archive
git archive HEAD -o apps/browser/dist/cozy-keys-sources.zip .
cd apps/browser/dist/
zip --delete cozy-keys-sources.zip apps/web*
zip --delete cozy-keys-sources.zip apps/desktop*
zip --delete cozy-keys-sources.zip apps/cli*
