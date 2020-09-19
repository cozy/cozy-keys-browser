import { createPopper } from '@popperjs/core';

/* =========================================================================

menuCtrler exposes an API to interact with the menus within the pages.

    menuCtrler = {
        hide()
        setHeight(integer in px)
        getCipher(id)
        setCiphers([array of ciphers])
        state : {
                    isMenuInited:false  ,
                    isFrozen:false      ,
                    isActivated:true    ,
                    isHidden:true       ,
                    isAutoFillInited    ,
                    currentMenuType:null,
                    lastFocusedEl       ,
                    _ciphers:[]         ,
                    _selectionRow:0     ,
                    islocked            ,
                    isPinLocked         ,
                },
        unFreeze()
        freeze()
        deactivate()
    }

========================================================================= */

var menuCtrler = {
    addMenuButton          : null,
    hide                   : null,
    setHeight              : null,
    getCipher              : null,
    setCiphers             : null,
    state                  : {
                               isMenuInited:false,
                               isFrozen:false,
                               isActivated:true,
                               isHidden:true,
                               isAutoFillInited:false,
                               currentMenuType:null,
                               lastFocusedEl:null,
                               _ciphers:[],
                               _selectionRow:0,
                               isPinLocked:false,
                             },
    unFreeze               : function() {this.state.isFrozen = false},
    freeze                 : function() {this.state.isFrozen = true },
    deactivate             : null,
    activate               : null,
    displayLoginIPMenu : null,
}

/* --------------------------------------------------------------------- */
// GLOBALS
var menuEl,
    popperInstance,
    targetsEl = [],
    state = menuCtrler.state,
    menuBtnSvg = "url(\"data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20width%3D%2732%27%20height%3D%2732%27%20viewBox%3D%270%200%2032%2032%27%3E%0A%20%20%20%20%20%20%3Cg%20fill%3D%27none%27%20fill-rule%3D%27evenodd%27%3E%0A%20%20%20%20%20%20%20%20%20%20%3Ccircle%20cx%3D%2716%27%20cy%3D%2716%27%20r%3D%2716%27%20fill%3D%27%23297EF1%27%20fill-rule%3D%27nonzero%27%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%3Cpath%20fill%3D%27%23FFF%27%20d%3D%27M19.314%2017.561a.555.555%200%200%201-.82.12%204.044%204.044%200%200%201-2.499.862%204.04%204.04%200%200%201-2.494-.86.557.557%200%200%201-.815-.12.547.547%200%200%201%20.156-.748c.214-.14.229-.421.229-.424a.555.555%200%200%201%20.176-.385.504.504%200%200%201%20.386-.145.544.544%200%200%201%20.528.553c0%20.004%200%20.153-.054.36a2.954%202.954%200%200%200%203.784-.008%201.765%201.765%200%200%201-.053-.344.546.546%200%200%201%20.536-.561h.01c.294%200%20.538.237.545.532%200%200%20.015.282.227.422a.544.544%200%200%201%20.158.746m2.322-6.369a5.94%205.94%200%200%200-1.69-3.506A5.651%205.651%200%200%200%2015.916%206a5.648%205.648%200%200%200-4.029%201.687%205.936%205.936%200%200%200-1.691%203.524%205.677%205.677%200%200%200-3.433%201.737%205.966%205.966%200%200%200-1.643%204.137C5.12%2020.347%207.704%2023%2010.882%2023h10.236c3.176%200%205.762-2.653%205.762-5.915%200-3.083-2.31-5.623-5.244-5.893%27%2F%3E%0A%20%20%20%20%20%20%3C%2Fg%3E%0A%20%20%3C%2Fsvg%3E\")";
    // the string after ";utf8,...')" is just the svg inlined. Done here : https://yoksel.github.io/url-encoder/
    // Might be optimized, see here :
    //    * https://codepen.io/tigt/post/optimizing-svgs-in-data-uris
    //    * https://www.npmjs.com/package/mini-svg-data-uri


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
                el.style.backgroundImage = menuBtnSvg
                el.style.backgroundRepeat = "no-repeat"
                el.style.backgroundAttachment = "scroll"
                el.style.backgroundSize = "16px 18px"
                el.style.backgroundPosition = "calc(100% - 16px) 50%"
                el.style.cursor = "pointer"
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

	if(!state.isMenuInited) { // menu is not yet initiated, there is no ifram elemeent for the menu
        // initIframe()
        menuEl = document.createElement('iframe')
        _setIframeURL(state.currentMenuType, state.isPinLocked )
        menuEl.id  = 'cozy-menu-in-page'
        menuEl.style.cssText = 'z-index: 2147483647 !important; border:0; height:0; transition: transform 30ms linear 0s; display:block;'
        // Append <style> element to add popperjs styles
        // relevant doc for css stylesheet manipulation : https://www.w3.org/wiki/Dynamic_style_-_manipulating_CSS_with_JavaScript
        const styleEl = document.createElement('style')
        styleEl.innerHTML = `
            #cozy-menu-in-page {visibility: hidden; }
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
                {
                    name: 'computeStyles',
                    options: {
                        adaptive: false,
                    },
                },
                sameWidth,
            ],
        });
        // a serie of updates due to some late html modifications
        // usefoull for instance for :  https://accounts.google.com/
        setTimeout(popperInstance.update, 600 )
        setTimeout(popperInstance.update, 1200)
        setTimeout(popperInstance.update, 1800)

        state.isMenuInited = true
    }

    // hide menu if focus leaves the input
    targetEl.addEventListener('blur' , _onBlur)
    // show menu when input receives focus or is clicked (it can be click while it already has focus)
    targetEl.addEventListener('focus', _onFocus)
    targetEl.addEventListener('click', _onClick)
    // listen keystrokes on the input form
    targetEl.addEventListener('keydown', _onKeyDown);

}

function _onBlur(event) {
    if (!event.isTrusted) return;
    console.log('Blur event in an input', event.target.id)
    menuCtrler.hide()
    return true
}

function _onFocus(event) {
    console.log('focus event in an input', event.target.id);
    if (!event.isTrusted) return;
    show(this)
}

function _onClick(event) {
    console.log('click event in an input', event.target.id);
    if (!event.isTrusted) return;
    show(this)
}

function _onKeyDown(event) {
    // console.log('keydown event', event.key, state.isHidden);
    if (!event.isTrusted) return;
    const keyName = event.key;
    if (keyName === 'Escape') {
        // console.log('escape ==> hide');
        menuCtrler.hide(true)
        return;
    } else if (keyName === 'Tab') {
        return;
    } else if (keyName === 'ArrowUp') {
        event.stopPropagation()
        event.preventDefault()
        if (state.isHidden) {
            show(event.target)
        } else {
            menuCtrler.moveSelection(-1)
        }
        return;
    } else if (keyName === 'ArrowDown') {
        event.stopPropagation()
        event.preventDefault()
        if (state.isHidden) {
            show(event.target)
        } else {
            menuCtrler.moveSelection(1)
        }
        return;
    } else if (keyName === 'Enter') {
        if (state.isHidden) return
        event.stopPropagation()
        event.preventDefault()
        menuCtrler.submit()      // else request menu selection validation
        return;
    } else if  (_isCharacterKeyPress(event)){
        // console.log('_isCharacterKeyPress ==> hide');
        menuCtrler.hide(true)
        return;
    }
}


/* --------------------------------------------------------------------- */
//
function show(targetEl) {
    console.log('menuCtrler.show() ');
    if (state.isFrozen) return
    state.lastFocusedEl = targetEl
    popperInstance.state.elements.reference = targetEl
    popperInstance.update()
    menuEl.setAttribute('data-show', '')
    state.isHidden = false
    _setApplyFadeInUrl(true)
}


/* --------------------------------------------------------------------- */
// Init a target element to be able to trigger the menu
// force = false : a shrot time out will wait to check where the focus
//       goes so that to not hide if target is an input or the iframe of
//       the menu.
// force = true : hide the menu without waiting to check the target of the
//       focus.
var n = 0
function hide(force) {
    var internN = n
    n += 1
    console.log('menuCtrler.hide() - Hide_id=', internN, 'force:', !!force, document.activeElement.id);
    if (state.isFrozen) return
    if (force && typeof force == 'boolean') {
        console.log('HIDE!', internN)
        _setApplyFadeInUrl(false)
        // hide menu element after a delay so that the inner pannel has been scaled to 0 and therefore enables
        // a proper start for the next display of the menu.
        // There is an explanation in MDN but their solution didnot work as well as this one :
        // https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Animations/Tips#Run_an_animation_again
        setTimeout(()=>{menuEl.removeAttribute('data-show')}, 50)
        state.isHidden = true
        return
    }
    setTimeout(() => {
        const target = document.activeElement;
        // console.log('after timout, hide with the following', target.id, targetsEl.indexOf(target))
        if (!force && (targetsEl.indexOf(target) != -1 || target.tagName == 'IFRAME' && target.id == 'cozy-menu-in-page')) {
            // Focus is know in iframe or in one of the input => do NOT hide
            // console.log('After hide, focus is now in iframe or in one of the input => do NOT hide', internN);
            return
        }
        // otherwise, hide
        console.log('HIDE!', internN)
        _setApplyFadeInUrl(false)
        // hide menu element after a delay so that the inner pannel has been scaled to 0 and therefore enables
        // a proper start for the next display of the menu.
        // There is an explanation in MDN but their solution didnot work as well as this one :
        // https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Animations/Tips#Run_an_animation_again
        setTimeout(()=>{menuEl.removeAttribute('data-show')}, 50)
        state.isHidden = true
    }, 1);
}
menuCtrler.hide = hide


/* --------------------------------------------------------------------- */
// Hide menu and remove the "buttons" in form inputs
function deactivate() {
    if (!menuEl) return; // can happen
    hide(true)
    removeInPageButtons()
}
menuCtrler.deactivate = deactivate


/* --------------------------------------------------------------------- */
// Remove the "buttons" in form inputs and their listerners
function removeInPageButtons() {
    for (var el of targetsEl) {
        el.style.backgroundImage = ''
        el.removeEventListener('blur' , _onBlur)
        el.removeEventListener('focus', _onFocus)
        el.removeEventListener('click', _onClick)
        el.removeEventListener('keydown', _onKeyDown);
    }
    targetsEl = []
}


/* --------------------------------------------------------------------- */
// Moves selection of +1 or -1  (n=1 || n=-1)
function moveSelection(n) {
    if (state._ciphers.length === 0) return
    state._selectionRow += n
    if (state._selectionRow >= state._ciphers.length) {
        state._selectionRow = 0
    } else if (state._selectionRow < 0 ) {
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
// Submit the currently selected cypher for autofill
function submit() {
    console.log('menuCtrler.submit()');
    chrome.runtime.sendMessage({
        command    : 'bgAnswerMenuRequest',
        subcommand : 'menuSelectionValidate',
        sender     : 'menuCtrler',
    });
}
menuCtrler.submit = submit


/* --------------------------------------------------------------------- */
// Set the height of menuEl (iframe) taking into account the inner margin
function setHeight(h) {
    // console.log('setHeight');
    if (!state.isMenuInited) return // happens if in an iframe without relevant inputs for the menu
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
    state.isAutoFillInited = true
}
menuCtrler.setCiphers = setCiphers


/* --------------------------------------------------------------------- */
//
function setMenuType(menuType, isPinLocked) {
    console.log('setMenuType()', {menuType, isPinLocked});
    if (menuType === state.currentMenuType) {
        _setIframeURL(menuType, isPinLocked)
        _forceIframeRefresh()
        return
    }
    if (menuEl) {
        _setIframeURL(menuType, isPinLocked)
        removeInPageButtons() // remove all "buttons"
        if (menuType === 'autofillMenu' && state.currentMenuType === 'loginMenu' ) {
            if (state.lastFocusedEl) {
                window.setTimeout(()=>{
                    // timeout is required in order to move focus only when iframe url has been setup
                    state.lastFocusedEl.focus()
                },100)
            }
        }
    }
    state.currentMenuType = menuType
    state.isPinLocked = isPinLocked
}
menuCtrler.setMenuType = setMenuType


/* --------------------------------------------------------------------- */
//
function _setIframeURL(menuType, isPinLocked, hash) {
    const rand = '?' + Math.floor((Math.random()*1000000)+1)
    if (menuEl.src) {
        const location = new URL(menuEl.src)
        hash = (hash ? hash : location.hash)
    } else {
        hash = (hash ? hash : '')
    }
    if (menuType === 'autofillMenu') {
        menuEl.src = chrome.runtime.getURL('inPageMenu/menu.html' + rand)  + hash
    } else if (menuType === 'loginMenu') {
        let urlParams = ''
        if (isPinLocked) urlParams = '?isPinLocked=true'
        menuEl.src = chrome.runtime.getURL('inPageMenu/loginMenu.html' + urlParams + rand) + hash
    }
}


/* --------------------------------------------------------------------- */
// just modify the random part of the iframe url in order to force refresh
function _forceIframeRefresh() {
    if (!menuEl.src) return
    const url = new URL(menuEl.src)
    const rand = '?' + Math.floor((Math.random()*1000000)+1)
    menuEl.src = url.origin + url.pathname + url.search + rand + url.hash
}


/* --------------------------------------------------------------------- */
//
function _setApplyFadeInUrl(doApply) {
    if (!menuEl.src) return
    const url = new URL(menuEl.src)
    if (doApply) {
        console.log('menuCtrler.applyFadeIn()');
        menuEl.src = url.origin + url.pathname + url.search + '#applyFadeIn'
    } else {
        console.log('menuCtrler.removeFadeIn()');
        menuEl.src = url.origin + url.pathname + url.search + '#dontApplyFadeIn'
    }
}


/* --------------------------------------------------------------------- */
//
function _isCharacterKeyPress(evt) {
    return evt.key.length === 1;
}


/* --------------------------------------------------------------------- */
//
function _hideMenuEl(isHide){
    if (isHide) {
        menuEl.removeAttribute('data-show')
    } else {
        menuEl.setAttribute('data-show','')
    }
}




/* --------------------------------------------------------------------- */
// EXPORT
export default menuCtrler;
