import { CipherType } from 'jslib-common/enums/cipherType';
import { CardView } from "jslib-common/models/view";
import { CipherView } from 'jslib-common/models/view/cipherView';
import { CiphersListComponent } from "./ciphers-list.component";

describe('CiphersListComponent', () => {
    describe('getSubtitle', () => {
        describe('when CipherType.Card', () => {
            const ciphersListComponent = new CiphersListComponent();
        
            it(`should return correct subtitle when cipher info is complete`, () => {
                const cipherView = new CipherView();
                cipherView.type = CipherType.Card;
                
                cipherView.card = new CardView();
                cipherView.card.brand = 'Visa';
                cipherView.card.number = '123456789';
                cipherView.card.expMonth = '7';
                cipherView.card.expYear = '2021';

                expect(
                  ciphersListComponent.getSubtitle(cipherView)
                ).toEqual('Visa, *6789, 07/21');
            });

            it(`should handle year with only 2 digits`, () => {
                const cipherView = new CipherView();
                cipherView.type = CipherType.Card;
                
                cipherView.card = new CardView();
                cipherView.card.brand = 'Visa';
                cipherView.card.number = '123456789';
                cipherView.card.expMonth = '7';
                cipherView.card.expYear = '21';

                expect(
                  ciphersListComponent.getSubtitle(cipherView)
                ).toEqual('Visa, *6789, 07/21');
            });

            it(`should show '07/__' in the date part when cipher info is missing year`, () => {
                const cipherView = new CipherView();
                cipherView.type = CipherType.Card;
                
                cipherView.card = new CardView();
                cipherView.card.brand = 'Visa';
                cipherView.card.number = '123456789';
                cipherView.card.expMonth = '7';

                expect(
                  ciphersListComponent.getSubtitle(cipherView)
                ).toEqual('Visa, *6789, 07/__');
            });

            it(`should show '__/21' in the date part when cipher info is missing month`, () => {
                const cipherView = new CipherView();
                cipherView.type = CipherType.Card;
                
                cipherView.card = new CardView();
                cipherView.card.brand = 'Visa';
                cipherView.card.number = '123456789';
                cipherView.card.expMonth = '7';

                expect(
                  ciphersListComponent.getSubtitle(cipherView)
                ).toEqual('Visa, *6789, 07/__');
            });

            it(`should not show the date part when cipher info is missing month and year`, () => {
                const cipherView = new CipherView();
                cipherView.type = CipherType.Card;
                
                cipherView.card = new CardView();
                cipherView.card.brand = 'Visa';
                cipherView.card.number = '123456789';

                expect(
                  ciphersListComponent.getSubtitle(cipherView)
                ).toEqual('Visa, *6789');
            });

            it(`should show '07/__' in the date part when cipher info has bad year format ('ABCD')`, () => {
                const cipherView = new CipherView();
                cipherView.type = CipherType.Card;
                
                cipherView.card = new CardView();
                cipherView.card.brand = 'Visa';
                cipherView.card.number = '123456789';
                cipherView.card.expMonth = '7';
                cipherView.card.expYear = 'ABCD';

                expect(
                  ciphersListComponent.getSubtitle(cipherView)
                ).toEqual('Visa, *6789, 07/__');
            });

            it(`should show '07/__' in the date part when cipher info has bad year format ('021')`, () => {
                const cipherView = new CipherView();
                cipherView.type = CipherType.Card;
                
                cipherView.card = new CardView();
                cipherView.card.brand = 'Visa';
                cipherView.card.number = '123456789';
                cipherView.card.expMonth = '7';
                cipherView.card.expYear = '021';

                expect(
                  ciphersListComponent.getSubtitle(cipherView)
                ).toEqual('Visa, *6789, 07/__');
            });

            it(`should show '07/__' in the date part when cipher info has bad year format ('20211')`, () => {
                const cipherView = new CipherView();
                cipherView.type = CipherType.Card;
                
                cipherView.card = new CardView();
                cipherView.card.brand = 'Visa';
                cipherView.card.number = '123456789';
                cipherView.card.expMonth = '7';
                cipherView.card.expYear = '20211';

                expect(
                  ciphersListComponent.getSubtitle(cipherView)
                ).toEqual('Visa, *6789, 07/__');
            });

            it(`should only show the date part when cipher info is missing card brand and card number`, () => {
                const cipherView = new CipherView();
                cipherView.type = CipherType.Card;
                
                cipherView.card = new CardView();
                cipherView.card.expMonth = '7';
                cipherView.card.expYear = '2021';

                expect(
                  ciphersListComponent.getSubtitle(cipherView)
                ).toEqual('07/21');
            });

            it(`should not show card number if missing`, () => {
                const cipherView = new CipherView();
                cipherView.type = CipherType.Card;
                
                cipherView.card = new CardView();
                cipherView.card.brand = 'Visa';
                cipherView.card.expMonth = '7';
                cipherView.card.expYear = '2021';

                expect(
                  ciphersListComponent.getSubtitle(cipherView)
                ).toEqual('Visa, 07/21');
            });

            it(`should not show card brand if missing`, () => {
                const cipherView = new CipherView();
                cipherView.type = CipherType.Card;
                
                cipherView.card = new CardView();
                cipherView.card.number = '123456789';
                cipherView.card.expMonth = '7';
                cipherView.card.expYear = '2021';

                expect(
                  ciphersListComponent.getSubtitle(cipherView)
                ).toEqual('*6789, 07/21');
            });
        });
    });
});
