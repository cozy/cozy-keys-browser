#!/bin/bash

# remove all locals excepts "en" and "fr"
find -type f -path "./src/_locales/*" -not -path "*locales/en/*" -not -path "*locales/fr/*" | xargs git rm -f 
