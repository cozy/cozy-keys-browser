import {
    cancelButtonNames,
    changePasswordButtonContainsNames,
    changePasswordButtonNames,
    logInButtonNames,
} from './consts';

// See original file:
// https://github.com/bitwarden/browser/blob/3e1e05ab4ffabbf180972650818a3ae3468dbdfb/src/content/notificationBar.ts
document.addEventListener('DOMContentLoaded', (event) => {

    const pageDetails: any[] = [];
    const formData: any[] = [];
    let barType: string = null;
    let pageHref: string = null;
    let observer: MutationObserver = null;
    const observeIgnoredElements = new Set(['a', 'i', 'b', 'strong', 'span', 'code', 'br', 'img', 'small', 'em', 'hr']);
    const submitButtonSelector = 'input[type="submit"], input[type="image"], ' +
        'button[type="submit"]';
    let domObservationCollectTimeout: number = null;
    let collectIfNeededTimeout: number = null;
    const inIframe = isInIframe();
    let notificationBarData = null;
    const isSafari = (typeof safari !== 'undefined') && navigator.userAgent.indexOf(' Safari/') !== -1 &&
        navigator.userAgent.indexOf('Chrome') === -1;
    let disabledAddLoginNotification = false;
    let disabledChangedPasswordNotification = false;
    const formEls = new Set();

    if (isSafari) {
        if ((window as any).__bitwardenFrameId == null) {
            (window as any).__bitwardenFrameId = Math.floor(Math.random() * Math.floor(99999999));
        }
        if (inIframe) {
            return;
        }

        const responseCommand = 'notificationBarDataResponse';
        safari.extension.dispatchMessage('bitwarden', {
            command: 'bgGetDataForTab',
            responseCommand: responseCommand,
            bitwardenFrameId: (window as any).__bitwardenFrameId,
        });
        safari.self.addEventListener('message', (msgEvent: any) => {
            const msg = JSON.parse(msgEvent.message.msg);
            if (msg.bitwardenFrameId != null && (window as any).__bitwardenFrameId !== msg.bitwardenFrameId) {
                return;
            }
            if (msg.command === responseCommand && msg.data) {
                notificationBarData = msg.data;
                if (notificationBarData.neverDomains &&
                    notificationBarData.neverDomains.hasOwnProperty(window.location.hostname)) {
                    return;
                }

                disabledAddLoginNotification = notificationBarData.disabledAddLoginNotification === true;
                disabledChangedPasswordNotification = notificationBarData.disabledChangedPasswordNotification === true;
                if (!disabledAddLoginNotification || !disabledChangedPasswordNotification) {
                    collectIfNeededWithTimeout();
                }
            }

            processMessages(msg, () => { /* do nothing on send response for Safari */ });
        }, false);
        return;
    } else {
        chrome.storage.local.get('neverDomains', (ndObj: any) => {
            const domains = ndObj.neverDomains;
            if (domains != null && domains.hasOwnProperty(window.location.hostname)) {
                return;
            }

            chrome.storage.local.get('disableAddLoginNotification', (disAddObj: any) => {
                disabledAddLoginNotification = disAddObj != null && disAddObj.disableAddLoginNotification === true;
                chrome.storage.local.get('disableChangedPasswordNotification', (disChangedObj: any) => {
                    disabledChangedPasswordNotification = disChangedObj != null &&
                        disChangedObj.disableChangedPasswordNotification === true;
                    if (!disabledAddLoginNotification || !disabledChangedPasswordNotification) {
                        collectIfNeededWithTimeout();
                    }
                });
            });
        });

        chrome.runtime.onMessage.addListener((msg: any, sender: any, sendResponse: Function) => {
            processMessages(msg, sendResponse);
        });
    }

    function processMessages(msg: any, sendResponse: Function) {
        if (msg.command === 'openNotificationBar') {
            if (inIframe) {
                return;
            }
            closeExistingAndOpenBar(msg.data.type, msg.data.typeData);
            sendResponse();
            return true;
        } else if (msg.command === 'closeNotificationBar') {
            if (inIframe) {
                return;
            }
            closeBar(true);
            sendResponse();
            return true;
        } else if (msg.command === 'adjustNotificationBar') {
            if (inIframe) {
                return;
            }
            adjustBar(msg.data);
            sendResponse();
            return true;

        } else if (msg.command === 'notificationBarPageDetails') {
            pageDetails.push(msg.data.details);
            watchForms(msg.data.forms);
            sendResponse();
            return true;
        }
    }

    function isInIframe() {
        try {
            return window.self !== window.top;
        } catch {
            return true;
        }
    }

    /**
     * observeDom watches changes in the DOM and starts a new details page collect
     * if a new form is found.
     */
    function observeDom() {
        const bodies = document.querySelectorAll('body');
        if (bodies && bodies.length > 0) {
            observer = new MutationObserver((mutations) => {
                if (mutations == null || mutations.length === 0 || pageHref !== window.location.href) {
                    return;
                }
                let doCollect = false;
                for (let i = 0; i < mutations.length; i++) {
                    const mutation = mutations[i];
                    if (mutation.addedNodes == null || mutation.addedNodes.length === 0) {
                        continue;
                    }
                    for (let j = 0; j < mutation.addedNodes.length; j++) {
                        const addedNode: any = mutation.addedNodes[j];
                        if (addedNode == null) {
                            continue;
                        }

                        const tagName = addedNode.tagName != null ? addedNode.tagName.toLowerCase() : null;
                        if (tagName != null && tagName === 'form' &&
                            (addedNode.dataset == null || !addedNode.dataset.bitwardenWatching)) {
                            doCollect = true;
                            break;
                        }

                        if ((tagName != null && observeIgnoredElements.has(tagName)) ||
                            addedNode.querySelectorAll == null) {
                            continue;
                        }

                        const forms = addedNode.querySelectorAll('form:not([data-bitwarden-watching])');
                        if (forms != null && forms.length > 0) {
                            doCollect = true;
                            break;
                        }
                    }

                    if (doCollect) {
                        break;
                    }
                }

                if (doCollect) {
                    if (domObservationCollectTimeout != null) {
                        window.clearTimeout(domObservationCollectTimeout);
                    }
                    // Cozy : the timeout is tightened compared to BW because when mutations are trigered,
                    // the browser has already differed the event : there is no need to wait more.
                    domObservationCollectTimeout = window.setTimeout(collect, 100);
                }
            });

            observer.observe(bodies[0], { childList: true, subtree: true });
        }
    }

    function collectIfNeededWithTimeout() {
        collectIfNeeded();
        if (collectIfNeededTimeout != null) {
            window.clearTimeout(collectIfNeededTimeout);
        }
        collectIfNeededTimeout = window.setTimeout(collectIfNeeded, 1000);
    }

    function collectIfNeeded() {
        if (pageHref !== window.location.href) {
            pageHref = window.location.href;
            if (observer) {
                observer.disconnect();
                observer = null;
            }
            collect();
            // The DOM might change during the collect: watch the DOM body for changes.
            // Note: a setTimeout was present here, apparently related to the autofill:
            // https://github.com/bitwarden/browser/commit/d19fcd6e4ccf062b595c2823267ffd32fd8e5a3d
            observeDom();
        }

        if (collectIfNeededTimeout != null) {
            window.clearTimeout(collectIfNeededTimeout);
        }

        // @override by Cozy :
        // this loop waiting for (pageHref !== window.location.href) to become true seems useless :
        // we only need to react to dom modifications, already taken into account by observeDom()
        // so we comment the loop waiting for "production tests"
        // collectIfNeededTimeout = window.setTimeout(collectIfNeeded, 1000);
    }

    function collect() {
        sendPlatformMessage({
            command: 'bgCollectPageDetails',
            sender: 'notificationBar',
        });
    }

    function watchForms(forms: any[]) {
        if (forms == null || forms.length === 0) {
            return;
        }

        forms.forEach((f: any) => {
            const formId: string = f.form != null ? f.form.htmlID : null;
            let formEl: HTMLFormElement = null;
            if (formId != null && formId !== '') {
                // Get form by id
                formEl = document.getElementById(formId) as HTMLFormElement;
            } else if (f.form.htmlClass) {
                // Get form by class
                const formsByClass = document.getElementsByClassName(
                    f.form.htmlClass) as HTMLCollectionOf<HTMLFormElement>;
                if (formsByClass.length > 0) {
                    formEl = formsByClass[0];
                }
            }
            if (formEl == null) {
                const index = parseInt(f.form.opid.split('__')[2], null);
                formEl = document.getElementsByTagName('form')[index];
            }
            if (!formEl) {
                return;
            }
            if (formEls.has(formEl)) {
                // The form has already been processed: nothing to do here
                return;
            } else {
                // This is a new form
                formEls.add(formEl);
            }

            const formDataObj: any = {
                data: f,
                formEl: formEl,
                usernameEl: null,
                passwordEl: null,
                passwordEls: null,
            };
            locateFields(formDataObj);
            formData.push(formDataObj);
            listen(formEl);
        });
    }

    function listen(form: HTMLFormElement) {
        form.removeEventListener('submit', formSubmitted, false);
        form.addEventListener('submit', formSubmitted, false);
        const submitButton = getSubmitButton(form, logInButtonNames);
        if (submitButton != null) {
            submitButton.removeEventListener('click', formSubmitted, false);
            submitButton.addEventListener('click', formSubmitted, false);
        } else {
            // No submit button found in the form: it might be elsewhere in the document
            const potentialSubmitButtons = getButtonsInDocument();
            for (const button of potentialSubmitButtons) {
                button.removeEventListener('click', formSubmitted, false);
                button.addEventListener('click', formSubmitted, false);
            }
        }
    }

    function locateFields(formDataObj: any) {
        const inputs = Array.from(document.getElementsByTagName('input'));
        formDataObj.usernameEl = locateField(formDataObj.formEl, formDataObj.data.username, inputs);
        if (formDataObj.usernameEl != null && formDataObj.data.password != null) {
            formDataObj.passwordEl = locatePassword(formDataObj.formEl, formDataObj.data.password, inputs, true);
        } else if (formDataObj.data.passwords != null) {
            formDataObj.passwordEls = [];
            formDataObj.data.passwords.forEach((pData: any) => {
                const el = locatePassword(formDataObj.formEl, pData, inputs, false);
                if (el != null) {
                    formDataObj.passwordEls.push(el);
                }
            });
            if (formDataObj.passwordEls.length === 0) {
                formDataObj.passwordEls = null;
            }
        }
    }

    function locatePassword(form: HTMLFormElement, passwordData: any, inputs: HTMLInputElement[],
        doLastFallback: boolean) {
        let el = locateField(form, passwordData, inputs);
        if (el != null && el.type !== 'password') {
            el = null;
        }
        if (doLastFallback && el == null) {
            el = form.querySelector('input[type="password"]');
        }
        return el;
    }

    function locateField(form: HTMLFormElement, fieldData: any, inputs: HTMLInputElement[]) {
        if (fieldData == null) {
            return;
        }
        let el: HTMLInputElement = null;
        if (fieldData.htmlID != null && fieldData.htmlID !== '') {
            try {
                el = form.querySelector('#' + fieldData.htmlID);
            } catch { }
        }
        if (el == null && fieldData.htmlName != null && fieldData.htmlName !== '') {
            el = form.querySelector('input[name="' + fieldData.htmlName + '"]');
        }
        if (el == null && fieldData.elementNumber != null) {
            el = inputs[fieldData.elementNumber];
        }
        return el;
    }

    function formSubmitted(e: Event) {
        let form: HTMLFormElement = null;
        if (e.type === 'click') {
            form = (e.target as HTMLElement).closest('form');
            if (form == null) {
                const parentModal = (e.target as HTMLElement).closest('div.modal');
                if (parentModal != null) {
                    const modalForms = parentModal.querySelectorAll('form');
                    if (modalForms.length === 1) {
                        form = modalForms[0];
                    }
                }
            }
        } else {
            form = e.target as HTMLFormElement;
        }

        if (form && form.dataset.bitwardenProcessed === '1') {
            return;
        }
        for (let i = 0; i < formData.length; i++) {
            if (form && formData[i].formEl !== form) {
                continue;
            }
            const disabledBoth = disabledChangedPasswordNotification && disabledAddLoginNotification;
            if (!disabledBoth && formData[i].usernameEl != null && formData[i].passwordEl != null) {
                const login = {
                    username: formData[i].usernameEl.value,
                    password: formData[i].passwordEl.value,
                    url: document.URL,
                };
                if (login.username != null && login.username !== '' &&
                    login.password != null && login.password !== '') {

                    if (!form) {
                        // This happens when the submit button was found outside of the form
                        form = formData[i].formEl;
                    }
                    processedForm(form);
                    sendPlatformMessage({
                        command: 'bgAddLogin',
                        login: login,
                    });
                    break;
                }
            }
            if (!disabledChangedPasswordNotification && formData[i].passwordEls != null) {
                const passwords: string[] = formData[i].passwordEls
                    .filter((el: HTMLInputElement) => el.value != null && el.value !== '')
                    .map((el: HTMLInputElement) => el.value);

                let curPass: string = null;
                let newPass: string = null;
                let newPassOnly = false;

                if (formData[i].passwordEls.length === 3 && passwords.length === 3) {
                    newPass = passwords[1];
                    if (passwords[0] !== newPass && newPass === passwords[2]) {
                        curPass = passwords[0];
                    } else if (newPass !== passwords[2] && passwords[0] === newPass) {
                        curPass = passwords[2];
                    }
                } else if (formData[i].passwordEls.length === 2 && passwords.length === 2) {
                    if (passwords[0] === passwords[1]) {
                        newPassOnly = true;
                        newPass = passwords[0];
                        curPass = null;
                    } else if (form) {
                        const buttonText = getButtonText(getSubmitButton(form, changePasswordButtonNames));
                        const matches = Array.from(changePasswordButtonContainsNames)
                            .filter((n) => buttonText.indexOf(n) > -1);
                        if (matches.length > 0) {
                            curPass = passwords[0];
                            newPass = passwords[1];
                        }
                    }
                }

                if (newPass != null && curPass != null || (newPassOnly && newPass != null)) {
                    if (!form) {
                        // This happens when the submit button was found outside of the form
                        form = formData[i].formEl;
                    }
                    processedForm(form);
                    sendPlatformMessage({
                        command: 'bgChangedPassword',
                        data: {
                            newPassword: newPass,
                            currentPassword: curPass,
                            url: document.URL,
                        },
                    });
                    break;
                }
            }
        }
    }

    function getButtonsInDocument() {
        const submitButtons = document.querySelectorAll(submitButtonSelector +
             ', div[role="button"]') as NodeList;
        return submitButtons;
    }

    function getSubmitButton(wrappingEl: HTMLElement, buttonNames: Set<string>) {
        if (wrappingEl == null) {
            return null;
        }

        const wrappingElIsForm = wrappingEl.tagName.toLowerCase() === 'form';

        let submitButton = wrappingEl.querySelector(submitButtonSelector) as HTMLElement;
        if (submitButton == null && wrappingElIsForm) {
            submitButton = wrappingEl.querySelector('button:not([type])');
            if (submitButton != null) {
                const buttonText = getButtonText(submitButton);
                if (buttonText != null && cancelButtonNames.has(buttonText.trim().toLowerCase())) {
                    submitButton = null;
                }
            }
        }
        if (submitButton == null) {
            const possibleSubmitButtons = Array.from(wrappingEl.querySelectorAll('a, span, button[type="button"], ' +
                'input[type="button"], button:not([type])')) as HTMLElement[];
            let typelessButton: HTMLElement = null;
            possibleSubmitButtons.forEach((button) => {
                if (submitButton != null || button == null || button.tagName == null) {
                    return;
                }
                const inputButton = button as HTMLInputElement;
                if (inputButton.type === 'submit') {
                    submitButton = button;
                }
                const buttonText = getButtonText(button);
                if (buttonText != null) {
                    if (typelessButton != null && button.tagName.toLowerCase() === 'button' &&
                        button.getAttribute('type') == null &&
                        !cancelButtonNames.has(buttonText.trim().toLowerCase())) {
                        typelessButton = button;
                    } else if (buttonNames.has(buttonText.trim().toLowerCase())) {
                        submitButton = button;
                    }
                }
            });
            if (submitButton == null && typelessButton != null) {
                submitButton = typelessButton;
            }
        }
        if (submitButton == null && wrappingElIsForm) {
            // Maybe it's in a modal?
            const parentModal = wrappingEl.closest('div.modal') as HTMLElement;
            if (parentModal != null) {
                const modalForms = parentModal.querySelectorAll('form');
                if (modalForms.length === 1) {
                    submitButton = getSubmitButton(parentModal, buttonNames);
                }
            }
        }
        return submitButton;
    }

    function getButtonText(button: HTMLElement) {
        let buttonText: string = null;
        if (button.tagName.toLowerCase() === 'input') {
            buttonText = (button as HTMLInputElement).value;
        } else {
            buttonText = button.innerText;
        }
        return buttonText;
    }

    function processedForm(form: HTMLFormElement) {
        form.dataset.bitwardenProcessed = '1';
        window.setTimeout(() => {
            form.dataset.bitwardenProcessed = '0';
        }, 500);
    }

    function closeExistingAndOpenBar(type: string, typeData: any) {
        let barPage = (isSafari ? 'app/' : '') + 'notification/bar.html';
        switch (type) {
            case 'info':
                barPage = barPage + '?info=' + typeData.text;
                break;
            case 'warning':
                barPage = barPage + '?warning=' + typeData.text;
                break;
            case 'error':
                barPage = barPage + '?error=' + typeData.text;
                break;
            case 'success':
                barPage = barPage + '?success=' + typeData.text;
                break;
            case 'add':
                barPage = barPage + '?add=1';
                break;
            case 'change':
                barPage = barPage + '?change=1';
                break;
            default:
                break;
        }

        const frame = document.getElementById('notification-bar-iframe') as HTMLIFrameElement;
        if (frame != null && frame.src.indexOf(barPage) >= 0) {
            return;
        }

        closeBar(false);
        openBar(type, barPage);
    }

    function openBar(type: string, barPage: string) {
        barType = type;

        if (document.body == null) {
            return;
        }

        const barPageUrl: string = isSafari ? (safari.extension.baseURI + barPage) : chrome.extension.getURL(barPage);

        const iframe = document.createElement('iframe');
        iframe.id = 'notification-bar-iframe';
        if (isSafari) {
            iframe.style.cssText = ' width: 100%;max-width: 430px; border: solid 1px rgba(50, 54, 63, 0.12); top: 8px; right: 17px;  border-radius: 8px;   animation: fadein 0.2s;' // tslint:disable-line
        }
        const frameDiv = document.createElement('div');
        frameDiv.setAttribute('aria-live', 'polite');
        frameDiv.id = 'notification-bar';
        if (isSafari)  {
            frameDiv.style.cssText = 'height: 42px; top: 0; right: 0; padding: 0; position: fixed; ' +
            'z-index: 2147483647; visibility: visible;';
        }
        frameDiv.appendChild(iframe);
        document.body.appendChild(frameDiv);

        (iframe.contentWindow.location as any) = barPageUrl;
    }

    function closeBar(explicitClose: boolean) {
        const barEl = document.getElementById('notification-bar');
        if (barEl != null) {
            barEl.parentElement.removeChild(barEl);
        }
        if (!explicitClose) {
            return;
        }

        switch (barType) {
            case 'add':
                sendPlatformMessage({
                    command: 'bgAddClose',
                });
                break;
            case 'change':
                sendPlatformMessage({
                    command: 'bgChangeClose',
                });
                break;
            default:
                break;
        }
    }

    function adjustBar(data: any) {
        if (data != null) {
            const newHeight = data.height + 'px';
            doHeightAdjustment('notification-bar-iframe', newHeight);
            doHeightAdjustment('notification-bar', newHeight);
        }
    }

    function doHeightAdjustment(elId: string, heightStyle: string) {
        const el = document.getElementById(elId);
        if (el != null) {
            el.style.height = heightStyle;
        }
    }

    function sendPlatformMessage(msg: any) {
        if (isSafari) {
            msg.bitwardenFrameId = (window as any).__bitwardenFrameId;
            safari.extension.dispatchMessage('bitwarden', msg);
        } else {
            chrome.runtime.sendMessage(msg);
        }
    }
});
