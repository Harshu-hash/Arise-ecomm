import { Alert, Card, Col, Drawer, Flex, Row, Space, Table, Typography } from 'antd';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import DateText from '@ui/components/DateText';
import ErrorState from '@ui/components/ErrorState';
import FullPageSpinner from '@ui/components/FullPageSpinner';
import MoneyText from '@ui/components/MoneyText';
import PageHeader from '@ui/components/PageHeader';
import StatusTag from '@ui/components/StatusTag';
import SettlementBreakdown from '../components/SettlementBreakdown';
import { financeApi, financeKeys } from '../api/finance.api';

export default function PayoutDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [line, setLine] = useState(null);
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: financeKeys.payoutDetail(id), queryFn: () => financeApi.payoutDetail(id) });

  if (isLoading) return <FullPageSpinner label="Loading payout…" />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;

  const summary = [
    ['Gross sales', data.grossPaise, false],
    ['Fees (incl. GST)', -(data.feesPaise + data.gstOnFeesPaise), true],
    ['TCS', -data.tcsPaise, true],
    ['TDS', -data.tdsPaise, true],
    ...(data.adjustmentsPaise ? [['Adjustments', data.adjustmentsPaise, true]] : []),
  ];

  return (
    <Flex vertical gap={16}>
      <PageHeader
        title={`Payout ${data.id}`}
        breadcrumbs={[{ label: 'Payments' }, { label: 'Settlements', to: '/payments/settlements' }, { label: data.id }]}
        onBack={() => navigate('/payments/settlements')}
        tags={<StatusTag domain="sellerPayout" code={data.status} />}
      />

      {data.status === 'FAILED' && <Alert type="error" showIcon message="This payout failed" description={data.failureReason} />}
      {data.carriedForward && <Alert type="warning" showIcon message="Carried forward" description="Fees and adjustments exceeded sales this period; the shortfall is set against your next payout." />}

      <Row gutter={16}>
        <Col xs={24} lg={9}>
          <Card title="How this payout was calculated" size="small">
            <Space direction="vertical" size={6} style={{ width: '100%' }}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                <DateText value={data.periodStart} /> – <DateText value={data.periodEnd} /> · {data.lineCount} orders
              </Typography.Text>
              {summary.map(([label, paise, deduction]) => (
                <Flex key={label} justify="space-between">
                  <Typography.Text type={deduction ? 'secondary' : undefined}>{label}</Typography.Text>
                  <MoneyText paise={paise} signed={deduction} type={paise < 0 ? 'danger' : undefined} />
                </Flex>
              ))}
              <div style={{ borderTop: '1px solid var(--ant-color-border-secondary)', paddingTop: 8 }}>
                <Flex justify="space-between">
                  <Typography.Text strong>Net {data.status === 'PAID' ? 'paid' : 'payable'}</Typography.Text>
                  <MoneyText paise={data.netPaise} strong type="success" />
                </Flex>
              </div>
              {data.utr && <Typography.Text type="secondary" style={{ fontSize: 12 }}>UTR {data.utr} · a/c ••{data.bankLast4} · <DateText value={data.paidAt} /></Typography.Text>}
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={15}>
          <Card title={`Orders in this payout (${data.lines?.length ?? 0})`} size="small">
            <Table
              rowKey="id"
              scroll={{ x: 'max-content' }}
              size="small"
              pagination={{ pageSize: 10 }}
              onRow={(r) => ({ onClick: () => setLine(r), style: { cursor: 'pointer' } })}
              dataSource={data.lines ?? []}
              columns={[
                { title: 'Order', dataIndex: 'orderId', render: (v, r) => <div><Typography.Text>{v}</Typography.Text><div><Typography.Text type="secondary" style={{ fontSize: 12 }}>{r.productTitle}</Typography.Text></div></div> },
                { title: 'Sale', dataIndex: 'salePaise', align: 'right', width: 110, render: (p) => <MoneyText paise={p} /> },
                { title: 'Net', dataIndex: 'netPaise', align: 'right', width: 110, render: (p) => <MoneyText paise={p} strong type={p < 0 ? 'danger' : undefined} /> },
              ]}
            />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>Tap a row to see every deduction.</Typography.Text>
          </Card>
        </Col>
      </Row>

      <Drawer title={line?.productTitle} open={Boolean(line)} onClose={() => setLine(null)} width={420}>
        {line && <SettlementBreakdown line={line} />}
      </Drawer>
    </Flex>
  );
}
