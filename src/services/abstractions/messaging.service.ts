import { MessagingService as abstractMessagingService } from "jslib-common/abstractions/messaging.service";

import RuntimeBackground from "../../background/runtime.background";

export abstract class MessagingService extends abstractMessagingService {
  setRuntimeBackground: (runtimeBackground: RuntimeBackground) => void;
}
