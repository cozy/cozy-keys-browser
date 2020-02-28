# Overrides

To rebrand the extension with Cozy colors and add features specific to Cozy,
we override some of the components of the original Bitwarden browser extension.
The way we do these overrides is by extending some classes and add or change
some methods in it.

The purpose of this document is to list all the overrides, so we have a global
vision of what we did.

## Login

### Replace email/password with cozy instance/password

To login, we ask the user to enter his cozy instance URL instead of an email address.

Related PRs:

* https://github.com/cozy/cozy-keys-browser/pull/2
* https://github.com/cozy/cozy-keys-browser/pull/33

## Password generation

### Hide generation options

Generation options are hidden by default (still accessible after a click).

Related PRs:

* https://github.com/cozy/cozy-keys-browser/pull/8

### Place the regenerate and copy actions next to the password

These two actions are located under the password in Bitwarden extension. For us,
the actions are icons placed next to the password.

Related PRs:

* https://github.com/cozy/cozy-keys-browser/pull/8

### Automatically copy the password to the clipboard

When the user goes to the generate tab, the generated password is directly
copied in his clipboard.

Related PRs:

* https://github.com/cozy/cozy-keys-browser/pull/8

## Highlight ciphers shared with cozy organization

We add a cozy icon on ciphers that are shared with cozy organization.

Related PRs:

* https://github.com/cozy/cozy-keys-browser/pull/19

## Notification bar

### Restyle the notification bar to fit our needs

When we show a notification because we detected that some credentials can be
added to the vault, we want a specific look and feel.

Related PRs:

* https://github.com/cozy/cozy-keys-browser/pull/16

## Konnectors suggestions

Based on the brands present in the user's vault, we automatically create some apps
and konnectors install suggestions.

Related PRs:

* https://github.com/cozy/cozy-keys-browser/pull/24

## Autofill and save password popup improvements

We worked a lot on autofill so it handles more websites than the Bitwarden
extension. Also on "save password" popup because it was not showing on several
websites.

Related PRs:

* https://github.com/cozy/cozy-keys-browser/pull/44
* https://github.com/cozy/cozy-keys-browser/pull/45
* https://github.com/cozy/cozy-keys-browser/pull/47
* https://github.com/cozy/cozy-keys-browser/pull/46
* https://github.com/cozy/cozy-keys-browser/pull/50

## OAuth client

### Update synchronized_at on oauth client

Since the oauth client used to connect the extension to the cozy instance is
displayed in cozy-settings, we want to show its last synchronization date. To
achieve this, we needed to add some calls to the stack.

Related PRs:

* https://github.com/cozy/cozy-keys-browser/pull/57

### Set client name according to the browser being used

We cant the OAuth client to have a name that reflects the browser in which the
extension is used (firefox, chrome).

Related PRs:

* https://github.com/cozy/cozy-keys-browser/pull/63

### Remove OAuth client on logout

On login, the OAuth client is created by the stack. On logout, there is no call
to a "logout" route. Everything is done on client side, so the client was never
removed. We added a call to the stack to remove the client on logout.

Related PRs:

* https://github.com/cozy/cozy-keys-browser/pull/64

## Export

### Export all ciphers

In the Bitwarden extension, ciphers that are shared with an organization are not
part of the ciphers being exported. In our case, we want to export all the
ciphers, even the one shared with the cozy organization.

Related PRs:

* https://github.com/cozy/cozy-keys-browser/pull/62

## Extension status

To work in pair with the cozy-passwords app, we needed the extension to be able
to report its own status (installed, connected) via a messaging mechanism with
an app.

Related PRs:

* https://github.com/cozy/cozy-keys-browser/pull/48
* https://github.com/cozy/cozy-keys-browser/pull/72

## Features removed

We don't support some features present in the Bitwarden extension.

Related PRs:

* https://github.com/cozy/cozy-keys-browser/pull/5
* https://github.com/cozy/cozy-keys-browser/pull/6
* https://github.com/cozy/cozy-keys-browser/pull/8
* https://github.com/cozy/cozy-keys-browser/pull/9
* https://github.com/cozy/cozy-keys-browser/pull/17
* https://github.com/cozy/cozy-keys-browser/pull/18
* https://github.com/cozy/cozy-keys-browser/pull/22
* https://github.com/cozy/cozy-keys-browser/pull/49
