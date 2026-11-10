import { Card, Flex, Space, Typography } from 'antd';
import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { ENV } from '@core/config/env';
import FullPageSpinner from '@ui/components/FullPageSpinner';
import useBreakpoint from '@ui/hooks/useBreakpoint';
import { CHROME } from '@theme/tokens';
import { SELLER_ACCENT } from '@seller/theme';

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
      {isDesktop && (
        <Flex
          vertical
          justify="space-between"
          style={{
            width: '42%',
            maxWidth: 560,
            padding: 40,
            color: '#fff',
            borderInlineEnd: `1px solid ${CHROME.border}`,
            background: `radial-gradient(900px 520px at 0% 0%, ${SELLER_ACCENT}55, transparent 60%), ${CHROME.siderBg}`,
          }}
        >
          <Space size={10} align="center">
            <div className="arise-brand-mark" aria-hidden style={{ background: SELLER_ACCENT, color: '#fff' }}>
              A
            </div>
            <span className="arise-brand-name">Arise Seller</span>
          </Space>

          <div>
            <Typography.Title level={2} style={{ color: '#fff', marginBottom: 12, fontSize: 28 }}>
              Sell to millions of Arise customers
            </Typography.Title>
            <Typography.Paragraph style={{ color: CHROME.text, fontSize: 15, marginBottom: 0 }}>
              List products, manage orders, track payments and grow — all in one place.
            </Typography.Paragraph>
          </div>

          <Typography.Text style={{ color: '#71717A', fontSize: 12 }}>
            Your seller account, protected. All activity is logged.
          </Typography.Text>
        </Flex>
      )}

      <Flex flex={1} align="center" justify="center" style={{ padding: 20 }}>
        <div style={{ width: '100%', maxWidth: wide ? 760 : 420 }}>
          {!isDesktop && (
            <Flex justify="center" style={{ marginBottom: 20 }}>
              <Space size={10} align="center">
                <div className="arise-brand-mark" aria-hidden style={{ background: SELLER_ACCENT, color: '#fff' }}>
                  A
                </div>
                <Typography.Text strong style={{ fontSize: 16 }}>
                  Arise Seller
                </Typography.Text>
              </Space>
            </Flex>
          )}

          <Card styles={{ body: { padding: 24 } }}>
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
