import { AutofillInlineMenuContentService } from "../overlay/inline-menu/content/autofill-inline-menu-content.service";
import { OverlayNotificationsContentService } from "../overlay/notifications/content/overlay-notifications-content.service";
import { AutofillOverlayContentService } from "../services/autofill-overlay-content.service";
import { DomQueryService } from "../services/dom-query.service";
import { InlineMenuFieldQualificationService } from "../services/inline-menu-field-qualification.service";
import { setupAutofillInitDisconnectAction } from "../utils";

import AutofillInit from "./autofill-init";

(function (windowContext) {
  if (!windowContext.bitwardenAutofillInit) {
    const domQueryService = new DomQueryService();
    const inlineMenuFieldQualificationService = new InlineMenuFieldQualificationService();
    const autofillOverlayContentService = new AutofillOverlayContentService(
      domQueryService,
      inlineMenuFieldQualificationService,
    );

    let inlineMenuElements: AutofillInlineMenuContentService;
    let overlayNotificationsContentService: OverlayNotificationsContentService;
    if (globalThis.self === globalThis.top) {
      inlineMenuElements = new AutofillInlineMenuContentService();
      overlayNotificationsContentService = new OverlayNotificationsContentService();
    }

    windowContext.bitwardenAutofillInit = new AutofillInit(
      domQueryService,
      autofillOverlayContentService,
      inlineMenuElements,
      overlayNotificationsContentService,
    );
    setupAutofillInitDisconnectAction(windowContext);

    windowContext.bitwardenAutofillInit.init();
  }
})(window);
