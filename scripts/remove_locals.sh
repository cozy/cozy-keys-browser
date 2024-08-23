#!/bin/bash

# remove all locals excepts "en" and "fr"
find -type f -path "./apps/browser/src/_locales/*" -not -path "*locales/en/*" -not -path "*locales/fr/*" | xargs git rm -f
# remove Husky
git rm -r .husky/
# remove .github
# git rm -rf .github/
# git rm -f ./CONTRIBUTING.md

