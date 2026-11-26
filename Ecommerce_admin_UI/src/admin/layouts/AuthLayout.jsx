import { Card, Flex, Space, Typography } from 'antd';
import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { CHROME } from '@theme/tokens';
import { ENV } from '@core/config/env';
import FullPageSpinner from '@ui/components/FullPageSpinner';
import useBreakpoint from '@ui/hooks/useBreakpoint';
import AuthShowcase, { AUTH_CSS, FeatureChips } from '@ui/components/AuthShowcase';

/**
 * Shell for the unauthenticated screens. On wide viewports a brand panel sits
 * beside the form; on phones the form takes the whole screen.
 */
export default function AuthLayout() {
  const { isDesktop } = useBreakpoint();

  return (
    <Flex style={{ minHeight: '100vh' }}>
      <style>{AUTH_CSS}</style>
      {isDesktop && (
        <Flex
          vertical
          justify="space-between"
          style={{
            width: '52%',
            maxWidth: 720,
            padding: 40,
            color: '#fff',
            borderInlineEnd: `1px solid ${CHROME.border}`,
            position: 'relative',
            overflow: 'hidden',
            background: `radial-gradient(900px 520px at 0% 0%, rgba(245,158,11,0.22), transparent 60%), ${CHROME.siderBg}`,
          }}
        >
          <div className="ar-anim" style={{ position: 'absolute', width: 320, height: 320, borderRadius: '50%', left: -80, bottom: 40, background: 'rgba(245,158,11,.14)', filter: 'blur(70px)', animation: 'ar-orb 12s ease-in-out infinite', pointerEvents: 'none' }} />
          <Space size={10} align="center" style={{ position: 'relative' }}>
            <img src="/arise-logo.png" alt="Arise" width={44} height={44} style={{ borderRadius: 11 }} />
            <span className="arise-brand-name">Arise Admin</span>
          </Space>

          <div>
            <Typography.Title level={2} style={{ color: '#fff', marginBottom: 12, fontSize: 32, lineHeight: 1.2 }}>
              Run the whole marketplace from one control room
            </Typography.Title>
            <Typography.Paragraph style={{ color: CHROME.text, fontSize: 15, marginBottom: 20 }}>
              Sellers, catalog, orders, fulfilment, payouts and support, in one place.
            </Typography.Paragraph>
            <FeatureChips />
          </div>

          <AuthShowcase />

          <Typography.Text style={{ color: '#71717A', fontSize: 12 }}>
            Authorised access only. All activity in this panel is logged.
          </Typography.Text>
        </Flex>
      )}

      <Flex flex={1} align="center" justify="center" style={{ padding: 20, backgroundImage: 'radial-gradient(600px 360px at 50% 40%, rgba(245,158,11,0.10), transparent 65%), radial-gradient(rgba(161,161,170,0.16) 1px, transparent 1px)', backgroundSize: 'auto, 22px 22px' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          {!isDesktop && (
            <Flex justify="center" style={{ marginBottom: 20 }}>
              <Space size={10} align="center">
                <img src="/arise-logo.png" alt="Arise" width={40} height={40} style={{ borderRadius: 10 }} />
                <Typography.Text strong style={{ fontSize: 16 }}>
                  Arise Admin
                </Typography.Text>
              </Space>
            </Flex>
          )}

          <Card className="ar-row" style={{ boxShadow: '0 10px 30px rgba(0,0,0,0.08)', borderRadius: 14 }} styles={{ body: { padding: 32 } }}>
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
