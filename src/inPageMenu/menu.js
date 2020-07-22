require('./menu.scss');

// Globals
var rowsl,
    ciphers,
    panel



document.addEventListener('DOMContentLoaded', () => {

    // get panel reference
    panel = document.querySelector('.panel')

    // close iframe when it looses focus
    document.addEventListener('blur', ()=>{
        chrome.runtime.sendMessage({
            command   : 'bgAnswerMenuRequest',
            subcommand: 'closeMenu'          ,
            sender    : 'menu.js'            ,
        });
    })

    // listen to the ciphers sent by the addon
    chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
        if (msg.command != 'updateMenuCiphers') return
        ciphers = msg.data
        updateRows()
        // then request to adjust the menu height
        adjustMenuHeight()
        // then update the height each time the iframe window is resized
        window.addEventListener('resize', ()=>{
            adjustMenuHeight()
        });
    })
    // request ciphers to the background scripts
    chrome.runtime.sendMessage({
        command   : 'bgAnswerMenuRequest',
        subcommand: 'getCiphersForTab'   ,
        sender    : 'menu.js'            ,
    });
    // listen to UI events (close and click)
    const closeIcon = document.querySelector('.close-icon')
    closeIcon.addEventListener('click',()=>{
        chrome.runtime.sendMessage({
            command   : 'bgAnswerMenuRequest',
            subcommand: 'closeMenu'          ,
            sender    : 'menu.js'            ,
        });
    })
    const rowsList = document.querySelector('#rows-list')
    rowsList.addEventListener('click',(e)=>{
        const rowEl = e.target.closest('.row-main')
        console.log("click on row", rowEl);
        chrome.runtime.sendMessage({
            command   : 'bgAnswerMenuRequest'  ,
            subcommand: 'fillMenuWithCipher'       ,
            cipherId  : rowEl.dataset.cipherId ,
            sender    : 'menu.js'              ,
        });
    })

})

function updateRows() {
    // 1- generate rows
    const rowsList = document.querySelector('#rows-list')
    ciphers.forEach((cipher, i) => {
        rowsList.appendChild(document.createElement('hr'))
        rowsList.insertAdjacentHTML('beforeend', rowTemplate)
        const row = rowsList.lastElementChild
        const text = row.querySelector('.row-text')
        const detail = row.querySelector('.row-detail')
        text.textContent = cipher.name
        detail.textContent = cipher.login.username
        row.dataset.cipherId = cipher.id
        ciphers.push()
    });
}

const rowTemplate = `
<div class="row-main">
    <div class="row-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
            <path fill-rule="evenodd" d="M8 9C5.79 9 4 6.985 4 4.5S5.79 0 8 0s4 2.015 4 4.5S10.21 9 8 9zm-8 5c0-1 2-4 4-4s1 1 4 1 2-1 4-1 4 3 4 4 0 2-1 2H1c-1 0-1-1-1-2z"/>
        </svg>
    </div>
    <div class="row-main-content">
        <div class="row-text">site description</div>
        <div class="row-detail">account login</div>
    </div>
</div>
`

function adjustMenuHeight() {
    chrome.runtime.sendMessage({
        command   : 'bgAnswerMenuRequest' ,
        subcommand: 'setMenuHeight'       ,
        height    : panel.offsetHeight    ,
        sender    : 'menu.js'             ,
    });
}
