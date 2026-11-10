import { Card, Flex, Space, Typography } from 'antd';
import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { CHROME } from '@theme/tokens';
import { ENV } from '@core/config/env';
import FullPageSpinner from '@ui/components/FullPageSpinner';
import useBreakpoint from '@ui/hooks/useBreakpoint';

/**
 * Shell for the unauthenticated screens. On wide viewports a brand panel sits
 * beside the form; on phones the form takes the whole screen.
 */
export default function AuthLayout() {
  const { isDesktop } = useBreakpoint();

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
            background: `radial-gradient(900px 520px at 0% 0%, rgba(245,158,11,0.22), transparent 60%), ${CHROME.siderBg}`,
          }}
        >
          <Space size={10} align="center">
            <div className="arise-brand-mark" aria-hidden style={{ background: CHROME.accent }}>
              A
            </div>
            <span className="arise-brand-name">Arise Admin</span>
          </Space>

          <div>
            <Typography.Title level={2} style={{ color: '#fff', marginBottom: 12, fontSize: 28 }}>
              The control room for the Arise marketplace
            </Typography.Title>
            <Typography.Paragraph style={{ color: CHROME.text, fontSize: 15, marginBottom: 0 }}>
              Sellers, catalog, orders, fulfilment, payouts and support — in one place.
            </Typography.Paragraph>
          </div>

          <Typography.Text style={{ color: '#71717A', fontSize: 12 }}>
            Authorised access only. All activity in this panel is logged.
          </Typography.Text>
        </Flex>
      )}

      <Flex flex={1} align="center" justify="center" style={{ padding: 20 }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          {!isDesktop && (
            <Flex justify="center" style={{ marginBottom: 20 }}>
              <Space size={10} align="center">
                <div className="arise-brand-mark" aria-hidden style={{ background: CHROME.accent }}>
                  A
                </div>
                <Typography.Text strong style={{ fontSize: 16 }}>
                  Arise Admin
                </Typography.Text>
              </Space>
            </Flex>
          )}

          <Card styles={{ body: { padding: 24 } }}>
            <Suspense fallback={<FullPageSpinner label="Loading…" />}>
              <Outlet />
            </Suspense>
          </Card>

          <Typography.Paragraph
            type="secondary"
            style={{ textAlign: 'center', fontSize: 11, marginTop: 14, marginBottom: 0 }}
          >
            {ENV.mode === 'mock'
              ? 'Mock environment — no real customer or seller data.'
              : 'Arise internal tool'}
          </Typography.Paragraph>
        </div>
      </Flex>
    </Flex>
  );
}
