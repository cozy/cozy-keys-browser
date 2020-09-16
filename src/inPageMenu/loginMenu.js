require('./loginMenu.scss');

import { AuthService } from 'jslib/abstractions/auth.service';
import { EnvironmentService } from 'jslib/abstractions/environment.service';
import { Utils } from 'jslib/misc/utils';


/* --------------------------------------------------------------------- */
// Globals
// UI elements
var panel               ,
    title               ,
    closeIcon           ,
    visiPwdBtn          ,
    visi2faBtn          ,
    urlInput            ,
    pwdLabel            ,
    pwdInput            ,
    twoFaInput          ,
    errorLabel          ,
    submitBtn           ,
    isPwdHidden = true  ,
    is2faHidden = true  ,
    isIn2FA     = false ,
    isLocked            ,
    isPinLocked

/* --------------------------------------------------------------------- */
// initialization of the login menu
document.addEventListener('DOMContentLoaded', () => {

    // const port = chrome.runtime.connect({name:"port-from-cs"});
    // port.onDisconnect.addListener(function() {
    //     console.log('%%%%%%%%%%% CONNECTION of loginMenu WITH BACKGROUND LOST § § § §');
    // })

    // 0- ask rememberedCozyUrl
    chrome.runtime.sendMessage({
        command   : 'bgAnswerMenuRequest',
        subcommand: 'getRememberedCozyUrl',
        sender    : 'loginMenu.js',
    });

    // 1- get elements references
    panel      = document.querySelector('.panel')
    title      = document.getElementById('title-content')
    urlInput   = document.getElementById('cozy-url')
    pwdInput   = document.getElementById('master-password')
    pwdLabel   = document.getElementById('master-password-label')
    visiPwdBtn = document.getElementById('visi-pwd-btn')
    twoFaInput = document.getElementById('two-fa-input')
    visi2faBtn = document.getElementById('visi-2fa-btn')
    closeIcon  = document.querySelector('.close-icon')
    submitBtn  = document.querySelector('#submit-btn')
    errorLabel = document.querySelector('#error-label')

    // 2- set isLocked & isPinLocked
    isPinLocked = window.location.search.indexOf('isPinLocked=true') === -1 ? false : true

    // 3- close iframe when it looses focus
    document.addEventListener('blur', close);

    // 4- detect when to apply the fadeIn effect
    window.addEventListener('hashchange', _testHash)
    _testHash()

    // 5- prepare i18n and apply
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
        const i18nGetMessage = chrome.i18n.getMessage
        document.getElementById('cozy-url-label').textContent = i18nGetMessage('cozyUrl'             )
        document.getElementById('2fa-label').textContent      = i18nGetMessage('verificationCode'    )
        visiPwdBtn.title                                      = i18nGetMessage('toggleVisibility'    )
        visi2faBtn.title                                      = i18nGetMessage('toggleVisibility'    )
        submitBtn.textContent                                 = i18nGetMessage('login'               )
        if (isPinLocked) {
            title.textContent                                 = i18nGetMessage('unlockWithPin'       )
            pwdLabel.textContent                              = i18nGetMessage('pin'                 )
            pwdInput.placeholder                              = i18nGetMessage('pin'                 )
            urlInput.disabled = true
            document.getElementById('url-row').classList.add('disabled')
        } else {
            title.textContent                                 = i18nGetMessage('loginInPageMenuTitle')
            pwdLabel.textContent                              = i18nGetMessage('masterPass'          )
        }
    }

    // 5- put focus
    urlInput.focus()

    // 6- request to adjust the menu height
    adjustMenuHeight()

    // 7- update the height each time the iframe window is resized
    window.addEventListener('resize', ()=>{
        adjustMenuHeight()
    });

    // 8- listen to the commands sent by the addon
    chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
        // console.log('loginMenu heared msg', msg);
        if (msg.command !== 'menuAnswerRequest') return
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
            case 'setRememberedCozyUrl':
                urlInput.value = msg.rememberedCozyUrl
                pwdInput.focus()
                break;
        }
    })

    // 9- listen to UI events (close, visibility toggle and click to submit)
    closeIcon.addEventListener('click', close)

    visiPwdBtn.addEventListener('click',(e)=>{
        if (isPwdHidden) {
            pwdInput.type = 'text'
            visiPwdBtn.firstElementChild.classList.replace('fa-eye','fa-eye-slash')

        } else {
            pwdInput.type = 'password'
            visiPwdBtn.firstElementChild.classList.replace('fa-eye-slash','fa-eye')
        }
        isPwdHidden = !isPwdHidden
        pwdInput.focus()
    })

    visi2faBtn.addEventListener('click',(e)=>{
        if (is2faHidden) {
            twoFaInput.type = 'text'
            visi2faBtn.firstElementChild.classList.replace('fa-eye','fa-eye-slash')
        } else {
            twoFaInput.type = 'password'
            visi2faBtn.firstElementChild.classList.replace('fa-eye-slash','fa-eye')
        }
        is2faHidden = !is2faHidden
        pwdInput.focus()
    })

    submitBtn.addEventListener('click',(e)=>{
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
        } else if (keyName === 'Escape') {
            close();
        }
    })
})


/* --------------------------------------------------------------------- */
// Ask parent page to adjuste iframe height
// Width is constraint by the parent page, but height is decided by the
// iframe content
function adjustMenuHeight() {
    chrome.runtime.sendMessage({
        command   : 'bgAnswerMenuRequest' ,
        subcommand: 'setMenuHeight'       ,
        height    : panel.offsetHeight    ,
        sender    : 'menu.js'             ,
    });
}


/* --------------------------------------------------------------------- */
// Submit the credentials
async function submit() {
    console.log('loginMenu.submit()');
    // sanitize url
    const loginUrl = sanitizeUrlInput(urlInput.value);
    urlInput.value = loginUrl
    if (pwdInput.value == null || pwdInput.value === '') {
        pwdInput.focus()
        return;  // empty password, nothing to do
    }
    // remove possible lognin error message
    _setWaitingMode()
    // The email is based on the URL and necessary for login
    const hostname = Utils.getHostname(loginUrl);
    const email = 'me@' + hostname;
    // decide if it's a login or pinLogin
    var subcommand = 'login'
    if (isPinLocked) {
        subcommand = 'pinLogin'
    }

    chrome.runtime.sendMessage({
        command   : 'bgAnswerMenuRequest',
        subcommand: subcommand           ,
        sender    : 'loginMenu.js'       ,
        email     : email                ,
        pwd       : pwdInput.value       ,
        loginUrl  : loginUrl             ,
    });
}


/* --------------------------------------------------------------------- */
// Submit 2FA code
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


/* --------------------------------------------------------------------- */
// try to find a valid Cozy URL
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


/* --------------------------------------------------------------------- */
// set the menu content in error mode
function _setErrorMode() {
    panel.classList.remove('waiting')
    panel.classList.add('error')
    urlInput.disabled   = false
    pwdInput.disabled   = false
    twoFaInput.disabled = false
    submitBtn.disabled  = false
    pwdInput.focus()
    adjustMenuHeight()
}


/* --------------------------------------------------------------------- */
// rmeove the menu content from waiting mode
function _removeWaitingMode() {
    panel.classList.remove('waiting')
    urlInput.disabled   = false
    pwdInput.disabled   = false
    twoFaInput.disabled = false
    submitBtn.disabled  = false
    errorLabel.innerHTML  = ''
    adjustMenuHeight()
}


/* --------------------------------------------------------------------- */
// set the menu content in waiting mode
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


/* --------------------------------------------------------------------- */
// Request the iframe content to fadeIn or not
function _testHash(){
    if (window.location.hash === '#applyFadeIn') {
        console.log('loginMenu._testHash() : add fade-in');
        panel.classList.add('fade-in')
        setFocusOnEmptyField()
    } else {
        console.log('loginMenu._testHash() : remove fade-in');
        panel.className = "panel";
    }
}


/* --------------------------------------------------------------------- */
//
function setFocusOnEmptyField(){
    if (urlInput.value) {
        pwdInput.focus()
    } else {
        urlInput.focus()
    }
}


/* --------------------------------------------------------------------- */
// Request the menu controler to close the iframe of the menu
function close() {
    chrome.runtime.sendMessage({
        command   : 'bgAnswerMenuRequest',
        subcommand: 'closeMenu'          ,
        sender    : 'loginMenu.js'       ,
    });
}
