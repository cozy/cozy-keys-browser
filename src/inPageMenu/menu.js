require('./menu.scss');
import { CipherType } from 'jslib/enums/cipherType.ts';
import { CipherView } from 'jslib/models/view/cipherView.ts';


// Globals
var arrow                      ,
    ciphers                    ,
    currentArrowOffset  = null ,
    currentFieldData           ,
    hostFrameId                ,
    isDisplayed                ,
    i18nGetMessage             ,
    lastSentHeight             ,
    panel                      ,
    resizeListener = null      ,
    titleEl                    ;

const loginRowTemplate = `
<div class="row-main">
    <div class="row-icon icon-login"></div>
    <div class="row-main-content">
        <div class="row-text">site description</div>
        <div class="row-detail">account login</div>
    </div>
</div>
`;
const cardRowTemplate = `
<div class="row-main">
    <div class="row-icon icon-card"></div>
    <div class="row-main-content">
        <div class="row-text">site description</div>
        <div class="row-detail">account login</div>
    </div>
</div>
`;

const idsRowTemplate = `
<div class="row-main">
    <i class="row-icon icon-identity"></i>
    <div class="row-main-content">
        <div class="row-text">site description</div>
        <div class="row-detail">account login</div>
    </div>
</div>
`;


document.addEventListener('DOMContentLoaded', () => {

    // 1- get elements references
    panel = document.querySelector('.panel')
    arrow = document.getElementById('arrow')
    titleEl = document.getElementById('title-content')

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
        i18nGetMessage = chrome.i18n.getMessage
        titleEl.textContent = i18nGetMessage('inPageMenuSelectAnAccount')
    }

    // 3- listen to the commands and ciphers sent by the addon
    chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
        /*
        @override by Cozy : this log is very useful for reverse engineering the code, keep it for tests
        console.log('menu.js HEARD : ', {
            'command': msg.command,
            'subcommand': msg.subcommand,
            'sender': sender.url ? new URL(sender.url).pathname : sender,
            "msg": msg,
            "heard in": document.location.pathname
        });
        */
        if (msg.command !== 'updateMenuCiphers' && msg.command !== 'menuAnswerRequest') return

        if (msg.command === 'updateMenuCiphers') {
            const ciphersData = msg.data.ciphers
            ciphers = {cards: [], identities: [], logins: []}

            ciphersData.cards.forEach( cd => {
                ciphers.cards.push( mapData2CipherView(cd, new CipherView()) )
            });
            ciphersData.identities.forEach( cd => {
                ciphers.identities.push( mapData2CipherView(cd, new CipherView()) )
            });
            ciphersData.logins.forEach( cd => {
                ciphers.logins.push( mapData2CipherView(cd, new CipherView()) )
            });

            document.getElementById('logo-link').href = msg.data.cozyUrl
            updateAllRows()
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
                case 'trigerFillFieldWithData':
                    if (hostFrameId !== msg.frameTargetId || !isDisplayed) return;
                    const dataTxt = document.querySelector('.selected').querySelector('.row-detail').textContent
                    if (!dataTxt) return;
                    requestFieldFillingWithData(dataTxt)
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

    // 5- listen to click on the close menu button
    const closeIcon = document.querySelector('.close-icon')
    closeIcon.addEventListener('click',()=>{
        chrome.runtime.sendMessage({
            command   : 'bgAnswerMenuRequest',
            subcommand: 'closeMenu'          ,
            force     : true                 ,
            sender    : 'menu.js'            ,
        });
    })

    // 6- listen to click on the rows
    document.querySelectorAll('#login-rows-list, #card-rows-list, #ids-rows-list').forEach( list => {
        list.addEventListener('click',(e)=>{
            const rowEl = e.target.closest('.row-main')
            const detailEl = e.target.closest('.row-detail')
            if (detailEl) {
                requestFieldFillingWithData(detailEl.textContent)
            } else {
                requestFormFillingWithCipher(rowEl.dataset.cipherId)
            }
        })
    })

    // 7- detect when to apply the fadeIn effect
    window.addEventListener('hashchange', _testHash)
    _testHash()

})


/* --------------------------------------------------------------------- */
// Request the background to autofill the page with a cipher
function requestFormFillingWithCipher(cipherId) {
    chrome.runtime.sendMessage({
        command   : 'bgAnswerMenuRequest',
        subcommand: 'fillFormWithCipher' ,
        cipherId  : cipherId             ,
        sender    : 'menu.js'            ,
    });
}


/* --------------------------------------------------------------------- */
// Request the background to autofill the page with a cipher
function requestFieldFillingWithData(dataTxt) {
    chrome.runtime.sendMessage({
        command   : 'bgAnswerMenuRequest'  ,
        subcommand: 'fieldFillingWithData' ,
        frameId   : hostFrameId            ,
        data      : dataTxt                ,
        opId      : currentFieldData.opId  ,
        sender    : 'menu.js'              ,
    });
}


/* --------------------------------------------------------------------- */
// Update all rows
function updateAllRows() {
    updateRows('login')
    updateRows('card')
    updateRows('ids')
    selectFirstVisibleRow()
}


/* --------------------------------------------------------------------- */
// Update login rows.
// Existing rows will be deleted
// rowsListType = 'login' or 'card' or 'ids'
function updateRows(rowsListType) {
    let rowsList, rowTemplate, rowsCiphers
    // 1- generate rows
    switch (rowsListType) {
        case 'login':
            if (!ciphers || !ciphers.logins) return
            rowsCiphers = ciphers.logins
            rowsList = document.querySelector('#login-rows-list')
            rowTemplate = loginRowTemplate
            break;
        case 'card':
            if (!ciphers || !ciphers.cards) return
            rowsCiphers = ciphers.cards
            rowsList = document.querySelector('#card-rows-list')
            rowTemplate = cardRowTemplate
            break;
        case 'ids':
            if (!ciphers || !ciphers.identities) return
            rowsCiphers = ciphers.identities
            rowsList = document.querySelector('#ids-rows-list')
            rowTemplate = idsRowTemplate
            break;
    }
    // 2- remove all previous rows
    while (rowsList.firstElementChild) {rowsList.firstElementChild.remove();}
    // 3- add rows
    rowsCiphers.forEach((cipher, i) => {
        rowsList.insertAdjacentHTML('beforeend', rowTemplate)
        const row = rowsList.lastElementChild
        const text = row.querySelector('.row-text')
        const detail = row.querySelector('.row-detail')
        row.dataset.cipherId = cipher.id
        switch (rowsListType) {
            case 'login':
                text.textContent = cipher.name
                row.title = 'fill the whole form with this login (Enter)'
                detail.textContent = cipher.login.username
                detail.title = 'fill only this field with this value (Ctrl+Enter)'
                break;
            case 'card':
                text.textContent = cipher.name
                row.title = 'fill the whole form with this login (Enter)'
                detail.textContent = formatCipherData(cipher.card, currentFieldData.card ,currentFieldData.fieldFormat)
                detail.title = 'fill only this field with this value (Ctrl+Enter)'
                break;
            case 'ids':
                text.textContent = cipher.name
                row.title = 'fill the whole form with this login (Enter)'
                detail.textContent = cipher.identity[currentFieldData.identity]
                detail.title = 'fill only this field with this value (Ctrl+Enter)'
                break;
        }
    });
}


/* --------------------------------------------------------------------- */
//
function formatCipherData(cipherData, key, format) {

    if (!format) return  cipherData[key];

    if (format.type === 'expDate') {
        const fullMonth = ('0' + cipherData.expMonth).slice(-2);
        let fullYear = cipherData.expYear;
        let partYear = null;
        if (fullYear.length === 2) {
            partYear = fullYear;
            fullYear = '20' + fullYear;
        } else if (fullYear.length === 4) {
            partYear = fullYear.substr(2, 2);
        }
        const year = format.isFullYear ? fullYear : partYear
        if (format.isMonthFirst) {
            return fullMonth + format.separator + year;
        } else {
            return  year + format.separator + fullMonth;
        }
    } else {

    }
}


/* --------------------------------------------------------------------- */
// Select the first visible row
function selectFirstVisibleRow() {
    if (!ciphers) return // no received ciphers yet, rows are not ready
    const hash = JSON.parse(decodeURIComponent(window.location.hash).slice(1))
    const currentSelection = document.querySelector('.selected')
    if(currentSelection) currentSelection.classList.remove('selected')
    if (hash['login']) {
        document.querySelector('#login-rows-list').firstElementChild.classList.add('selected')
        return
    }
    if (hash['card']) {
        document.querySelector('#card-rows-list').firstElementChild.classList.add('selected')
        return
    }
    if (hash['identity']) {
        document.querySelector('#ids-rows-list').firstElementChild.classList.add('selected')
        return
    }
}


/* --------------------------------------------------------------------- */
// Ask parent page to adjuste iframe height
// Width is constraint by the parent page, but height is decided by the
// iframe content
function adjustMenuHeight() {
    if (lastSentHeight === panel.offsetHeight) return
    lastSentHeight = panel.offsetHeight
    chrome.runtime.sendMessage({
        command   : 'bgAnswerMenuRequest' ,
        subcommand: 'setMenuHeight'       ,
        height    : lastSentHeight        ,
        sender    : 'menu.js'             ,
    });
}


/* --------------------------------------------------------------------- */
// copy each data property into a CipherView to have setters and getters
function mapData2CipherView(cData, cView) {
    switch (cData.type) {
        case CipherType.Login:
            _mapData2Obj(cData.login, cView.login);
            break;
        case CipherType.SecureNote:
            _mapData2Obj(cData.secureNote, cView.secureNote);
            break;
        case CipherType.Card:
            _mapData2Obj(cData.card, cView.card);
            break;
        case CipherType.Identity:
            _mapData2Obj(cData.identity, cView.identity);
            break;
    }
    const propNotTocopy = ['card', 'login', 'identity', 'secureNote']
    for (var key in cData) {
        if (cData.hasOwnProperty(key) && !propNotTocopy.includes(key)) {
            cView[key] = cData[key]
        }
    }
    return cView
}

function _mapData2Obj(dataObj, obj) {
    for (var key in dataObj) {
        if (dataObj.hasOwnProperty(key)) {
            obj[key] = dataObj[key]
        }
    }
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
// and display rows corresponding to the fieldtypes of the focused field
// content of the hash = {
//    login:"username",
//    identity:"email",
//    card: "",
//    applyFadeIn:[boolean],
//    arrowD:[Float],
// }
function _testHash(){
    let hash = window.location.hash
    if (hash) {
        hash = JSON.parse(decodeURIComponent(hash).slice(1))
        hostFrameId = hash.hostFrameId
    }
    const oldFieldData = currentFieldData
    currentFieldData = hash

    const typesOptions = [
        {
            fieldType:'card',
            title:i18nGetMessage('inPageMenuSelectACard'),
            updateFn: () => updateRows('card'),
            selector:'#card-rows-list',
        },
        {
            fieldType:'identity',
            title:i18nGetMessage('inPageMenuSelectAnIdentity'),
            updateFn: () => updateRows('ids'),
            selector:'#ids-rows-list',
        },
        {
            fieldType:'login',
            title:i18nGetMessage('inPageMenuSelectAnAccount'),
            updateFn: () => updateRows('login'),
            selector:'#login-rows-list',
        },
    ]

    for (let options of typesOptions) {
        const rowsEl = document.querySelector(options.selector)
        const key = options.fieldType
        if (oldFieldData && oldFieldData[key] === hash[key]) continue
        if (hash[key]) {
            titleEl.textContent = options.title
            options.updateFn()
            rowsEl.classList.remove('hidden')
        } else {
            rowsEl.classList.add('hidden')
        }
    }

    if (hash.applyFadeIn) {
        adjustMenuHeight()
        isDisplayed = true
        panel.classList.add('fade-in')
    } else {
        isDisplayed = false
        panel.className = "panel";
    }

    if (hash.arrowD !== undefined && hash.arrowD !== currentArrowOffset ) {
        currentArrowOffset = hash.arrowD
        arrow.style.right = 10 - hash.arrowD + 'px'
    }

    selectFirstVisibleRow()
}
