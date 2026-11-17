import { Alert, Card, Col, DatePicker, Flex, Row, Table, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dayjs } from '@core/utils/date';
import { formatINRCompact, formatNumber, formatPercent } from '@core/utils/money';
import { BarListChart, ChartCard, StatTileRow, TrendAreaChart } from '@ui/charts';
import ErrorState from '@ui/components/ErrorState';
import ExportJobButton from '@ui/components/ExportJobButton';
import MoneyText from '@ui/components/MoneyText';
import PageHeader from '@ui/components/PageHeader';
import { analyticsApi, analyticsKeys } from '../../analytics/api/analytics.api';

const SALES_SERIES = [
  { key: 'gmvPaise', label: 'GMV', color: '#2874F0', type: 'area', format: formatINRCompact },
];

export default function SalesReportPage() {
  const navigate = useNavigate();
  const [range, setRange] = useState([dayjs().subtract(29, 'day'), dayjs()]);
  const params = useMemo(() => ({ from: range[0].format('YYYY-MM-DD'), to: range[1].format('YYYY-MM-DD'), compare: 'true' }), [range]);
  const overview = useQuery({ queryKey: analyticsKeys.view('overview', params), queryFn: () => analyticsApi.view('overview', params) });
  const products = useQuery({ queryKey: analyticsKeys.view('products', params), queryFn: () => analyticsApi.view('products', params) });
  const error = overview.error ?? products.error;
  if (error) return <ErrorState error={error} onRetry={() => { overview.refetch(); products.refetch(); }} title="Could not load the sales report" />;
  const data = overview.data;
  const kpis = data?.kpis ?? {};
  const salesOrders = kpis.salesOrders ?? kpis.orders;
  const averageOrderPaise = salesOrders ? Math.round(kpis.gmvPaise / salesOrders) : 0;
  const loading = overview.isLoading || products.isLoading;

  return <Flex vertical gap={16}>
    <PageHeader title="Sales report" breadcrumbs={[{ label: 'Reports' }, { label: 'Sales report' }]} subtitle="Sales, orders, units and earnings for your seller account." actions={<Flex gap={8} wrap><DatePicker.RangePicker allowClear={false} value={range} onChange={(value) => value && setRange(value)} presets={[{ label: 'Last 7 days', value: [dayjs().subtract(6, 'day'), dayjs()] }, { label: 'Last 30 days', value: [dayjs().subtract(29, 'day'), dayjs()] }, { label: 'Last 90 days', value: [dayjs().subtract(89, 'day'), dayjs()] }]} /><ExportJobButton resource="orders" label="Export sales" filters={params} estimatedRows={salesOrders} /></Flex>} />
    <Alert type="info" showIcon message={`Report window: ${params.from} to ${params.to}`} description="GMV excludes cancelled items. Net earnings use settlement lines after commission, fees, taxes and adjustments." />
    <StatTileRow loading={loading} items={[
      { label: 'GMV', valuePaise: kpis.gmvPaise, format: 'money', deltaPct: data?.comparison?.gmvPct },
      { label: 'Orders', value: salesOrders, deltaPct: data?.comparison?.ordersPct },
      { label: 'Units sold', value: kpis.unitsSold ?? kpis.units },
      { label: 'Average order value', valuePaise: averageOrderPaise, format: 'money' },
      { label: 'Net earnings', valuePaise: kpis.netEarningsPaise, format: 'money' },
      { label: 'Returns', value: kpis.returns, invertDelta: true },
      { label: 'Cancellations', value: kpis.cancellations, invertDelta: true },
    ]} />
    <Row gutter={[16, 16]}>
      <Col xs={24} xl={16}><ChartCard title="Daily sales trend" loading={loading} isEmpty={!data?.salesSeries?.length}><TrendAreaChart data={data?.salesSeries ?? []} series={SALES_SERIES} /></ChartCard></Col>
      <Col xs={24} xl={8}><ChartCard title="GMV by category" loading={loading} isEmpty={!data?.salesBreakdowns?.category?.length}><BarListChart colorful data={data?.salesBreakdowns?.category ?? []} format={formatINRCompact} /></ChartCard></Col>
    </Row>
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={12}><ChartCard title="Orders by state" loading={loading} isEmpty={!data?.breakdowns?.geography?.length}><BarListChart data={data?.breakdowns?.geography ?? []} format={formatNumber} /></ChartCard></Col>
      <Col xs={24} lg={12}><Card title="Report definitions" size="small"><Definition label="GMV" value="Item value from non-cancelled orders in the selected period." /><Definition label="Net earnings" value={data?.definitions?.netEarnings} /><Definition label="Product conversion" value={data?.definitions?.conversion} /></Card></Col>
    </Row>
    <ChartCard title="Product sales performance" loading={loading} isEmpty={!products.data?.rows?.length} bodyPadding={0}>
      <Table size="small" rowKey="id" dataSource={products.data?.rows ?? []} scroll={{ x: 960 }} pagination={{ pageSize: 15, hideOnSinglePage: true }} onRow={(row) => ({ onClick: () => navigate(row.remediationPath), style: { cursor: 'pointer' } })} columns={[
        { title: 'Product', dataIndex: 'productTitle', width: 260, ellipsis: true, render: (value, row) => <Flex vertical><Typography.Text strong>{value}</Typography.Text><Typography.Text type="secondary">{row.sku}</Typography.Text></Flex> },
        { title: 'Orders', dataIndex: 'orders', align: 'right', render: (value) => formatNumber(value) },
        { title: 'GMV', dataIndex: 'gmvPaise', align: 'right', render: (value) => <MoneyText paise={value} compact /> },
        { title: 'Net earnings', dataIndex: 'netEarningsPaise', align: 'right', render: (value) => <MoneyText paise={value} compact strong /> },
        { title: 'Conversion', dataIndex: 'conversionPct', align: 'right', render: (value) => formatPercent(value) },
        { title: 'Buy-box share', dataIndex: 'buyBoxSharePct', align: 'right', render: (value) => formatPercent(value, 0) },
        { title: 'Lost sales', dataIndex: 'lostSalesPaise', align: 'right', render: (value) => value ? <MoneyText paise={value} type="danger" compact /> : '—' },
      ]} />
    </ChartCard>
  </Flex>;
}

function Definition({ label, value }) { return <Flex vertical style={{ marginBottom: 12 }}><Typography.Text strong>{label}</Typography.Text><Typography.Text type="secondary">{value}</Typography.Text></Flex>; }
