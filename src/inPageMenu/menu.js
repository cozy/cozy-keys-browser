require('./menu.scss');

// Globals
var ciphers,
    panel,
    resizeListener = null


document.addEventListener('DOMContentLoaded', () => {

    // 1- get elements references
    panel = document.querySelector('.panel')
    title = document.getElementById('title-content')

    // 2- prepare i18n and apply
    var i18n = {};
    var lang = window.navigator.language;
    if (typeof safari !== 'undefined') { // not implemented for safari for now
        // const responseCommand = 'notificationBarFrameDataResponse';
        // sendPlatformMessage({
        //     command: 'bgGetDataForTab',
        //     responseCommand: responseCommand
        // });
        // safari.self.addEventListener('message', (msgEvent) => {
        //     const msg = JSON.parse(msgEvent.message.msg);
        //     if (msg.command === responseCommand && msg.data) {
        //         i18n = msg.data.i18n;
        //         load();
        //     }
        // }, false);
    } else {
        // retrieve i18n values and set elements textcontent
        lang = chrome.i18n.getUILanguage();
        const i18nGetMessage = chrome.i18n.getMessage
        title.textContent = i18nGetMessage('inPageMenuSelectAnAccount')
    }

    // 3- listen to the commands and ciphers sent by the addon
    chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
        if (msg.command !== 'updateMenuCiphers' && msg.command !== 'menuAnswerRequest') return

        if (msg.command === 'updateMenuCiphers') {
            ciphers = msg.data.ciphers
            document.getElementById('logo-link').href = msg.data.cozyUrl
            updateRows()
            // then request to adjust the menu height
            adjustMenuHeight()
            // then update the height each time the iframe window is resized
            if (!resizeListener) {
                resizeListener = window.addEventListener('resize', ()=>{
                    adjustMenuHeight()
                });
            }

        } else if (msg.command === 'menuAnswerRequest') {
            switch (msg.subcommand) {
                case 'menuSetSelectionOnCipher':
                    setSelectionOnCipher(msg.targetCipher)
                    break;
                case 'menuSelectionValidate':
                    requestFormFillingWithCipher(document.querySelector('.selected').dataset.cipherId)
                    break;
            }
        }
    })

    // 4- request ciphers to the background scripts
    chrome.runtime.sendMessage({
        command   : 'bgAnswerMenuRequest',
        subcommand: 'getCiphersForTab'   ,
        sender    : 'menu.js'            ,
    });

    // 5- listen to UI events (close and click)
    const closeIcon = document.querySelector('.close-icon')
    closeIcon.addEventListener('click',()=>{
        chrome.runtime.sendMessage({
            command   : 'bgAnswerMenuRequest',
            subcommand: 'closeMenu'          ,
            force     : true                 ,
            sender    : 'menu.js'            ,
        });
    })
    const rowsList = document.querySelector('#rows-list')
    rowsList.addEventListener('click',(e)=>{
        const rowEl = e.target.closest('.row-main')
        requestFormFillingWithCipher(rowEl.dataset.cipherId)
    })

    // 4- detect when to apply the fadeIn effect
    window.addEventListener('hashchange', _testHash)
    _testHash()

})


/* --------------------------------------------------------------------- */
// request the background to autofill the page with a cipher
function requestFormFillingWithCipher(cipherId) {
    chrome.runtime.sendMessage({
        command   : 'bgAnswerMenuRequest',
        subcommand: 'fillFormWithCipher' ,
        cipherId  : cipherId             ,
        sender    : 'menu.js'            ,
    });
}


/* --------------------------------------------------------------------- */
// request the background to autofill the page with a cipher
function updateRows() {
    // 1- generate rows
    const rowsList = document.querySelector('#rows-list')
    // 2- remove all previous rows
    while (rowsList.firstElementChild) {rowsList.firstElementChild.remove();}
    // 3- add rows
    ciphers.forEach((cipher, i) => {
        rowsList.insertAdjacentHTML('beforeend', rowTemplate)
        const row = rowsList.lastElementChild
        const text = row.querySelector('.row-text')
        const detail = row.querySelector('.row-detail')
        text.textContent = cipher.name
        detail.textContent = cipher.login.username
        row.dataset.cipherId = cipher.id
        if (i === 0) {
            row.classList.add('selected')
        }
    });
}


const rowTemplate = `
<div class="row-main">
    <div class="row-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
            <g fill="none" fill-rule="evenodd">
                <path fill="#BFC3C7" d="M22 0l.28.004c5.3.146 9.57 4.416 9.716 9.716L32 10l-.004.28c-.146 5.3-4.416 9.57-9.716 9.716L22 20l-.28-.004c-1.206-.033-2.358-.28-3.421-.703L7.179 30.782C6.425 31.56 5.389 32 4.305 32H2c-1.105 0-2-.895-2-2v-3.793c0-.453.18-.887.5-1.207l.047-.047c.295-.295.674-.49 1.085-.558l.888-.148C3.374 24.104 4 23.366 4 22.5V22c0-.552.448-1 1-1h.5c.828 0 1.5-.672 1.5-1.5V19c0-.552.448-1 1-1h.75c.69 0 1.25-.56 1.25-1.25v-.422c0-.53.21-1.039.586-1.414l1.882-1.882C12.164 12.076 12 11.057 12 10c0-5.523 4.477-10 10-10zm.142 4c-.466 0-.933.055-1.389.166-1.465.357-2.005 2.137-1.044 3.251l.105.113 4.656 4.656c1.065 1.065 2.87.61 3.322-.79l.042-.149c.447-1.837-.006-3.848-1.36-5.332l-.19-.199c-1.072-1.072-2.457-1.643-3.861-1.71L22.142 4z"/>
                <path fill="#95999D" d="M15.447 17.554c.542.47 1.136.884 1.77 1.23L4 32H2c-.293 0-.572-.063-.823-.177l14.27-14.27z"/>
            </g>
        </svg>
    </div>
    <div class="row-main-content">
        <div class="row-text">site description</div>
        <div class="row-detail">account login</div>
    </div>
</div>
`

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
// Select the row corresponding to a Cipher ID
function setSelectionOnCipher(targetCipherId) {
    // 1- remove current selection
    document.querySelector('.selected').classList.remove('selected')
    // 2- set new selection
    document.querySelector(`[data-cipher-id="${targetCipherId}"]`).classList.add('selected')
}


/* --------------------------------------------------------------------- */
// Test if iframe content should fadeIn or not
function _testHash(){
    if (window.location.hash === '#applyFadeIn') {
        // console.log('autofillMenu._testHash() : add fade-in');
        panel.classList.add('fade-in')
    } else {
        // console.log('autofillMenu._testHash() : remove fade-in');
        panel.className = "panel";
    }
}
