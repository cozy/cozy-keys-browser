import { GlobalState as BaseGlobalState } from "@bitwarden/common/models/domain/global-state";

export class GlobalState extends BaseGlobalState {
  enableInPageMenu?: boolean;
  disableKonnectorsSuggestions?: boolean;
}
