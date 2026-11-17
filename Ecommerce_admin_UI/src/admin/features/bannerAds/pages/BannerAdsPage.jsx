import { CheckOutlined, CloseOutlined, EditOutlined } from '@ant-design/icons';
import { App, Button, Card, Col, Drawer, Flex, Form, Image, Input, InputNumber, Modal, Row, Space, Switch, Tabs, Typography } from 'antd';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { queryClient } from '@core/api/queryClient';
import { formatINR } from '@core/utils/money';
import DataTable from '@ui/components/DataTable/DataTable';
import DateText from '@ui/components/DateText';
import ErrorState from '@ui/components/ErrorState';
import MoneyText from '@ui/components/MoneyText';
import PageHeader from '@ui/components/PageHeader';
import StatusTag from '@ui/components/StatusTag';
import { bannerAdsApi, bannerAdsKeys } from '../api/bannerAds.api';

export default function BannerAdsPage() {
  const [tab, setTab] = useState('requests');
  return (
    <Flex vertical gap={12}>
      <PageHeader title="Shop banner ads" breadcrumbs={[{ label: 'Marketing' }, { label: 'Shop banner ads' }]} subtitle="Review paid seller creatives and set the daily placement price." />
      <Tabs activeKey={tab} onChange={setTab} items={[
        { key: 'requests', label: 'Seller requests', children: <RequestsTab /> },
        { key: 'pricing', label: 'Placement pricing', children: <PricingTab /> },
      ]} />
    </Flex>
  );
}

function RequestsTab() {
  const { message } = App.useApp();
  const [selected, setSelected] = useState(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const query = useQuery({ queryKey: bannerAdsKeys.requests({}), queryFn: () => bannerAdsApi.requests({ pageSize: 100 }) });
  const decide = useMutation({
    mutationFn: ({ id, decision, rejectionReason }) => bannerAdsApi.decide(id, { decision, reason: rejectionReason }),
    onSuccess: ({ data }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'bannerAds'] });
      setSelected(data); setRejecting(false); setReason(''); message.success(data.status === 'REJECTED' ? 'Rejected and mock payment refunded' : 'Banner approved');
    },
    onError: (error) => message.error(error.message),
  });
  const columns = [
    { key: 'campaignName', title: 'Campaign', dataIndex: 'campaignName', alwaysVisible: true, render: (value, row) => <Flex vertical><Typography.Text strong>{value}</Typography.Text><Typography.Text type="secondary">{row.sellerName}</Typography.Text></Flex> },
    { key: 'schedule', title: 'Schedule', render: (_value, row) => <Typography.Text><DateText value={row.startsOn} variant="date" /> – <DateText value={row.endsOn} variant="date" /></Typography.Text> },
    { key: 'days', title: 'Days', dataIndex: 'days', align: 'right' },
    { key: 'total', title: 'Paid incl. GST', dataIndex: 'totalPaise', align: 'right', render: (value) => <MoneyText paise={value} strong /> },
    { key: 'status', title: 'Status', dataIndex: 'status', render: (value) => <StatusTag domain="bannerAd" code={value} /> },
  ];
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />;
  return <>
    <DataTable tableId="banner-ad-requests" columns={columns} rows={query.data?.data ?? []} meta={query.data?.meta} loading={query.isLoading} onRowClick={setSelected} emptyProps={{ title: 'No seller banner requests' }} />
    <Drawer title={selected?.campaignName} open={Boolean(selected)} onClose={() => setSelected(null)} width={720}>
      {selected && <Flex vertical gap={16}>
        <Row gutter={[12, 12]}>
          <Col span={12}><Creative title="Desktop creative" creative={selected.desktopCreative} /></Col>
          <Col span={12}><Creative title="Mobile creative" creative={selected.mobileCreative} /></Col>
        </Row>
        <Card size="small" title="Booking and payment">
          <Row gutter={[12, 12]}>
            <Col span={12}><LabelValue label="Seller" value={selected.sellerName} /></Col><Col span={12}><LabelValue label="Placement" value={selected.placementName} /></Col>
            <Col span={12}><LabelValue label="Schedule" value={`${selected.startsOn} – ${selected.endsOn} (${selected.days} days)`} /></Col><Col span={12}><LabelValue label="Destination" value={selected.destinationType === 'SHOP' ? 'Seller shop' : 'Product page'} /></Col>
            <Col span={12}><LabelValue label="Daily rate" value={formatINR(selected.dailyRatePaise)} /></Col><Col span={12}><LabelValue label="Total paid" value={formatINR(selected.totalPaise)} /></Col>
            <Col span={12}><LabelValue label="Payment" value={selected.paymentStatus} /></Col><Col span={12}><LabelValue label="Reference" value={selected.paymentReference} /></Col>
          </Row>
        </Card>
        {selected.rejectionReason && <Card size="small" title="Rejection reason"><Typography.Text type="danger">{selected.rejectionReason}</Typography.Text></Card>}
        {selected.status === 'PENDING_REVIEW' && <Space>
          <Button type="primary" icon={<CheckOutlined />} loading={decide.isPending} onClick={() => decide.mutate({ id: selected.id, decision: 'APPROVED' })}>Approve banner</Button>
          <Button danger icon={<CloseOutlined />} onClick={() => setRejecting(true)}>Reject and refund</Button>
        </Space>}
      </Flex>}
    </Drawer>
    <Modal title="Reject banner and refund payment" open={rejecting} onCancel={() => setRejecting(false)} okText="Reject and refund" okButtonProps={{ danger: true, disabled: !reason.trim() }} confirmLoading={decide.isPending} onOk={() => decide.mutate({ id: selected.id, decision: 'REJECTED', rejectionReason: reason })}>
      <Typography.Paragraph type="secondary">The seller will see this reason and the mock payment will be marked refunded.</Typography.Paragraph>
      <Input.TextArea rows={4} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain what must be corrected" />
    </Modal>
  </>;
}

function PricingTab() {
  const { message } = App.useApp();
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const query = useQuery({ queryKey: bannerAdsKeys.placements, queryFn: bannerAdsApi.placements });
  const save = useMutation({
    mutationFn: (values) => bannerAdsApi.updatePlacement(editing.id, { dailyRatePaise: Math.round(values.dailyRateRupees * 100), enabled: values.enabled }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: bannerAdsKeys.placements }); setEditing(null); message.success('Daily price updated'); },
    onError: (error) => message.error(error.message),
  });
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />;
  return <>
    <Row gutter={[16, 16]}>{(query.data?.data ?? []).map((placement) => <Col xs={24} lg={12} key={placement.id}><Card loading={query.isLoading} title={placement.name} extra={<Button icon={<EditOutlined />} onClick={() => { setEditing(placement); form.setFieldsValue({ dailyRateRupees: placement.dailyRatePaise / 100, enabled: placement.enabled }); }}>Edit price</Button>}>
      <Typography.Paragraph type="secondary">{placement.description}</Typography.Paragraph>
      <Flex justify="space-between"><Typography.Text>Daily price</Typography.Text><MoneyText paise={placement.dailyRatePaise} strong /></Flex>
      <Flex justify="space-between"><Typography.Text>Desktop creative</Typography.Text><Typography.Text>{placement.desktopWidth} × {placement.desktopHeight}px</Typography.Text></Flex>
      <Flex justify="space-between"><Typography.Text>Mobile creative</Typography.Text><Typography.Text>{placement.mobileWidth} × {placement.mobileHeight}px</Typography.Text></Flex>
      <Flex justify="space-between"><Typography.Text>Available to sellers</Typography.Text><Typography.Text>{placement.enabled ? 'Yes' : 'No'}</Typography.Text></Flex>
    </Card></Col>)}</Row>
    <Modal title={`Edit ${editing?.name ?? 'placement'}`} open={Boolean(editing)} onCancel={() => setEditing(null)} onOk={() => form.submit()} confirmLoading={save.isPending} okText="Save daily price">
      <Form form={form} layout="vertical" onFinish={save.mutate}>
        <Form.Item name="dailyRateRupees" label="Price per day (₹), before GST" rules={[{ required: true }, { type: 'number', min: 1 }]}><InputNumber min={1} precision={2} style={{ width: '100%' }} /></Form.Item>
        <Form.Item name="enabled" label="Available for new bookings" valuePropName="checked"><Switch /></Form.Item>
      </Form>
    </Modal>
  </>;
}

function Creative({ title, creative }) { return <Card size="small" title={title}><Image src={creative?.previewUrl} alt={title} width="100%" style={{ maxHeight: 220, objectFit: 'cover' }} /><Typography.Text type="secondary">{creative?.fileName}</Typography.Text></Card>; }
function LabelValue({ label, value }) { return <Flex vertical><Typography.Text type="secondary">{label}</Typography.Text><Typography.Text>{value}</Typography.Text></Flex>; }
