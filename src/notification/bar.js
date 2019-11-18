require('./bar.scss');

// See original file:
// https://github.com/bitwarden/browser/blob/3e1e05ab4ffabbf180972650818a3ae3468dbdfb/src/notification/bar.js
document.addEventListener('DOMContentLoaded', () => {
    var i18n = {};
    if (typeof safari !== 'undefined') {
        const responseCommand = 'notificationBarFrameDataResponse';
        sendPlatformMessage({
            command: 'bgGetDataForTab',
            responseCommand: responseCommand
        });
        safari.self.addEventListener('message', (msgEvent) => {
            const msg = JSON.parse(msgEvent.message.msg);
            if (msg.command === responseCommand && msg.data) {
                i18n = msg.data.i18n;
                load();
            }
        }, false);
    } else {
        i18n.appName = chrome.i18n.getMessage('appName');
        i18n.close = chrome.i18n.getMessage('close');
        i18n.yes = chrome.i18n.getMessage('yes');
        i18n.never = chrome.i18n.getMessage('never');
        i18n.notificationAddSave = chrome.i18n.getMessage('notificationAddSave');
        i18n.notificationNeverSave = chrome.i18n.getMessage('notificationNeverSave');
        i18n.notificationAddDesc = chrome.i18n.getMessage('notificationAddDesc');
        i18n.notificationChangeSave = chrome.i18n.getMessage('notificationChangeSave');
        i18n.notificationChangeDesc = chrome.i18n.getMessage('notificationChangeDesc');
        i18n.moreOptions = chrome.i18n.getMessage('moreOptions');
        i18n.notificationAddSavePassword = chrome.i18n.getMessage('notificationAddSavePassword');
        i18n.notificationAddSaveData = chrome.i18n.getMessage('notificationAddSaveData');
        i18n.notificationNeverAsk = chrome.i18n.getMessage('notificationNeverAsk');

        // delay 50ms so that we get proper body dimensions
        setTimeout(load, 50);
    }

    function load() {

        const body = document.querySelector('body'),
            bodyRect = body.getBoundingClientRect();

        // i18n
        body.classList.add('lang-' + window.navigator.language.slice(0, 2));

        document.getElementById('logo-link').title = i18n.appName;

        // Set text in popup
        document.querySelector('#template-notif .never-save').textContent = i18n.notificationNeverSave;
        document.querySelector('#template-notif .more-options-text').textContent = i18n.moreOptions;
        document.querySelector('#template-options .save-password').textContent = i18n.notificationAddSavePassword;
        document.querySelector('#template-options .save-data').textContent = i18n.notificationAddSaveData;
        document.querySelector('#template-options .save-neverask').textContent = i18n.notificationNeverAsk;

        // NOTE: the info context was removed in absence of use-case yet.
        // See original file commit at the beggining of this line.
        const addContext = getQueryVariable('add');
        const changeContext = getQueryVariable('change');

        if (addContext) {
            document.querySelector('#template-notif .add-or-change').textContent = i18n.notificationAddSave;
            document.querySelector('#template-notif .desc-text').textContent = i18n.notificationAddDesc;
        } else if (changeContext) {
            document.querySelector('#template-notif .add-or-change').textContent = i18n.notificationChangeSave;
            document.querySelector('#template-notif .desc-text').textContent = i18n.notificationChangeDesc;
        } else {
            return;
        }

        // Set DOM content
        setContent(document.getElementById('template-notif'));

        // Set listeners
        const addButton = document.querySelector('#template-notif-clone .add-or-change'),
            neverButton = document.querySelector('#template-notif-clone .never-save'),
            moreOptions = document.querySelector('#template-notif-clone .more-options');

        addButton.addEventListener('click', (e) => {
            e.preventDefault();
            const command = changeContext ? 'bgChangeSave' : 'bgAddSave';
            sendPlatformMessage({
                command: command
            });
        });

        neverButton.addEventListener('click', (e) => {
            e.preventDefault();
            sendPlatformMessage({
                command: 'bgNeverSave'
            });
        });

        moreOptions.addEventListener('click', (e) => {
            e.preventDefault();
            const display = document.querySelector('.template-options').style.display;
            if(display === "none") {
                // Show options
                document.querySelector('#arrow-right').style.display = "none";
                document.querySelector('#arrow-down').style.display = "inline";
                document.querySelector('.template-options').style.display = "block";
            } else {
                // Hide options
                document.querySelector('#arrow-right').style.display = "inline";
                document.querySelector('#arrow-down').style.display = "none";
                document.querySelector('.template-options').style.display = "none";
            }
            sendAdjustBodyHeight(body);
        });
        sendAdjustBodyHeight(body);
    }

    // Adjust height dynamically
    function sendAdjustBodyHeight(body) {
        sendPlatformMessage({
            command: 'bgAdjustNotificationBar',
            data: {
                height: body.scrollHeight + 15 // Add 15px for margin
            }
        });
    }

    function getQueryVariable(variable) {
        var query = window.location.search.substring(1);
        var vars = query.split('&');

        for (var i = 0; i < vars.length; i++) {
            var pair = vars[i].split('=');
            if (pair[0] === variable) {
                return pair[1];
            }
        }

        return null;
    }

    function setContent(element) {
        const content = document.getElementById('content');
        while (content.firstChild) {
            content.removeChild(content.firstChild);
        }

        var newElement = element.cloneNode(true);
        newElement.id = newElement.id + '-clone';
        content.appendChild(newElement);
    }

    function sendPlatformMessage(msg) {
        if (typeof safari !== 'undefined') {
            safari.extension.dispatchMessage('bitwarden', msg);
        } else {
            chrome.runtime.sendMessage(msg);
        }
    }
});
