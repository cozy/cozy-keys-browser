# What's Cozy?

![Cozy Logo](https://cdn.rawgit.com/cozy/cozy-guidelines/master/templates/cozy_logo_small.svg)

[Cozy] is a platform that brings all your web services in the same private space. With it, your webapps and your devices can share data easily, providing you with a new experience. You can install Cozy on your own hardware where no one's tracking you.

# Cozy Browser Extension

Securely store your passwords and make it easy to add and update your Cozy connectors!

The Cozy browser extension is written using the Web Extension API and Angular. It is based on [Bitwarden](https://github.com/bitwarden/browser).

# Build/Run

## Requirements

- [Node.js](https://nodejs.org) v20 and NPM v10
- [Gulp](https://gulpjs.com/) (`npm install --global gulp-cli`)
- Chrome (preferred), Opera, Firefox browser or Safari
- toolchain C++ (ubuntu) `sudo apt-get install build-essential`

## Build for developement

```sh
cd ../..        # run install from project root
npm install --legacy-peer-deps
cd apps/browser # run from this directory
npm run build:watch
# In watch mode, you can run a command - for instance to play a sound - by personalizing the `webpack.announcer.plugin.js`
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

Before building the addon, you can run tests and prettier :

```sh
npm run lint      # audit lint
npm run prettier  # repair lint
npm run test      # run tests
```

Production builds can be created for each browser with the following commands:

```sh
npm install
npm run dist:<firefox|chrome|opera|safari>
```

Manifests are located in the `browser` subdirectory of the Bitwarden configuration directory. For instance, on Windows the manifests are located at `C:\Users\<user>\AppData\Roaming\Bitwarden\browsers` and on macOS these are in `Application Support` for various browsers ([for example](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Native_manifests#manifest_location)). Note that disabling the desktop integration will delete the manifests, and the files will need to be updated again.

You can also build all of them in once by running:

```sh
npm install
npm run dist
```

## Source archive

In case you need to create an archive of the source code, which can be required for an add-on submission on some platforms:

```sh
npm run dist:sources # sources will be in `dist/cozy-keys-sources.zip`
```

## Desktop communication

Native Messaging (communication between the desktop application and browser extension) works by having the browser start a lightweight proxy baked into our desktop application.

Out of the box, the desktop application can only communicate with the production browser extension. When you enable browser integration in the desktop application, the application generates manifests which contain the production IDs of the browser extensions. To enable communication between the desktop application and development versions of browser extensions, add the development IDs to the `allowed_extensions` section of the corresponding manifests.

Manifests are located in the `browser` subdirectory of the Bitwarden configuration directory. For instance, on Windows the manifests are located at `C:\Users\<user>\AppData\Roaming\Bitwarden\browsers` and on macOS these are in `Application Support` for various browsers ([for example](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Native_manifests#manifest_location)). Note that disabling the desktop integration will delete the manifests, and the files will need to be updated again.

## Prettier

We recently migrated to using Prettier as code formatter. All previous branches will need to updated to avoid large merge conflicts using the following steps:

1. Check out your local Branch
2. Run `git merge cebee8aa81b87cc26157e5bd0f879db254db9319`
3. Resolve any merge conflicts, commit.
4. Run `npm run prettier`
5. Commit
6. Run `git merge -Xours 8fe821b9a3f9728bcb02d607ca75add468d380c1`
7. Push

### Git blame

We also recommend that you configure git to ignore the prettier revision using:

```bash
git config blame.ignoreRevsFile .git-blame-ignore-revs
```
