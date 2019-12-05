import { ConstantsService } from 'jslib/services/constants.service';

export class LocalConstantsService extends ConstantsService {
    static readonly enableKonnectorsSuggestions: string = 'enableKonnectorsSuggestions';
    readonly enableKonnectorsSuggestions: string = LocalConstantsService.enableKonnectorsSuggestions;
}
