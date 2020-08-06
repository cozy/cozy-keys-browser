require('./loginMenu.scss');

import { AuthService } from 'jslib/abstractions/auth.service';
import { EnvironmentService } from 'jslib/abstractions/environment.service';
import { Utils } from 'jslib/misc/utils';


// Globals
// UI elements
var panel               ,
    closeIcon           ,
    visiPwdBtn          ,
    visi2faBtn          ,
    urlInput             ,
    pwdInput            ,
    twoFaInput          ,
    errorLabel          ,
    submitBtn           ,
    isPwdHidden = true  ,
    is2faHidden = true  ,
    isIn2FA     = false



document.addEventListener('DOMContentLoaded', () => {

    // 1- get elements references
    panel = document.querySelector('.panel')
    visiPwdBtn = document.getElementById('visi-pwd-btn')
    visi2faBtn = document.getElementById('visi-2fa-btn')
    pwdInput = document.getElementById('master-password')
    twoFaInput = document.getElementById('two-fa-input')
    closeIcon = document.querySelector('.close-icon')
    submitBtn = document.querySelector('#submit-btn')
    errorLabel = document.querySelector('#error-label')
    urlInput = document.getElementById('cozy-url')

    // 2- close iframe when it looses focus
    document.addEventListener('blur', ()=>{
        chrome.runtime.sendMessage({
            command   : 'bgAnswerMenuRequest',
            subcommand: 'closeMenu'          ,
            sender    : 'menu.js'            ,
        });
    })

    // prepare i18n
    var i18n = {};
    var lang = window.navigator.language;
    if (typeof safari !== 'undefined') {
        const responseCommand = 'notificationBarFrameDataResponse'; // to be adapted to loginMenu
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
        // retrieve i18n values and set elements textcontent
        lang = chrome.i18n.getUILanguage();
        document.getElementById('title-content').textContent         = chrome.i18n.getMessage('loginInPageMenuTitle')
        document.getElementById('cozy-url-label').textContent        = chrome.i18n.getMessage('cozyUrl'             )
        document.getElementById('master-password-label').textContent = chrome.i18n.getMessage('masterPass'          )
        document.getElementById('2fa-label').textContent             = chrome.i18n.getMessage('verificationCode'    )
        visiPwdBtn.title                                             = chrome.i18n.getMessage('toggleVisibility'    )
        visi2faBtn.title                                             = chrome.i18n.getMessage('toggleVisibility'    )
        submitBtn.textContent                                        = chrome.i18n.getMessage('login'               )
    }

    pwdInput.focus()

    // request to adjust the menu height
    adjustMenuHeight()
    // update the height each time the iframe window is resized
    window.addEventListener('resize', ()=>{
        adjustMenuHeight()
    });

    // 3- listen to the commands and ciphers sent by the addon
    chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
        console.log('XXXXXXXXXXXXXXXXXXXx loginMenu heared msg', msg);
        if (msg.command !== 'updateMenuCiphers' && msg.command !== 'menuAnswerRequest') return

        if (msg.command === 'updateMenuCiphers') {
            ciphers = msg.data
            updateRows()

        } else if (msg.command === 'menuAnswerRequest') {
            switch (msg.subcommand) {
                case 'loginNOK':
                    console.log("loginNOK heard in loginInPageMenu");
                    errorLabel.innerHTML  = chrome.i18n.getMessage('inPageMenuLoginError')
                    _setErrorMode()
                    break;
                case '2faRequested':
                    console.log('2faRequested heard in loginInPageMenu');
                    isIn2FA = true
                    panel.classList.add('twoFa-mode')
                    panel.classList.remove('error')
                    _removeWaitingMode()
                    break;
                case '2faCheckNOK':
                    console.log("2faCheckNOK heard in loginInPageMenu");
                    errorLabel.innerHTML  = chrome.i18n.getMessage('inPageMenuLogin2FACheckError')
                    _setErrorMode()
                    adjustMenuHeight()
                    break;
            }
        }
    })

    // 5- listen to UI events (close, visibility toggle and click to submit)
    closeIcon.addEventListener('click',()=>{
        chrome.runtime.sendMessage({
            command   : 'bgAnswerMenuRequest',
            subcommand: 'closeMenu'          ,
            sender    : 'menu.js'            ,
        });
    })


    visiPwdBtn.addEventListener('click',(e)=>{
        if (isPwdHidden) {
            console.log(1);
            pwdInput.type = 'text'
            visiPwdBtn.firstElementChild.classList.replace('fa-eye','fa-eye-slash')

        } else {
            console.log(2);
            pwdInput.type = 'password'
            visiPwdBtn.firstElementChild.classList.replace('fa-eye-slash','fa-eye')
        }
        isPwdHidden = !isPwdHidden
        pwdInput.focus()
    })


    visi2faBtn.addEventListener('click',(e)=>{
        if (is2faHidden) {
            console.log(1);
            twoFaInput.type = 'text'
            visi2faBtn.firstElementChild.classList.replace('fa-eye','fa-eye-slash')

        } else {
            console.log(2);
            twoFaInput.type = 'password'
            visi2faBtn.firstElementChild.classList.replace('fa-eye-slash','fa-eye')
        }
        is2faHidden = !is2faHidden
        pwdInput.focus()
    })


    submitBtn.addEventListener('click',(e)=>{
        console.log("submitBtn.click()");
        if (isIn2FA) {
            submit2fa()
        } else {
            submit()
        }
    })


    panel.addEventListener('keydown', (event) => {
        if (!event.isTrusted) return;
        const keyName = event.key;
        if (keyName === 'Enter') {
            if (isIn2FA) {
                submit2fa()
            } else {
                submit()
            }
        }
    })

})


function adjustMenuHeight() {
    panel.style.transform = 'scale(1)'
    chrome.runtime.sendMessage({
        command   : 'bgAnswerMenuRequest' ,
        subcommand: 'setMenuHeight'       ,
        height    : panel.offsetHeight    ,
        sender    : 'menu.js'             ,
    });
}


async function submit() {

    // remove possible lognin error message
    _setWaitingMode()

    const loginUrl = sanitizeUrlInput(urlInput.value);


    if (pwdInput.value == null || pwdInput.value === '') {
        // this.platformUtilsService.showToast('error', this.i18nService.t('errorOccurred'),
        //     this.i18nService.t('masterPassRequired'));
        console.log('Mot de passe vide');
        return;
    }

    // This adds the scheme if missing
    // await environmentService.setUrls({
    //     base: loginUrl + '/bitwarden',
    // });

    // The email is based on the URL and necessary for login
    const hostname = Utils.getHostname(loginUrl);
    const email = 'me@' + hostname;

    console.log('about to send message for loging in');
    chrome.runtime.sendMessage({
        command   : 'bgAnswerMenuRequest',
        subcommand: 'login'              ,
        sender    : 'loginMenu.js'       ,
        email     : email                ,
        pwd       : pwdInput.value ,
    });
}


async function submit2fa() {

    _setWaitingMode()

    if (twoFaInput.value == null || twoFaInput.value === '') {
        // this.platformUtilsService.showToast('error', this.i18nService.t('errorOccurred'),
        //     this.i18nService.t('masterPassRequired'));
        console.log('Code 2FA vide');
        return;
    }

    chrome.runtime.sendMessage({
        command   : 'bgAnswerMenuRequest',
        subcommand: '2faCheck'           ,
        sender    : 'loginMenu.js'       ,
        token     : twoFaInput.value     ,
    });
}


function sanitizeUrlInput(inputUrl) {
    // Prevent empty url
    if (!inputUrl) {
        throw new Error('cozyUrlRequired');
    }
    // Prevent email input
    if (inputUrl.includes('@')) {
        throw new Error('noEmailAsCozyUrl');
    }
    // String sanitize
    inputUrl = inputUrl.trim().toLowerCase();

    // Extract protocol
    const regexpProtocol = /^(https?:\/\/)?(www\.)?/;
    const protocolMatches = inputUrl.match(regexpProtocol);
    const protocol = protocolMatches[1] ? protocolMatches[1] : 'https://';
    inputUrl = inputUrl.replace(regexpProtocol, '');
    // Handle url with app slug or with no domain
    const regexpFQDN = /^([a-z0-9]+)(?:-[a-z0-9]+)?(?:\.(.*))?$/;
    const matches = inputUrl.match(regexpFQDN);
    const cozySlug = matches[1];
    const domain = matches[2] ? matches[2] : 'mycozy.cloud';
    return `${protocol}${cozySlug}.${domain}`;
}


function _setErrorMode() {
    panel.classList.remove('waiting')
    panel.classList.add('error')
    urlInput.disabled   = false
    pwdInput.disabled   = false
    twoFaInput.disabled = false
    submitBtn.disabled  = false
    adjustMenuHeight()
}

function _removeWaitingMode() {
    panel.classList.remove('waiting')
    urlInput.disabled   = false
    pwdInput.disabled   = false
    twoFaInput.disabled = false
    submitBtn.disabled  = false
    errorLabel.innerHTML  = ''
    adjustMenuHeight()
}

function _setWaitingMode() {
    panel.classList.add('waiting')
    panel.classList.remove('error')
    urlInput.disabled   = true
    pwdInput.disabled   = true
    twoFaInput.disabled = true
    submitBtn.disabled  = true
    errorLabel.innerHTML  = ''
    adjustMenuHeight()
}
