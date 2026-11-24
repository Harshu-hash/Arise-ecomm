import { http as mswHttp } from 'msw';
import { ok, unauthorized } from '@mocks/engine/respond';
import { resolveCaller } from '@seller/mocks/engine/sellerAuth';
import { SELLER_BASE } from './auth';

// Mock of GET /api/seller/v1/support/channels (the live one reads Settings).
export const sellerSupportHandlers = [
  mswHttp.get(`${SELLER_BASE}/support/channels`, ({ request }) => {
    if (resolveCaller(request).error) return unauthorized();
    return ok({
      availabilityLabel: 'Our team is available 09:00 to 21:00.',
      channels: [
        { id: 'phone', type: 'PHONE', label: 'Call us', description: '1800-123-4567', href: 'tel:18001234567', enabled: true },
        { id: 'email', type: 'EMAIL', label: 'Email us', description: 'support@arise.test', href: 'mailto:support@arise.test', enabled: true },
      ],
    });
  }),
];
