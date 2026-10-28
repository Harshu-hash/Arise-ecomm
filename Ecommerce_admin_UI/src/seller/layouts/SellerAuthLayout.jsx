import { Card, Flex, Space, Typography } from 'antd';
import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { ENV } from '@core/config/env';
import FullPageSpinner from '@ui/components/FullPageSpinner';
import useBreakpoint from '@ui/hooks/useBreakpoint';
import { SELLER_ACCENT } from '@seller/theme';

/**
 * Shell for the seller's unauthenticated screens. On wide viewports a brand
 * panel sits beside the form; on phones the form takes the whole screen.
 * Uses the seller accent so it is visually distinct from the admin sign-in.
 */
export default function SellerAuthLayout() {
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
            background: `linear-gradient(150deg, ${SELLER_ACCENT}, #7C3AED)`,
          }}
        >
          <Space size={10} align="center">
            <div
              aria-hidden
              style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,0.22)', display: 'grid', placeItems: 'center', fontWeight: 700 }}
            >
              A
            </div>
            <Typography.Text strong style={{ color: '#fff', fontSize: 17 }}>
              Arise Seller
            </Typography.Text>
          </Space>

          <div>
            <Typography.Title level={2} style={{ color: '#fff', marginBottom: 12, fontSize: 28 }}>
              Sell to millions of Arise customers
            </Typography.Title>
            <Typography.Paragraph style={{ color: 'rgba(255,255,255,0.9)', fontSize: 15, marginBottom: 0 }}>
              List products, manage orders, track payments and grow — all in one place.
            </Typography.Paragraph>
          </div>

          <Typography.Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12 }}>
            Your seller account, protected. All activity is logged.
          </Typography.Text>
        </Flex>
      )}

      <Flex flex={1} align="center" justify="center" style={{ padding: 20 }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          {!isDesktop && (
            <Flex justify="center" style={{ marginBottom: 20 }}>
              <Space size={10} align="center">
                <div
                  aria-hidden
                  style={{ width: 28, height: 28, borderRadius: 7, background: `linear-gradient(135deg, ${SELLER_ACCENT}, #7C3AED)`, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700 }}
                >
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
