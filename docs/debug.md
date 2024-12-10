## Debug

### Inline menu

**How to block inline menu disappeareance on blur ?**

Add a `return;` in `checkInlineMenuListFocused` in _autofill-inline-menu-list.ts_.

**How to check why the inline menu opens or not ?**

Play with `isIgnoredField` in _autofill-overlay-content.service.ts_.
