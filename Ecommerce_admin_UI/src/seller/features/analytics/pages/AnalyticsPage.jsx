import { Alert, Card, Col, Flex, Row, Select, Table, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import DateRangeCompare from '@ui/components/DateRangeCompare';
import ErrorState from '@ui/components/ErrorState';
import MoneyText from '@ui/components/MoneyText';
import PageHeader from '@ui/components/PageHeader';
import StatCard from '@ui/components/StatCard';
import { analyticsApi, analyticsKeys } from '../api/analytics.api';

const TITLES = { overview: 'Analytics overview', products: 'Product analytics', traffic: 'Traffic & advertising', operations: 'Operations analytics', finance: 'Finance analytics' };
const moneyColumn = (title, dataIndex) => ({ title, dataIndex, align: 'right', render: (value) => <MoneyText paise={value} /> });

function Funnel({ rows = [] }) {
  return <Row gutter={[10, 10]}>{rows.map((row, index) => <Col xs={12} md={index === rows.length - 1 ? 24 / Math.min(rows.length, 4) : 6} key={row.key}><StatCard label={row.label} value={row.value} /></Col>)}</Row>;
}

function Trend({ rows = [] }) {
  return <Card title="Customer funnel trend" size="small"><ResponsiveContainer width="100%" height={280}><LineChart data={rows}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" tickFormatter={(value) => value.slice(5)} fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Line dataKey="productViews" name="Product views" stroke="#4F46E5" dot={false} /><Line dataKey="addsToCart" name="Add to cart" stroke="#26A541" dot={false} /></LineChart></ResponsiveContainer><details><summary>View chart data as a table</summary><Table rowKey="date" size="small" pagination={{ pageSize: 10 }} dataSource={rows} columns={[{ title: 'Date', dataIndex: 'date' }, { title: 'Product views', dataIndex: 'productViews', align: 'right' }, { title: 'Added to cart', dataIndex: 'addsToCart', align: 'right' }, { title: 'Checkouts', dataIndex: 'checkouts', align: 'right' }]} /></details></Card>;
}

function Overview({ data }) {
  const k = data.kpis;
  const breakdownTable = (title, rows) => <Col xs={24} lg={8}><Card title={title} size="small"><Table rowKey="label" size="small" pagination={false} dataSource={rows} columns={[{ title: title.slice(0, -1), dataIndex: 'label' }, { title: 'Volume', dataIndex: 'value', align: 'right' }]} /></Card></Col>;
  return <Flex vertical gap={16}><Row gutter={[12, 12]}><Col xs={12} lg={3}><StatCard label="GMV" valuePaise={k.gmvPaise} format="money" deltaPct={data.comparison?.gmvPct} /></Col><Col xs={12} lg={3}><StatCard label="Orders" value={k.orders} deltaPct={data.comparison?.ordersPct} /></Col><Col xs={12} lg={3}><StatCard label="Units" value={k.units} /></Col><Col xs={12} lg={3}><StatCard label="ASP" valuePaise={k.aspPaise} format="money" /></Col><Col xs={12} lg={3}><StatCard label="Discounts" valuePaise={k.discountPaise} format="money" /></Col><Col xs={12} lg={3}><StatCard label="Cancellations" value={k.cancellations} invertDelta /></Col><Col xs={12} lg={3}><StatCard label="Returns" value={k.returns} invertDelta /></Col><Col xs={12} lg={3}><StatCard label="Net earnings" valuePaise={k.netEarningsPaise} format="money" /></Col></Row><Card title="Conversion funnel" size="small"><Funnel rows={data.funnel} /></Card><Trend rows={data.series} /><Row gutter={[16, 16]}>{breakdownTable('Channels', data.breakdowns.channel)}{breakdownTable('Categories', data.breakdowns.category)}{breakdownTable('Geographies', data.breakdowns.geography)}</Row></Flex>;
}

function Products({ data }) {
  return <Table rowKey="id" size="small" scroll={{ x: 'max-content' }} dataSource={data.rows} columns={[{ title: 'Product', dataIndex: 'productTitle', fixed: 'left', width: 260, render: (value, row) => <div><Link to={row.remediationPath}>{value ?? row.sku}</Link><div><Typography.Text type="secondary">{row.sku}</Typography.Text></div></div> }, { title: 'Views', dataIndex: 'productViews', align: 'right' }, { title: 'Orders', dataIndex: 'orders', align: 'right' }, { title: 'Conversion', dataIndex: 'conversionPct', align: 'right', render: (value) => `${value}%` }, moneyColumn('GMV', 'gmvPaise'), moneyColumn('Net earnings', 'netEarningsPaise'), { title: 'Buy box', dataIndex: 'buyBoxSharePct', render: (value) => `${value}%` }, moneyColumn('Lost sales', 'lostSalesPaise'), { title: '', key: 'action', render: (_value, row) => <Link to={row.remediationPath}>Fix listing</Link> }]} />;
}

function Traffic({ data }) {
  return <Flex vertical gap={16}><Alert type="info" showIcon message="Attribution definition" description={data.definitions.attributedRevenue} /><Row gutter={[12, 12]}><Col xs={12} lg={4}><StatCard label="Ad spend" valuePaise={data.ads.spendPaise} format="money" /></Col><Col xs={12} lg={4}><StatCard label="Attributed revenue" valuePaise={data.ads.attributedRevenuePaise} format="money" /></Col><Col xs={12} lg={4}><StatCard label="ROAS" value={data.ads.roas} extra="x" /></Col><Col xs={12} lg={4}><StatCard label="CTR" value={data.ads.ctrPct} format="percent" /></Col><Col xs={12} lg={4}><StatCard label="CPC" valuePaise={data.ads.cpcPaise} format="money" /></Col><Col xs={12} lg={4}><StatCard label="Ad orders" value={data.ads.orders} /></Col></Row><Row gutter={16}><Col xs={24} lg={14}><Trend rows={data.series} /></Col><Col xs={24} lg={10}><Table rowKey="key" size="small" pagination={false} dataSource={data.sources} columns={[{ title: 'Channel', dataIndex: 'label' }, { title: 'Impressions', dataIndex: 'impressions', align: 'right' }, { title: 'Views', dataIndex: 'productViews', align: 'right' }]} /></Col></Row></Flex>;
}

function Operations({ data }) {
  return <Flex vertical gap={16}><Row gutter={[12, 12]}>{[['Dispatch SLA', data.kpis.dispatchSlaPct, 'percent'], ['NDR', data.kpis.ndr], ['RTO', data.kpis.rto], ['Returns', data.kpis.returns]].map(([label, value, format]) => <Col xs={12} md={6} key={label}><StatCard label={label} value={value} format={format} invertDelta={label !== 'Dispatch SLA'} /></Col>)}</Row><Row gutter={16}><Col xs={24} lg={10}><Card title="Return reasons" size="small"><Table rowKey="label" pagination={false} size="small" dataSource={data.returnReasons} columns={[{ title: 'Reason', dataIndex: 'label' }, { title: 'Returns', dataIndex: 'value', align: 'right' }]} /></Card></Col><Col xs={24} lg={14}><Card title="Inventory ageing" size="small"><Table rowKey={(row) => `${row.warehouseId}-${row.sku}`} pagination={false} size="small" dataSource={data.inventoryAgeing} columns={[{ title: 'SKU', dataIndex: 'sku' }, { title: 'Product', dataIndex: 'productTitle' }, { title: 'Available', dataIndex: 'available' }, { title: 'Age (days)', dataIndex: 'ageDays' }]} /></Card></Col></Row></Flex>;
}

function Finance({ data }) {
  const k = data.kpis;
  return <Flex vertical gap={16}><Row gutter={[12, 12]}><Col xs={12} lg={5}><StatCard label="Gross sales" valuePaise={k.grossPaise} format="money" /></Col><Col xs={12} lg={5}><StatCard label="Fees" valuePaise={k.feesPaise} format="money" /></Col><Col xs={12} lg={5}><StatCard label="Tax" valuePaise={k.taxPaise} format="money" /></Col><Col xs={12} lg={4}><StatCard label="Adjustments" valuePaise={k.adjustmentsPaise} format="money" /></Col><Col xs={12} lg={5}><StatCard label="Net earnings" valuePaise={k.netEarningsPaise} format="money" /></Col></Row><Table rowKey="id" size="small" scroll={{ x: 'max-content' }} dataSource={data.rows} columns={[{ title: 'Order item', dataIndex: 'orderItemId' }, moneyColumn('Sale', 'salePaise'), moneyColumn('Fees', 'feesBeforeTaxPaise'), moneyColumn('Net', 'netPaise')]} /></Flex>;
}

export default function AnalyticsPage({ view = 'overview' }) {
  const [filters, setFilters] = useState(() => ({ from: dayjs().subtract(29, 'day').format('YYYY-MM-DD'), to: dayjs().format('YYYY-MM-DD'), compare: true, timezone: 'Asia/Kolkata' }));
  const filterQuery = useQuery({ queryKey: analyticsKeys.filters, queryFn: analyticsApi.filters });
  const params = useMemo(() => Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== '')), [filters]);
  const query = useQuery({ queryKey: analyticsKeys.view(view, params), queryFn: () => analyticsApi.view(view, params) });
  const options = filterQuery.data ?? {};
  const set = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} title="Could not load analytics" />;
  const data = query.data;
  return <Flex vertical gap={16}><PageHeader title={TITLES[view]} breadcrumbs={[{ label: 'Analytics' }, { label: TITLES[view] }]} subtitle={data ? `${data.period.from} to ${data.period.to} · ${data.period.timezone} · Updated ${dayjs(data.freshnessAt).format('DD MMM YYYY, HH:mm')}` : 'One date range across every metric and table.'} /><Card size="small"><Flex gap={8} wrap="wrap" align="center"><DateRangeCompare value={filters} onChange={(value) => setFilters((current) => ({ ...current, ...value, from: value.from.slice(0, 10), to: value.to.slice(0, 10) }))} /><Select value={filters.timezone} onChange={(value) => set('timezone', value)} options={(options.timezones ?? []).map((value) => ({ value, label: value }))} style={{ width: 145 }} /><Select allowClear placeholder="Category" onChange={(value) => set('categoryId', value)} options={options.categories} style={{ width: 150 }} /><Select allowClear placeholder="Brand" onChange={(value) => set('brandId', value)} options={options.brands} style={{ width: 140 }} /><Select allowClear showSearch placeholder="SKU" onChange={(value) => set('sku', value)} options={options.skus} style={{ width: 150 }} /><Select allowClear placeholder="Warehouse" onChange={(value) => set('warehouseId', value)} options={options.warehouses} style={{ width: 160 }} /><Select allowClear placeholder="Fulfilment" onChange={(value) => set('fulfillmentType', value)} options={(options.fulfillmentTypes ?? []).map((value) => ({ value, label: value }))} style={{ width: 135 }} /></Flex></Card>{data && <Alert type="info" showIcon message="Metric definitions" description={Object.values(data.definitions).join(' · ')} />}{query.isLoading || !data ? <Row gutter={[12, 12]}>{Array.from({ length: 4 }, (_, index) => <Col xs={12} md={6} key={index}><StatCard loading /></Col>)}</Row> : view === 'overview' ? <Overview data={data} /> : view === 'products' ? <Products data={data} /> : view === 'traffic' ? <Traffic data={data} /> : view === 'operations' ? <Operations data={data} /> : <Finance data={data} />}</Flex>;
}
