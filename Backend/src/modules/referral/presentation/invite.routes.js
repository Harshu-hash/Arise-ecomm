import { Router } from 'express';
import { formatINR } from '../application/inviteText.js';
import { describeInvite } from '../application/referral.service.js';

export const STORE_URLS = {
  android: 'market://details?id=com.ariseecommerce',
  ios: 'https://apps.apple.com/app/arise-marketplace/id0000000000',
};

const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// The page a shared invite link opens. No script (the server's CSP forbids it): the code is text to read out or copy,
// and the buttons are plain links, one into the app (which pre-fills the code at signup) and one to the store.
function page({ title, body }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>
<style>body{font-family:system-ui,sans-serif;background:#f4f4f6;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center}
main{background:#fff;border-radius:16px;padding:28px;max-width:360px;margin:16px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,.08)}
h1{font-size:20px;margin:0 0 8px}p{color:#555;line-height:1.5}.code{font-size:26px;font-weight:800;letter-spacing:2px;border:2px dashed #5b7fd1;border-radius:10px;padding:12px;margin:16px 0;user-select:all}
a.btn{display:block;padding:14px;border-radius:10px;background:#5b7fd1;color:#fff;text-decoration:none;font-weight:700;margin-top:10px}a.alt{background:#fff;color:#5b7fd1;border:1px solid #5b7fd1}</style></head><body><main>${body}</main></body></html>`;
}

// Mount path: /invite
export function createReferralInviteRouter() {
  const router = Router();
  router.get('/:code', async (req, res, next) => {
    try {
      const invite = /^[A-Za-z0-9]{4,20}$/.test(req.params.code) ? await describeInvite(req.params.code) : null;
      if (!invite) return res.status(404).type('html').send(page({ title: 'Invite not found', body: '<h1>This invite link is not valid</h1><p>Ask your friend to send it again.</p>' }));
      const who = invite.inviter ? `${escapeHtml(invite.inviter)} invited you to Arise` : 'You are invited to Arise';
      const perk = invite.enabled && invite.friendRewardPaise ? `<p>Sign up with this code and get <b>${escapeHtml(formatINR(invite.friendRewardPaise))}</b> in your wallet after your first order${invite.minOrderPaise ? ` of ${escapeHtml(formatINR(invite.minOrderPaise))} or more` : ''}.</p>` : '<p>Enter this code when you sign up.</p>';
      const store = /android/i.test(req.get('user-agent') ?? '') ? STORE_URLS.android : STORE_URLS.ios;
      return res.type('html').send(page({
        title: 'Join Arise',
        body: `<h1>${who}</h1>${perk}<div class="code">${escapeHtml(invite.code)}</div><a class="btn" href="arise://signup?referralCode=${encodeURIComponent(invite.code)}">Open in the Arise app</a><a class="btn alt" href="${escapeHtml(store)}">Get the app</a><p style="font-size:12px">Already installed? Tap Open. Otherwise install it, then enter the code when you sign up.</p>`,
      }));
    } catch (error) {
      return next(error);
    }
  });
  return router;
}
