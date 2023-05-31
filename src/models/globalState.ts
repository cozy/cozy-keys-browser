import { GlobalState as BaseGlobalState } from "jslib-common/models/domain/globalState";

export class GlobalState extends BaseGlobalState {
  enableInPageMenu?: boolean;
  disableKonnectorsSuggestions?: boolean;
  enableGPT?: boolean;
}
