import { MessagingService } from "jslib-common/abstractions/messaging.service";

import RuntimeBackground from "../background/runtime.background";

export default class BrowserMessagingPrivateModeBackgroundService implements MessagingService {
  send(subscriber: string, arg: any = {}) {
    const message = Object.assign({}, { command: subscriber }, arg);
    (window as any).bitwardenPopupMainMessageListener(message);
  }
  setRuntimeBackground: (runtimeBackground: RuntimeBackground) => void;
}
