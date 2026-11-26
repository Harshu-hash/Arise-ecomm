import { Card, Flex, Space, Typography } from 'antd';
import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { ENV } from '@core/config/env';
import FullPageSpinner from '@ui/components/FullPageSpinner';
import useBreakpoint from '@ui/hooks/useBreakpoint';
import { CHROME } from '@theme/tokens';
import { AUTH_CSS, FeatureChips } from '@ui/components/AuthShowcase';
import { SELLER_ACCENT } from '@seller/theme';
import SellerShowcase, { SELLER_CHIPS } from './components/SellerShowcase';

// Class names used by the seller sign-in form.
const SL_CSS = `
.sl-title { margin: 0 0 4px; font-size: 24px; font-weight: 700; }
.sl-sub { opacity: .65; margin-bottom: 24px; }
.sl-primary { height: 46px; font-weight: 600; }
.sl-secondary { height: 44px; }
.sl-forgot { display: block; text-align: center; margin-top: 16px; }
.sl-or { display: flex; align-items: center; gap: 12px; margin: 18px 0 12px; font-size: 12px; opacity: .6; }
.sl-or::before, .sl-or::after { content: ''; flex: 1; border-top: 1px solid currentColor; opacity: .3; }
`;

/**
 * Shell for the seller's unauthenticated screens. On wide viewports a brand
 * panel sits beside the form; on phones the form takes the whole screen.
 * Uses the seller accent so it is visually distinct from the admin sign-in.
 */
export default function SellerAuthLayout() {
  const { isDesktop } = useBreakpoint();
  const location = useLocation();
  const wide = ['/register', '/application-status'].includes(location.pathname);

  return (
    <Flex style={{ minHeight: '100vh' }}>
      <style>{AUTH_CSS + SL_CSS}</style>
      {isDesktop && (
        <Flex
          vertical
          justify="space-between"
          style={{
            width: '52%',
            maxWidth: 720,
            position: 'relative',
            overflow: 'hidden',
            padding: 40,
            color: '#fff',
            borderInlineEnd: `1px solid ${CHROME.border}`,
            background: `radial-gradient(900px 520px at 0% 0%, ${SELLER_ACCENT}55, transparent 60%), ${CHROME.siderBg}`,
          }}
        >
          <div className="ar-anim" style={{ position: 'absolute', width: 320, height: 320, borderRadius: '50%', left: -80, bottom: 40, background: `${SELLER_ACCENT}24`, filter: 'blur(70px)', animation: 'ar-orb 12s ease-in-out infinite', pointerEvents: 'none' }} />
          <Space size={10} align="center" style={{ position: 'relative' }}>
            <img src="/arise-logo.png" alt="Arise" width={44} height={44} style={{ borderRadius: 11 }} />
            <span className="arise-brand-name">Arise Seller</span>
          </Space>

          <div>
            <Typography.Title level={2} style={{ color: '#fff', marginBottom: 12, fontSize: 32, lineHeight: 1.2 }}>
              Grow your store with Arise
            </Typography.Title>
            <Typography.Paragraph style={{ color: CHROME.text, fontSize: 15, marginBottom: 20 }}>
              List products, manage orders, track payments and grow — all in one place.
            </Typography.Paragraph>
            <FeatureChips items={SELLER_CHIPS} />
          </div>

          <SellerShowcase />

          <Typography.Text style={{ color: '#71717A', fontSize: 12 }}>
            Your seller account, protected. All activity is logged.
          </Typography.Text>
        </Flex>
      )}

      <Flex flex={1} align="center" justify="center" style={{ padding: 20, backgroundImage: `radial-gradient(600px 360px at 50% 40%, ${SELLER_ACCENT}1A, transparent 65%), radial-gradient(rgba(161,161,170,0.16) 1px, transparent 1px)`, backgroundSize: 'auto, 22px 22px' }}>
        <div style={{ width: '100%', maxWidth: wide ? 760 : 420 }}>
          {!isDesktop && (
            <Flex justify="center" style={{ marginBottom: 20 }}>
              <Space size={10} align="center">
                <img src="/arise-logo.png" alt="Arise" width={40} height={40} style={{ borderRadius: 11 }} />
                <Typography.Text strong style={{ fontSize: 16 }}>
                  Arise Seller
                </Typography.Text>
              </Space>
            </Flex>
          )}

          <Card className="ar-row" style={{ boxShadow: '0 10px 30px rgba(0,0,0,0.08)', borderRadius: 14 }} styles={{ body: { padding: 32 } }}>
            <Suspense fallback={<FullPageSpinner label="Loading…" />}>
              <Outlet />
            </Suspense>
          </Card>

          <Typography.Paragraph type="secondary" style={{ textAlign: 'center', fontSize: 11, marginTop: 14, marginBottom: 0 }}>
            {ENV.mode === 'mock' ? 'Mock environment — no real data.' : 'Arise Seller Hub'}
          </Typography.Paragraph>
        </div>
      </Flex>
    </Flex>
  );
}
