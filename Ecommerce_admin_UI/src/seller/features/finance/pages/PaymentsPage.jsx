import { ArrowRightOutlined } from '@ant-design/icons';
import { Alert, Card, Col, Flex, List, Row, Space, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import ErrorState from '@ui/components/ErrorState';
import MoneyText from '@ui/components/MoneyText';
import PageHeader from '@ui/components/PageHeader';
import StatCard from '@ui/components/StatCard';
import { financeApi, financeKeys } from '../api/finance.api';

export default function PaymentsPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: financeKeys.summary, queryFn: financeApi.summary });

  if (isError) return <ErrorState error={error} onRetry={refetch} title="Could not load payments" />;
  const d = data ?? {};

  return (
    <Flex vertical gap={16}>
      <PageHeader title="Payments" breadcrumbs={[{ label: 'Payments' }]} subtitle="What you're owed, what's on hold and what's been paid." />

      <Row gutter={[12, 12]}>
        <Col xs={12} md={6}><StatCard label="Next payout" valuePaise={d.nextPayoutPaise} format="money" loading={isLoading} to="/payments/transactions?tab=UPCOMING" /></Col>
        <Col xs={12} md={6}><StatCard label="In process" valuePaise={d.inProcessPaise} format="money" loading={isLoading} to="/payments/settlements" /></Col>
        <Col xs={12} md={6}><StatCard label="On hold" valuePaise={d.onHoldPaise} format="money" loading={isLoading} to="/payments/transactions?tab=ON_HOLD" /></Col>
        <Col xs={12} md={6}><StatCard label="Paid (lifetime)" valuePaise={d.paidPaise} format="money" loading={isLoading} /></Col>
      </Row>

      {d.failedPaise > 0 && (
        <Alert type="error" showIcon message="A payout failed" description={<>A transfer of <MoneyText paise={d.failedPaise} strong /> bounced. Check your bank details under Settings, then it will retry in the next batch.</>} />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Why some money is on hold" size="small" loading={isLoading} extra={<Typography.Link onClick={() => navigate('/payments/transactions?tab=ON_HOLD')}>View <ArrowRightOutlined /></Typography.Link>}>
            {d.holdReasons?.length ? (
              <List
                dataSource={d.holdReasons}
                renderItem={(h) => (
                  <List.Item>
                    <Typography.Text type="secondary">{h.reason}</Typography.Text>
                    <MoneyText paise={h.paise} strong />
                  </List.Item>
                )}
              />
            ) : (
              <Typography.Text type="secondary">Nothing on hold right now.</Typography.Text>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Lifetime earnings" size="small" loading={isLoading}>
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <LineRow label="Gross sales" paise={d.lifetimeGrossPaise} />
              <LineRow label="Commission" paise={-(d.lifetimeCommissionPaise ?? 0)} deduction />
              <LineRow label="Fees (incl. GST)" paise={-(d.lifetimeFeesPaise ?? 0)} deduction />
              <LineRow label="Taxes (TCS + TDS)" paise={-(d.lifetimeTaxPaise ?? 0)} deduction />
              <div style={{ borderTop: '1px solid var(--ant-color-border-secondary)', paddingTop: 8 }}>
                <LineRow label="Net earned" paise={d.lifetimeNetPaise} strong />
              </div>
            </Space>
          </Card>
        </Col>
      </Row>
    </Flex>
  );
}

function LineRow({ label, paise, deduction, strong }) {
  return (
    <Flex justify="space-between">
      <Typography.Text type={deduction ? 'secondary' : undefined} strong={strong}>{label}</Typography.Text>
      <MoneyText paise={paise} strong={strong} signed={deduction} type={deduction ? 'danger' : undefined} />
    </Flex>
  );
}
