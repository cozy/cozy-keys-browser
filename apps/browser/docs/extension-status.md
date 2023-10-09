# Extension status

The extension is able to expose its current status to an app that needs to know
it in order to do something. The only example of this today is
[cozy-passwords](https://github.com/cozy/cozy-passwords) that needs the
extension status to redirect the user to the right route to give him the best
instructions.

This status is exposed at the application's will: it's the role of the
application to ask to the extension what's its status.

To achieve this, the extension injects a script in each tab (this script is
called a content script, and is located in `src/content/appInfo.ts`). This
script adds an event listener on the `document` for the event
`cozy.passwordextension.check-status`. Here, it's important to have in mind
that the `document` is the same for the script and the app. When an event is
received, the script will send a message to the extension's main background
(`src/backgound/main.background.ts`), which will check if the extension is
currently authenticated or not and responds to the message with `installed` if
it's not authenticated, or `connected` if it's authenticated. The script will
then get the response and trigger an event on the `document` :

* `cozy.passwordextension.connected`: when the extension is connected
* `cozy.passwordextension.installed`: when the extension is not connected

The app is then able to listen to these events and do what it wants when it
receives one of them.

So the content script acts like a "bridge" between the app and the extension,
as it shares a bit of context with each one.

The idea has been taken from https://krasimirtsonev.com/blog/article/Send-message-from-web-page-to-chrome-extensions-background-script.
