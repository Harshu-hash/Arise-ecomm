import { StarFilled } from '@ant-design/icons';
import { Alert, Card, Col, Flex, Progress, Rate, Row, Space, Tag, Typography } from 'antd';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import ErrorState from '@ui/components/ErrorState';
import PageHeader from '@ui/components/PageHeader';
import { performanceApi, performanceKeys } from '../api/performance.api';

const TIER_COLOR = { EXCELLENT: '#26A541', GOOD: '#52C41A', AT_RISK: '#FFA41C', CRITICAL: '#FF4D4F' };
const TIER_LABEL = { EXCELLENT: 'Excellent', GOOD: 'Good', AT_RISK: 'At risk', CRITICAL: 'Critical' };
const STATUS_TAG = { GOOD: ['green', 'Good'], WARNING: ['gold', 'Watch'], BAD: ['red', 'Needs action'] };

export default function AccountHealthPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: performanceKeys.health, queryFn: performanceApi.health });
  const { data: trend = [] } = useQuery({ queryKey: performanceKeys.trend, queryFn: performanceApi.trend });
  const { data: ratings } = useQuery({ queryKey: performanceKeys.ratings, queryFn: performanceApi.ratings });

  if (isError) return <ErrorState error={error} onRetry={refetch} title="Could not load account health" />;
  const d = data ?? {};

  return (
    <Flex vertical gap={16}>
      <PageHeader title="Account Health" breadcrumbs={[{ label: 'Performance' }, { label: 'Account Health' }]} subtitle="How Arise scores your account across service quality." />

      {d.tier === 'CRITICAL' && <Alert type="error" showIcon message="Your account is at risk" description="Repeated violations can lead to listing suspension. Resolve the issues below." />}
      {d.tier === 'AT_RISK' && <Alert type="warning" showIcon message="Your account needs attention" description="A few metrics are trending the wrong way — fix them before they affect your visibility." />}

      <Row gutter={16}>
        <Col xs={24} md={8}>
          <Card loading={isLoading} style={{ textAlign: 'center' }}>
            <Progress type="dashboard" percent={d.score ?? 0} size={160} strokeColor={TIER_COLOR[d.tier] ?? '#999'} format={(p) => <span style={{ fontSize: 28, fontWeight: 700 }}>{p}</span>} />
            <div style={{ marginTop: 8 }}>
              <Tag color={TIER_COLOR[d.tier]} style={{ fontSize: 13, padding: '2px 10px' }}>{TIER_LABEL[d.tier] ?? '—'}</Tag>
            </div>
            {d.rating && (
              <div style={{ marginTop: 12 }}>
                <Rate disabled allowHalf value={d.rating} character={<StarFilled />} />
                <div><Typography.Text type="secondary">{d.rating} store rating</Typography.Text></div>
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} md={16}>
          <Card title="What's affecting your score" loading={isLoading} size="small">
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              {(d.metrics ?? []).map((m) => {
                const [color, label] = STATUS_TAG[m.status] ?? ['default', m.status];
                return (
                  <Flex key={m.key} justify="space-between" align="center">
                    <Typography.Text>{m.label}</Typography.Text>
                    <Space>
                      <Typography.Text strong>{m.value}%</Typography.Text>
                      <Tag color={color} style={{ margin: 0 }}>{label}</Tag>
                    </Space>
                  </Flex>
                );
              })}
              <Flex justify="space-between" style={{ paddingTop: 8, borderTop: '1px solid var(--ant-color-border-secondary)' }}>
                <Typography.Text type="secondary">Active penalties</Typography.Text>
                <Typography.Text strong>{d.activePenaltyCount ?? 0}</Typography.Text>
              </Flex>
              <Flex justify="space-between">
                <Typography.Text type="secondary">Open claims</Typography.Text>
                <Typography.Text strong>{d.openClaimCount ?? 0}</Typography.Text>
              </Flex>
            </Space>
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} lg={14}>
          <Card title="Cancellation & late-dispatch trend (8 weeks)" size="small">
            {trend.length ? (
              <ResponsiveContainer width="100%" height={230}>
                <LineChart data={trend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="week" fontSize={11} tickFormatter={(v) => v.slice(5)} />
                  <YAxis fontSize={11} unit="%" />
                  <Tooltip />
                  <Line type="monotone" dataKey="cancellationPct" name="Cancellation %" stroke="#FF4D4F" dot={false} />
                  <Line type="monotone" dataKey="lateDispatchPct" name="Late dispatch %" stroke="#FFA41C" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : <Typography.Text type="secondary">Not enough order history yet.</Typography.Text>}
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card title="Customer ratings" size="small">
            {ratings?.count ? (
              <Space direction="vertical" size={6} style={{ width: '100%' }}>
                <Flex align="center" gap={8}>
                  <Typography.Title level={3} style={{ margin: 0 }}>{ratings.average}</Typography.Title>
                  <Typography.Text type="secondary">({ratings.count} reviews)</Typography.Text>
                </Flex>
                {ratings.distribution.map((row) => (
                  <Flex key={row.star} align="center" gap={8}>
                    <Typography.Text style={{ width: 36 }}>{row.star}★</Typography.Text>
                    <Progress percent={Math.round((row.count / ratings.count) * 100)} showInfo={false} strokeColor="#FFA41C" style={{ flex: 1 }} />
                    <Typography.Text type="secondary" style={{ width: 30, textAlign: 'right' }}>{row.count}</Typography.Text>
                  </Flex>
                ))}
              </Space>
            ) : <Typography.Text type="secondary">No reviews yet.</Typography.Text>}
          </Card>
        </Col>
      </Row>
    </Flex>
  );
}
