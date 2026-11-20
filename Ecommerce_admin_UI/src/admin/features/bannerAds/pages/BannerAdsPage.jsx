import { CheckOutlined, CloseOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, Card, Col, Drawer, Empty, Flex, Form, Image, Input, InputNumber, Modal, Row, Select, Space, Switch, Tabs, Tag, Typography } from 'antd';
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
import { catalogApi, catalogKeys } from '@admin/features/catalog/api/catalog.api';
import useRealtime from '@ui/hooks/useRealtime';
import { bannerAdsApi, bannerAdsKeys } from '../api/bannerAds.api';

export default function BannerAdsPage() {
  const [tab, setTab] = useState('requests');
  return (
    <Flex vertical gap={12}>
      <PageHeader title="Shop banner ads" breadcrumbs={[{ label: 'Marketing' }, { label: 'Shop banner ads' }]} subtitle="Create banner slots with their own daily price, and review the paid seller creatives that claim them." />
      <Tabs activeKey={tab} onChange={setTab} items={[
        { key: 'requests', label: 'Seller requests', children: <RequestsTab /> },
        { key: 'slots', label: 'Banner slots & pricing', children: <SlotsTab /> },
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
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', 'bannerAds'] });
  // A seller's payment lands: show the request (and slot booking counts) without a page refresh.
  useRealtime('admin', {
    'banner-ad:request': (request) => { refresh(); message.info(`New banner request: ${request.campaignName}${request.sellerName ? ` from ${request.sellerName}` : ''}`); },
    'session:ready': refresh,
  });
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
    { key: 'placementName', title: 'Slot', dataIndex: 'placementName', render: (value, row) => <Flex vertical><Typography.Text>{value}</Typography.Text><Typography.Text type="secondary">{row.categoryName ? `${row.categoryName} page` : 'For You page'}</Typography.Text></Flex> },
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

const FOR_YOU = 'FOR_YOU'; // the main home page; sent to the API as categoryId: null
const EMPTY_SLOT = { categoryId: FOR_YOU, name: '', description: '', dailyRateRupees: undefined, mobileWidth: 1080, mobileHeight: 1080, enabled: true };
const sizeRule = [{ required: true, message: 'Required' }, { type: 'number', min: 100, max: 4000, message: '100–4000 px' }];

/** Admin-defined banner slots: each has its own daily price, creative sizes and availability. */
function SlotsTab() {
  const { message, modal } = App.useApp();
  const [editing, setEditing] = useState(null); // 'new' | slot
  const [form] = Form.useForm();
  const query = useQuery({ queryKey: bannerAdsKeys.placements, queryFn: bannerAdsApi.placements });
  // The customer app's header tabs are the top-level categories.
  const categories = useQuery({ queryKey: catalogKeys.categoryTree, queryFn: () => catalogApi.categoryTree(), enabled: Boolean(editing) });
  const pageOptions = [{ value: FOR_YOU, label: 'For You (main home page)' }, ...(categories.data?.data ?? []).map((c) => ({ value: c.id, label: `${c.name} page` }))];
  const refresh = () => queryClient.invalidateQueries({ queryKey: bannerAdsKeys.placements });
  const save = useMutation({
    mutationFn: ({ dailyRateRupees, categoryId, ...values }) => {
      const payload = { ...values, categoryId: categoryId === FOR_YOU ? null : categoryId, dailyRatePaise: Math.round(dailyRateRupees * 100) };
      return editing === 'new' ? bannerAdsApi.createPlacement(payload) : bannerAdsApi.updatePlacement(editing.id, payload);
    },
    onSuccess: () => { refresh(); message.success(editing === 'new' ? 'Slot created' : 'Slot updated'); setEditing(null); },
    onError: (error) => {
      if (error.fieldErrors) form.setFields(Object.entries(error.fieldErrors).map(([name, errors]) => ({ name: name === 'dailyRatePaise' ? 'dailyRateRupees' : name, errors: [].concat(errors) })));
      else message.error(error.message);
    },
  });
  const remove = useMutation({
    mutationFn: (slot) => bannerAdsApi.deletePlacement(slot.id),
    onSuccess: () => { refresh(); message.success('Slot deleted'); },
    onError: (error) => message.error(error.message),
  });
  const toggle = useMutation({
    mutationFn: (slot) => bannerAdsApi.updatePlacement(slot.id, { enabled: !slot.enabled }),
    onSuccess: refresh,
    onError: (error) => message.error(error.message),
  });
  const open = (slot) => {
    setEditing(slot);
    form.resetFields();
    form.setFieldsValue(slot === 'new' ? EMPTY_SLOT : { ...slot, categoryId: slot.categoryId ?? FOR_YOU, dailyRateRupees: slot.dailyRatePaise / 100 });
  };
  const confirmDelete = (slot) => modal.confirm({
    title: `Delete "${slot.name}"?`, content: 'This cannot be undone. Slots that already have bookings cannot be deleted; turn them off instead.',
    okText: 'Delete slot', okButtonProps: { danger: true }, onOk: () => remove.mutateAsync(slot).catch(() => undefined),
  });
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />;
  const slots = query.data?.data ?? [];
  return <>
    <Flex justify="space-between" align="center" style={{ marginBottom: 12 }}>
      <Typography.Text type="secondary">Sellers rent a slot by the day. Each slot holds one banner at a time and has its own price.</Typography.Text>
      <Button type="primary" icon={<PlusOutlined />} onClick={() => open('new')}>Create slot</Button>
    </Flex>
    {!query.isLoading && !slots.length && <Empty description="No banner slots yet. Create the first one so sellers can book it." />}
    <Row gutter={[16, 16]}>{slots.map((slot) => <Col xs={24} lg={12} key={slot.id}>
      <Card loading={query.isLoading} title={<Space wrap>{slot.name}<Tag color={slot.enabled ? 'green' : 'default'}>{slot.enabled ? 'Open for booking' : 'Closed'}</Tag><Tag color="blue">{slot.categoryName ? `${slot.categoryName} page` : 'For You page'}</Tag></Space>}
        extra={<Space><Button icon={<EditOutlined />} onClick={() => open(slot)}>Edit</Button><Button danger icon={<DeleteOutlined />} aria-label={`Delete ${slot.name}`} onClick={() => confirmDelete(slot)} /></Space>}>
        <Typography.Paragraph type="secondary">{slot.description || 'No description.'}</Typography.Paragraph>
        <Flex justify="space-between"><Typography.Text>Price per day</Typography.Text><MoneyText paise={slot.dailyRatePaise} strong /></Flex>
        <Flex justify="space-between"><Typography.Text>Mobile banner</Typography.Text><Typography.Text>{slot.mobileWidth} × {slot.mobileHeight}px</Typography.Text></Flex>
        <Flex justify="space-between"><Typography.Text>Bookings (upcoming / all time)</Typography.Text><Typography.Text>{slot.upcomingBookings} / {slot.totalBookings}</Typography.Text></Flex>
        <Flex justify="space-between" align="center" style={{ marginTop: 8 }}><Typography.Text>Available for booking</Typography.Text><Switch checked={slot.enabled} loading={toggle.isPending && toggle.variables?.id === slot.id} onChange={() => toggle.mutate(slot)} /></Flex>
      </Card></Col>)}</Row>
    <Modal title={editing === 'new' ? 'Create banner slot' : `Edit ${editing?.name ?? 'slot'}`} open={Boolean(editing)} onCancel={() => setEditing(null)} onOk={() => form.submit()} confirmLoading={save.isPending} okText={editing === 'new' ? 'Create slot' : 'Save slot'} width={640} destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={save.mutate}>
        <Form.Item name="categoryId" label="Customer app page" extra="The banner carousel of this page shows the banner booked on this slot." rules={[{ required: true, message: 'Choose the page.' }]}><Select loading={categories.isLoading} options={pageOptions} showSearch optionFilterProp="label" /></Form.Item>
        <Form.Item name="name" label="Slot name" rules={[{ required: true, whitespace: true, message: 'Give the slot a name.' }]}><Input maxLength={80} placeholder="e.g. Home page top banner" /></Form.Item>
        <Form.Item name="description" label="Description" extra="Sellers see this when choosing a slot — say where it appears."><Input.TextArea rows={2} maxLength={300} /></Form.Item>
        <Form.Item name="dailyRateRupees" label="Price per day (₹), before GST" extra={editing !== 'new' ? 'A new price applies to future bookings only; paid bookings keep the price they paid.' : undefined} rules={[{ required: true, message: 'Enter a price.' }, { type: 'number', min: 1, message: 'Must be more than zero.' }]}><InputNumber min={1} precision={2} style={{ width: '100%' }} /></Form.Item>
        <Row gutter={12}>
          <Col span={12}><Form.Item name="mobileWidth" label="Banner width" rules={sizeRule}><InputNumber addonAfter="px" style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={12}><Form.Item name="mobileHeight" label="Banner height" rules={sizeRule}><InputNumber addonAfter="px" style={{ width: '100%' }} /></Form.Item></Col>
        </Row>
        <Form.Item name="enabled" label="Available for booking" valuePropName="checked"><Switch /></Form.Item>
      </Form>
    </Modal>
  </>;
}

function Creative({ title, creative }) { return <Card size="small" title={title}><Image src={creative?.previewUrl} alt={title} width="100%" style={{ maxHeight: 220, objectFit: 'cover' }} /><Typography.Text type="secondary">{creative?.fileName}</Typography.Text></Card>; }
function LabelValue({ label, value }) { return <Flex vertical><Typography.Text type="secondary">{label}</Typography.Text><Typography.Text>{value}</Typography.Text></Flex>; }
