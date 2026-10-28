import { ArrowRightOutlined, BulbOutlined } from '@ant-design/icons';
import { Card, Col, Flex, List, Progress, Row, Space, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@core/api/axiosInstance';
import { useCurrentUser } from '@core/rbac/useCan';
import ActivityTimeline from '@ui/components/ActivityTimeline';
import PageHeader from '@ui/components/PageHeader';
import StatCard from '@ui/components/StatCard';
import ErrorState from '@ui/components/ErrorState';
import { dashboardKeys, sellerDashboardApi } from '../api/dashboard.api';

export default function DashboardPage() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: dashboardKeys.summary,
    queryFn: sellerDashboardApi.summary,
  });
  const { data: activity, isLoading: activityLoading } = useQuery({
    queryKey: ['seller', 'dashboard', 'activity'],
    queryFn: () => api.get('/dashboard/activity'),
  });

  if (isError) return <ErrorState error={error} onRetry={refetch} title="Could not load your dashboard" />;

  const kpis = data?.kpis ?? {};
  const health = data?.accountHealth ?? {};

  return (
    <Flex vertical gap={16}>
      <PageHeader
        title={`Welcome, ${user?.storeName ?? 'Seller'}`}
        subtitle="Here's how your store is doing."
        tags={data?.store?.tier && <Tag color="purple">{data.store.tier}</Tag>}
      />

      <Row gutter={[12, 12]}>
        <Col xs={12} md={8} lg={6}>
          <StatCard label="GMV (30 days)" valuePaise={kpis.gmv30dPaise} format="money" loading={isLoading} />
        </Col>
        <Col xs={12} md={8} lg={6}>
          <StatCard label="Orders (30 days)" value={kpis.orders30d} loading={isLoading} />
        </Col>
        <Col xs={12} md={8} lg={6}>
          <StatCard label="Orders to process" value={kpis.ordersToProcess} to="/orders" loading={isLoading} />
        </Col>
        <Col xs={12} md={8} lg={6}>
          <StatCard label="Live listings" value={kpis.liveListings} to="/listings" loading={isLoading} />
        </Col>
        <Col xs={12} md={8} lg={6}>
          <StatCard label="Returns pending" value={kpis.returnsPending} to="/returns" loading={isLoading} />
        </Col>
        <Col xs={12} md={8} lg={6}>
          <StatCard label="Payout due" valuePaise={kpis.payoutDuePaise} format="money" to="/payments" loading={isLoading} />
        </Col>
      </Row>

      <Row gutter={[12, 12]}>
        <Col xs={24} lg={10}>
          <Card title="Account health" loading={isLoading} size="small">
            <Flex align="center" gap={20}>
              <Progress
                type="dashboard"
                percent={health.score ?? 0}
                size={120}
                strokeColor={(health.score ?? 0) >= 80 ? '#26A541' : (health.score ?? 0) >= 60 ? '#FFA41C' : '#FF4D4F'}
              />
              <Space direction="vertical" size={6} style={{ flex: 1 }}>
                <HealthRow label="Cancellation" value={health.cancellationPct} />
                <HealthRow label="Late dispatch" value={health.lateDispatchPct} />
                <HealthRow label="Returns" value={health.returnPct} />
              </Space>
            </Flex>
          </Card>
        </Col>

        <Col xs={24} lg={14}>
          <Card title="Grow your business" size="small" loading={isLoading}>
            <List
              dataSource={data?.tips ?? []}
              renderItem={(tip) => (
                <List.Item
                  actions={[
                    <Typography.Link key="cta" onClick={() => navigate(tip.link)}>
                      {tip.cta} <ArrowRightOutlined />
                    </Typography.Link>,
                  ]}
                >
                  <List.Item.Meta avatar={<BulbOutlined style={{ fontSize: 18, color: 'var(--ant-color-warning)' }} />} title={tip.title} />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Card title="Recent activity" size="small" loading={activityLoading}>
        <ActivityTimeline events={activity?.data ?? []} emptyText="Nothing has happened on your account yet" />
      </Card>
    </Flex>
  );
}

function HealthRow({ label, value }) {
  return (
    <Flex justify="space-between" style={{ width: '100%' }}>
      <Typography.Text type="secondary">{label}</Typography.Text>
      <Typography.Text strong>{(value ?? 0).toFixed(1)}%</Typography.Text>
    </Flex>
  );
}
