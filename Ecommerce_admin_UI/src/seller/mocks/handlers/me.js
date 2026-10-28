import { http as mswHttp } from 'msw';
import { findById, update } from '@mocks/db/store';
import { scheduleSave } from '@mocks/persistence';
import { ok, unauthorized, validationFailed } from '@mocks/engine/respond';
import { publicUser, resolveCaller } from '@seller/mocks/engine/sellerAuth';
import { SELLER_BASE } from './auth';

export const sellerMeHandlers = [
  mswHttp.get(`${SELLER_BASE}/me`, ({ request }) => {
    const { user, error } = resolveCaller(request);
    if (error) return unauthorized();
    return ok(publicUser(user));
  }),

  mswHttp.post(`${SELLER_BASE}/me/password`, async ({ request }) => {
    const { user, error } = resolveCaller(request);
    if (error) return unauthorized();
    const body = await request.json();
    if (user.password !== body?.currentPassword) {
      return validationFailed({ currentPassword: 'That is not your current password.' });
    }
    if (!body?.newPassword || body.newPassword.length < 8) {
      return validationFailed({ newPassword: 'Use at least 8 characters.' });
    }
    update('sellerUsers', user.id, { password: body.newPassword, mustChangePassword: false });
    scheduleSave();
    return ok(publicUser(findById('sellerUsers', user.id)));
  }),
];
