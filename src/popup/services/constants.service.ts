import { ConstantsService } from 'jslib/services/constants.service';

export class LocalConstantsService extends ConstantsService {
    static readonly disableKonnectorsSuggestionsKey: string = 'disableKonnectorsSuggestions';
    static readonly konnectorSuggestionInterval: number = 5 * 60 * 60 * 1000; // 5 hours
    static readonly konnectorSuggestionLastExecutionKey: string = 'konnectorSuggestionLastExecution';

    readonly disableKonnectorsSuggestionsStorageKey: string = LocalConstantsService.disableKonnectorsSuggestionsKey;
    readonly konnectorSuggestionInterval: number = LocalConstantsService.konnectorSuggestionInterval;
    readonly konnectorSuggestionLastExecutionKey: string = LocalConstantsService.konnectorSuggestionLastExecutionKey;
}
