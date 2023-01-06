// import { ConstantsService } from "jslib-common/services/constants.service";

// TODO REFACTO : fichier à conserver ?
// export class LocalConstantsService extends ConstantsService {
export class LocalConstantsService {
  static readonly disableKonnectorsSuggestionsKey: string = "disableKonnectorsSuggestions";
  static readonly konnectorSuggestionInterval: number = 5 * 60 * 60 * 1000; // 5 hours
  static readonly konnectorSuggestionLastExecutionKey: string = "konnectorSuggestionLastExecution";
  static readonly enableInPageMenuKey: string = "enableInPageMenu";

  readonly disableKonnectorsSuggestionsStorageKey: string =
    LocalConstantsService.disableKonnectorsSuggestionsKey;
  readonly konnectorSuggestionInterval: number = LocalConstantsService.konnectorSuggestionInterval;
  readonly konnectorSuggestionLastExecutionKey: string =
    LocalConstantsService.konnectorSuggestionLastExecutionKey;
  readonly enableInPageMenuStorageKey: string = LocalConstantsService.enableInPageMenuKey;
}
