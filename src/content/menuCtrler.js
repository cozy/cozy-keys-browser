import { createPopper } from '@popperjs/core';

/* =========================================================================

menuCtrler exposes an API to interact with the menus within the pages.

    menuCtrler = {
        hide()
        setHeight(integer in px)
        getCipher(id)
        setCiphers([array of ciphers])
        state : {
                    islocked:false      ,
                    isHiden:true        ,
                    _ciphers:[]         ,
                    _selectionRow:0     ,
                },
        unlock()
        lock()
    }

========================================================================= */

var menuCtrler = {
    addMenuButton: null,
    hide         : null,
    setHeight    : null,
    getCipher    : null,
    setCiphers   : null,
    state        : {
                     islocked:false,
                     isHiden:true,
                     _ciphers:[],
                     _selectionRow:0,
                 },
    unlock       : function() {this.state.isLocked = false},
    lock         : function() {this.state.isLocked = true },
}

/* --------------------------------------------------------------------- */
// GLOBALS
var menuEl,
    popperInstance,
    targetsEl = [],
    state = menuCtrler.state


/* --------------------------------------------------------------------- */
// Add a menu button to an element and initialize the iframe for the menu
function addMenuButton(el, op, markTheFilling) {

    if (targetsEl.includes(el)) return; // can happen if several fillscripts are requested in autofiller.js

    if (el && null !== op && void 0 !== op && !(el.disabled || el.a || el.readOnly)) {
        switch (markTheFilling && el.form && !el.form.opfilled && (el.form.opfilled = true),
        el.type ? el.type.toLowerCase() : null) {
            case 'checkbox':
                break;
            case 'radio':
                break;
            default:
                el.style.backgroundImage = "url(\"data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20width%3D%2732%27%20height%3D%2732%27%20viewBox%3D%270%200%2032%2032%27%3E%0A%20%20%20%20%20%20%3Cg%20fill%3D%27none%27%20fill-rule%3D%27evenodd%27%3E%0A%20%20%20%20%20%20%20%20%20%20%3Ccircle%20cx%3D%2716%27%20cy%3D%2716%27%20r%3D%2716%27%20fill%3D%27%23297EF1%27%20fill-rule%3D%27nonzero%27%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%3Cpath%20fill%3D%27%23FFF%27%20d%3D%27M19.314%2017.561a.555.555%200%200%201-.82.12%204.044%204.044%200%200%201-2.499.862%204.04%204.04%200%200%201-2.494-.86.557.557%200%200%201-.815-.12.547.547%200%200%201%20.156-.748c.214-.14.229-.421.229-.424a.555.555%200%200%201%20.176-.385.504.504%200%200%201%20.386-.145.544.544%200%200%201%20.528.553c0%20.004%200%20.153-.054.36a2.954%202.954%200%200%200%203.784-.008%201.765%201.765%200%200%201-.053-.344.546.546%200%200%201%20.536-.561h.01c.294%200%20.538.237.545.532%200%200%20.015.282.227.422a.544.544%200%200%201%20.158.746m2.322-6.369a5.94%205.94%200%200%200-1.69-3.506A5.651%205.651%200%200%200%2015.916%206a5.648%205.648%200%200%200-4.029%201.687%205.936%205.936%200%200%200-1.691%203.524%205.677%205.677%200%200%200-3.433%201.737%205.966%205.966%200%200%200-1.643%204.137C5.12%2020.347%207.704%2023%2010.882%2023h10.236c3.176%200%205.762-2.653%205.762-5.915%200-3.083-2.31-5.623-5.244-5.893%27%2F%3E%0A%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%3C%2Fsvg%3E\")";
                // the string after ";utf8,...')" is just the svg inlined. Done here : https://yoksel.github.io/url-encoder/
                // Might be optimized, see here :
                //    * https://codepen.io/tigt/post/optimizing-svgs-in-data-uris
                //    * https://www.npmjs.com/package/mini-svg-data-uri
                el.style.backgroundRepeat = "no-repeat";
                el.style.backgroundAttachment = "scroll";
                el.style.backgroundSize = "16px 18px";
                el.style.backgroundPosition = "calc(100% - 16px) 50%";
                el.style.cursor = "pointer";
                _initInPageMenuForEl(el)
        }
    }
}
menuCtrler.addMenuButton = addMenuButton


/* --------------------------------------------------------------------- */
// Init a target element to be able to trigger the menu
function _initInPageMenuForEl(targetEl) {

    targetsEl.push(targetEl) // register this element as one of the targets for the menu

    // prevent browser autocomplet with history for this field
    targetEl.autocomplete='off'

	if(!menuEl) { // menu is not yet initiated
        menuEl = document.createElement('iframe')
        // menuEl.contentWindow.location = chrome.extension.getURL('inPageMenu/menu.html') // ne fonctionne pas
        menuEl.src = chrome.runtime.getURL('inPageMenu/menu.html')
        menuEl.id  = 'cozy-menu-in-page'
        menuEl.style.cssText = 'z-index: 2147483647 !important; border:0;'
        // Append <style> element to add popperjs styles
        // relevant doc for css stylesheet manipulation : https://www.w3.org/wiki/Dynamic_style_-_manipulating_CSS_with_JavaScript
        const styleEl = document.createElement('style')
        styleEl.innerHTML = `
            #cozy-menu-in-page {visibility: hidden;}
            #cozy-menu-in-page[data-show] {visibility: visible;}
        `;
        document.head.appendChild(styleEl)
        // append element and configure popperjs
        document.body.append(menuEl)
        const sameWidth = {
            name     : "sameWidth",
            enabled  : true,
            phase    : "beforeWrite",
            requires : ["computeStyles"],
            fn       : ({ state }) => { state.styles.popper.width = `${state.rects.reference.width+20}px` },
            effect   : ({ state }) => {
                state.elements.popper.style.width = `${state.elements.reference.offsetWidth+20}px`;
            }
        };
        popperInstance = createPopper(targetEl, menuEl, {
            placement: 'bottom',
            modifiers: [
                {
                    name: 'offset',
                    options: {offset: [0, -5]},
                },
                sameWidth,
            ],
        });
        // a serie of updates due to some late html modifications
        // usefoull for instance for :  https://accounts.google.com/
        setTimeout(popperInstance.update, 600 )
        setTimeout(popperInstance.update, 1200)
        setTimeout(popperInstance.update, 1800)


    }
    // hide menu if focus leaves the input
    targetEl.addEventListener('blur' , (event)=>{
        if (!event.isTrusted) return;
        menuCtrler.hide()
        return true
    })

    function _show() {
        if (state.isLocked) return
        popperInstance.state.elements.reference = targetEl
        popperInstance.update()
        menuEl.setAttribute('data-show', '')
        state.isHiden = false
    }
    // show menu when input receives focus or is clicked (it can be click while if already has focus)
    targetEl.addEventListener('focus', (event)=>{
        if (!event.isTrusted) return;
        _show()
    })
    targetEl.addEventListener('click', (event)=>{
        if (!event.isTrusted) return;
        _show()
    })

    // if targetEl already has focus, then show menu
    if(document.activeElement === targetEl) _show()

    // listen keystrokes on the input form
    targetEl.addEventListener('keydown', (event) => {
        if (!event.isTrusted) return;
        const keyName = event.key;
        if (keyName === 'Escape') {
            menuCtrler.hide(true)
            return;
        } else if (keyName === 'ArrowUp') {
            if (state.isHiden) return
            event.stopPropagation()
            event.preventDefault()
            menuCtrler.moveSelection(-1)
            return;
        } else if (keyName === 'ArrowDown') {
            if (state.isHiden) return
            event.stopPropagation()
            event.preventDefault()
            menuCtrler.moveSelection(1)
            return;
        } else if (keyName === 'Enter') {
            if (state.isHiden) return
            event.stopPropagation()
            event.preventDefault()
            menuCtrler.validate()      // else request menu selection validation
            return false;
        }
    }, false);

}


/* --------------------------------------------------------------------- */
// Init a target element to be able to trigger the menu
function hide(force) {
    if (state.isLocked) return
    if (force && typeof force == 'boolean') {
        menuEl.removeAttribute('data-show')
        state.isHiden = true
        return
    }
    setTimeout(() => {
        var target = document.activeElement;
        if (!force && (targetsEl.indexOf(target) != -1 || target.tagName == 'IFRAME' && target.id == 'cozy-menu-in-page')) {
            // but click in iframe, do NOT hide
            return
        }
        // otherwise, hide
        menuEl.removeAttribute('data-show')
        state.isHiden = true
    }, 1);
}
menuCtrler.hide = hide


/* --------------------------------------------------------------------- */
// Init a target element to be able to trigger the menu
function moveSelection(n) {
    state._selectionRow += n
    if (state._selectionRow === state._ciphers.length) {
        state._selectionRow = 0
    } else if (state._selectionRow === -1 ) {
        state._selectionRow = state._ciphers.length - 1
    }
    chrome.runtime.sendMessage({
        command      : 'bgAnswerMenuRequest',
        subcommand   : 'menuMoveSelection',
        targetCipher : state._ciphers[state._selectionRow].id,
        sender       : 'menuCtrler',
    });
}
menuCtrler.moveSelection = moveSelection


/* --------------------------------------------------------------------- */
// Init a target element to be able to trigger the menu
function validate() {
    chrome.runtime.sendMessage({
        command    : 'bgAnswerMenuRequest',
        subcommand : 'menuSelectionValidate',
        sender     : 'menuCtrler',
    });
}
menuCtrler.validate = validate


/* --------------------------------------------------------------------- */
// set the height of menuEl (iframe) taking into account the inner margin
function setHeight(h) {
    menuEl.style.height = h + 28 + 'px'
}
menuCtrler.setHeight = setHeight


/* --------------------------------------------------------------------- */
// Get a cipher given its id
function getCipher(id) {
    const cipher = state._ciphers.find((cipher)=>{
        return cipher.id == id
    })
    return cipher
}
menuCtrler.getCipher = getCipher


/* --------------------------------------------------------------------- */
// Set the ciphers
function setCiphers(ciphers) {
    state._ciphers = ciphers
    // console.log('ciphers in menuCtrler = ', ciphers);
}
menuCtrler.setCiphers = setCiphers


/* --------------------------------------------------------------------- */
// EXPORT
export default menuCtrler;
