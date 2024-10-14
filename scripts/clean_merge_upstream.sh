#!/bin/bash

# Run the script from the root folder.

# If you get an error `fatal: pathspec [...] did not match any files`, it may be because merge upstream did not add again these files.

# 1) Remove all Bitwarden workflow files
find .github/workflows -type f ! -name 'build_dist.yml' ! -name 'quality_checks.yml' | xargs git rm

# 2) Remove all locals excepts "en" and "fr"
find . -type f -path "./apps/browser/src/_locales/*" -not -path "*locales/en/*" -not -path "*locales/fr/*" | xargs git rm -f

# 3) Remove Husky
git rm -r .husky/

# 4) Remove .github
git rm ./CONTRIBUTING.md

