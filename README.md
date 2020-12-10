# What's Cozy?


![Cozy Logo](https://cdn.rawgit.com/cozy/cozy-guidelines/master/templates/cozy_logo_small.svg)

[Cozy] is a platform that brings all your web services in the same private space.  With it, your webapps and your devices can share data easily, providing you with a new experience. You can install Cozy on your own hardware where no one's tracking you.


# Cozy Browser Extension

Securely store your passwords and make it easy to add and update your Cozy connectors!

The Cozy browser extension is written using the Web Extension API and Angular. It is based on [Bitwarden](https://github.com/bitwarden/browser).


# Build/Run

## Requirements

- [Node.js](https://nodejs.org) v10 or greater
- [Gulp](https://gulpjs.com/) (`npm install --global gulp-cli`)
- Chrome (preferred), Opera, Firefox browser or Safari

## Build for developement

```
npm install
npm run build:watch
```

You can now load the extension into your browser through the browser's extension tools page:

- Chrome/Opera:
  1. Type `chrome://extensions` in your address bar to bring up the extensions page.
  2. Enable developer mode (checkbox)
  3. Click the "Load unpacked extension" button, navigate to the `build` folder of your local extension instance, and click "Ok".
- Firefox
  1. Type `about:debugging` in your address bar to bring up the add-ons page.
  2. Click the `Load Temporary Add-on` button, navigate to the `build/manifest.json` file, and "Open".

## Production build

Production builds can be created for each browser with the following commands:

```
npm install
npm run dist:<firefox|chrome|opera|safari>`
```

You can also build all of them in once by running:
```
npm install
npm run dist`
```

## Source archive

In case you need to create an archive of the source code, which can be required for an add-on submission on some platforms:
```
npm run dist:sources
```

