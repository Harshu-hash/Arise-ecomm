import { Alert, Button, Card, Col, Descriptions, Flex, Form, InputNumber, Row, Select, Table, Tag, Typography, message } from 'antd';
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import DateText from '@ui/components/DateText';
import ErrorState from '@ui/components/ErrorState';
import MoneyText from '@ui/components/MoneyText';
import PageHeader from '@ui/components/PageHeader';
import { financeApi, financeKeys } from '../api/finance.api';

export default function FeesPage() {
  const [preview, setPreview] = useState(null);
  const query = useQuery({ queryKey: financeKeys.fees, queryFn: financeApi.fees });
  const calculate = useMutation({ mutationFn: financeApi.previewFees, onSuccess: setPreview, onError: (e) => message.error(e?.message ?? 'Could not calculate fees.') });
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />;
  const data = query.data ?? { rules: [], history: [] };
  const categories = [...new Set(data.rules.map((row) => row.rootName))];
  const breakdown = preview && [['Sale amount', preview.salePaise], ['Commission', -preview.commissionPaise], ['Closing fee', -preview.closingFeePaise], ['Collection fee', -preview.collectionFeePaise], ['Shipping fee', -preview.shippingFeePaise], ['Pick & pack', -preview.pickPackFeePaise], ['Storage', -preview.storageFeePaise], ['GST on fees', -preview.gstOnFeesPaise], ['TCS', -preview.tcsPaise], ['TDS', -preview.tdsPaise], ['Net payout', preview.netPaise]];
  return <Flex vertical gap={12}>
    <PageHeader title="Fees & Commission" breadcrumbs={[{ label: 'Payments' }, { label: 'Fees & Commission' }]} subtitle="The effective admin fee rules for your plan, with a calculator that uses the same integer-paise settlement engine." tags={data.plan && <Tag color="blue">{data.plan.name}</Tag>} />
    <Row gutter={[12, 12]}><Col xs={24} lg={13}><Card title="Current commission schedule" loading={query.isLoading}><Table rowKey="id" size="small" pagination={false} dataSource={data.rules} columns={[{ title: 'Category', dataIndex: 'rootName' }, { title: 'Price band', render: (_, r) => <><MoneyText paise={r.minPaise} /> – {r.maxPaise == null ? 'No limit' : <MoneyText paise={r.maxPaise} />}</> }, { title: 'Effective rate', dataIndex: 'effectiveCommissionPct', align: 'right', render: (v) => `${v}%` }]} /></Card></Col>
    <Col xs={24} lg={11}><Card title="Fee calculator"><Form layout="vertical" onFinish={(values) => calculate.mutate({ ...values, salePaise: Math.round(values.saleRupees * 100) })} initialValues={{ rootName: categories[0], saleRupees: 1000, paymentMethod: 'UPI', fulfilledByArise: false, shippingFeePaise: 4200 }}><Form.Item name="rootName" label="Category" rules={[{ required: true }]}><Select options={categories.map((value) => ({ value }))} /></Form.Item><Form.Item name="saleRupees" label="Sale price (₹)" rules={[{ required: true }]}><InputNumber min={1} precision={2} style={{ width: '100%' }} /></Form.Item><Form.Item name="paymentMethod" label="Payment method"><Select options={['UPI', 'CARD', 'COD'].map((value) => ({ value }))} /></Form.Item><Form.Item name="fulfilledByArise" label="Fulfilment"><Select options={[{ value: false, label: 'Seller fulfilled' }, { value: true, label: 'Fulfilled by Arise' }]} /></Form.Item><Button type="primary" htmlType="submit" loading={calculate.isPending}>Calculate exact payout</Button></Form>{preview && <><Alert style={{ marginTop: 12 }} type="info" showIcon message={`Matched ${preview.rule?.band ?? 'default'} commission rule`} /><Descriptions size="small" column={1} bordered style={{ marginTop: 12 }} items={breakdown.map(([label, value], index) => ({ key: label, label, children: <MoneyText paise={value} signed={index > 0 && index < breakdown.length - 1} strong={index === breakdown.length - 1} /> }))} /></>}</Card></Col></Row>
    <Card title="Effective-rate history"><Table rowKey="id" size="small" dataSource={data.history} pagination={{ pageSize: 10 }} columns={[{ title: 'Category', dataIndex: 'rootName' }, { title: 'Band', dataIndex: 'band' }, { title: 'Rate', dataIndex: 'commissionPct', render: (v) => `${v}%` }, { title: 'Effective from', dataIndex: 'effectiveFrom', render: (v) => <DateText value={v} /> }, { title: 'Effective to', dataIndex: 'effectiveTo', render: (v) => v ? <DateText value={v} /> : 'Current' }, { title: 'Status', dataIndex: 'status', render: (v) => <Tag color={v === 'CURRENT' ? 'green' : 'default'}>{v}</Tag> }]} /></Card>
    <Typography.Text type="secondary">All calculations are performed in integer paise; rounding occurs once per fee component and matches the payout engine.</Typography.Text>
  </Flex>;
}
