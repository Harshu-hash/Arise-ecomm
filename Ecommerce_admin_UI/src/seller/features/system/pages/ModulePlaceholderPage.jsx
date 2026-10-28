import { CalendarOutlined, FileTextOutlined } from '@ant-design/icons';
import { Alert, Card, Flex, Space, Tag, Typography } from 'antd';
import { useLocation } from 'react-router-dom';
import { CURRENT_PHASE, navItemForPath } from '@seller/nav/navigation';
import PageHeader from '@ui/components/PageHeader';

const PHASE_SCOPE = {
  2: 'Listings — add single & bulk, variants, price & stock, QC status and brand/category requests.',
  3: 'Orders — the process flow (confirm → invoice → label → manifest → dispatch) and cancellations.',
  4: 'Returns, inventory & FBA — returns/replacements, RTO, inventory and sending stock to Arise.',
  5: 'Payments — settlement & payout reports, transaction ledger, invoices, tax and reconciliation.',
  6: 'Growth & ads — deals and flash-sale participation, coupons, and sponsored-product campaigns.',
  7: 'Performance — account health, SLA metrics, ratings, penalties and SPF claims.',
  8: 'Support, reports & settings — tickets, downloadable reports, profile, sub-users and more.',
};

/** Stands in for seller screens that land in a later phase. */
export default function ModulePlaceholderPage() {
  const { pathname } = useLocation();
  const item = navItemForPath(pathname);
  const phase = item?.phase ?? null;

  return (
    <Flex vertical gap={16}>
      <PageHeader
        title={item?.label ?? 'Coming soon'}
        breadcrumbs={item ? [{ label: item.groupLabel ?? 'Arise Seller' }, { label: item.label }] : []}
        tags={phase !== null && <Tag color="geekblue">Phase S{phase}</Tag>}
        subtitle="This screen is planned and scheduled, but not built yet."
      />

      <Card>
        <Space direction="vertical" size={16} style={{ maxWidth: 680 }}>
          <Alert
            type="info"
            showIcon
            icon={<CalendarOutlined />}
            message={`Arriving in phase S${phase}`}
            description={PHASE_SCOPE[phase] ?? 'See the seller panel roadmap for scope and sequencing.'}
          />
          <div>
            <Typography.Title level={5} style={{ marginTop: 0 }}>
              <FileTextOutlined /> Built on the S1 foundation
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              Phase S{CURRENT_PHASE} delivered the shell, authentication, onboarding, permissions and
              the shared mock backend this screen will build on. See{' '}
              <Typography.Text code>docs/SELLER_PANEL_PLAN.md</Typography.Text> in the repository.
            </Typography.Paragraph>
          </div>
          {item?.perm && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Permission that will gate it: <Typography.Text code>{item.perm}</Typography.Text>
            </Typography.Text>
          )}
        </Space>
      </Card>
    </Flex>
  );
}
