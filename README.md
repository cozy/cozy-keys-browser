# What's Cozy?


![Cozy Logo](https://cdn.rawgit.com/cozy/cozy-guidelines/master/templates/cozy_logo_small.svg)

[Cozy] is a platform that brings all your web services in the same private space.  With it, your webapps and your devices can share data easily, providing you with a new experience. You can install Cozy on your own hardware where no one's tracking you.


# Cozy Browser Extension

Securely store your passwords and make it easy to add and update your Cozy connectors!

The Cozy browser extension is written using the Web Extension API and Angular. It is based on [Bitwarden](https://github.com/bitwarden/browser).


# Build/Run

## Requirements

- [Node.js](https://nodejs.org) v16.15.0 (bug in npm 8.11.0 and greater)
- NPM 8.5.5
- [Gulp](https://gulpjs.com/) (`npm install --global gulp-cli`)
- Chrome (preferred), Opera, Firefox browser or Safari

## Build for developement

```
npm install
npm run start
```

You can now load the extension into your browser through the browser's extension tools page:

- Chrome/Opera:
  1. Type `chrome://extensions` in your address bar to bring up the extensions page.
  2. Enable developer mode (toggle switch)
  3. Click the "Load unpacked extension" button, navigate to the `build` folder of your local extension instance, and click "Ok".
- Firefox
  1. Type `about:debugging` in your address bar to bring up the add-ons page.
  2. Click the `Load Temporary Add-on` button, navigate to the `build/manifest.json` file, and "Open".

## Production build

Production builds can be created for each browser with the following commands:
Out of the box, the desktop application can only communicate with the production browser extension. When you enable browser integration in the desktop application, the application generates manifests which contain the production IDs of the browser extensions. To enable communication between the desktop application and development versions of browser extensions, add the development IDs to the `allowed_extensions` section of the corresponding manifests.

```
npm install
npm run dist:<firefox|chrome|opera|safari>`
```
Manifests are located in the `browser` subdirectory of the Bitwarden configuration directory. For instance, on Windows the manifests are located at `C:\Users\<user>\AppData\Roaming\Bitwarden\browsers` and on macOS these are in `Application Support` for various browsers ([for example](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Native_manifests#manifest_location)). Note that disabling the desktop integration will delete the manifests, and the files will need to be updated again.

You can also build all of them in once by running:
```
npm install
npm run dist
```

## Source archive

In case you need to create an archive of the source code, which can be required for an add-on submission on some platforms:
```
npm run dist:sources
```

## Desktop communication

Native Messaging (communication between the desktop application and browser extension) works by having the browser start a lightweight proxy baked into our desktop application.

Out of the box, the desktop application can only communicate with the production browser extension. When you enable browser integration in the desktop application, the application generates manifests which contain the production IDs of the browser extensions. To enable communication between the desktop application and development versions of browser extensions, add the development IDs to the `allowed_extensions` section of the corresponding manifests.

Manifests are located in the `browser` subdirectory of the Bitwarden configuration directory. For instance, on Windows the manifests are located at `C:\Users\<user>\AppData\Roaming\Bitwarden\browsers` and on macOS these are in `Application Support` for various browsers ([for example](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Native_manifests#manifest_location)). Note that disabling the desktop integration will delete the manifests, and the files will need to be updated again.
