import { mapSellerLead, mapSellerLeadStatus } from './seller.mapper';
import { sellerLeadInputSchema } from './seller.schemas';

describe('seller contract', () => {
  test('validates a seller lead before network submission', () => {
    expect(
      sellerLeadInputSchema.parse({
        businessName: 'Arise Demo Store',
        email: 'seller@example.com',
        gstin: '27ABCDE1234F1Z5',
        mobile: '+919876543210',
        pickupPincode: '400001',
        consentVersion: 'seller-lead-v1',
      }),
    ).toBeTruthy();
  });

  test('maps the accepted application receipt', () => {
    expect(
      mapSellerLead({
        data: { id: 'lead-1', status: 'RECEIVED', submittedAt: '2026-11-04T10:00:00.000Z' },
      }),
    ).toMatchObject({ id: 'lead-1', status: 'RECEIVED' });
  });

  test('maps whether this customer already submitted an inquiry', () => {
    expect(mapSellerLeadStatus({ data: null })).toBeNull();
    expect(mapSellerLeadStatus({
      data: { id: 'lead-1', status: 'RECEIVED', submittedAt: '2026-11-04T10:00:00.000Z' },
    })).toMatchObject({ id: 'lead-1', status: 'RECEIVED' });
  });
});
