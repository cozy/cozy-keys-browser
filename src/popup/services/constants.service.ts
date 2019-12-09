import { ConstantsService } from 'jslib/services/constants.service';

export class LocalConstantsService extends ConstantsService {
    static readonly disableKonnectorsSuggestions: string = 'disableKonnectorsSuggestions';
    static readonly konnectorSuggestionInterval: number = 5 * 60 * 60 * 1000; // 5 hours
    static readonly konnectorSuggestionLastExecution: string = 'konnectorSuggestionLastExecution';

    readonly disableKonnectorsSuggestions: string = LocalConstantsService.disableKonnectorsSuggestions;
    readonly konnectorSuggestionInterval: number = LocalConstantsService.konnectorSuggestionInterval;
    readonly konnectorSuggestionLastExecution: string = LocalConstantsService.konnectorSuggestionLastExecution;
}
