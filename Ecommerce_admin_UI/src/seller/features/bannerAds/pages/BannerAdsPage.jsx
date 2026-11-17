import { PlusOutlined } from '@ant-design/icons';
import { Alert, App, Button, Card, Col, DatePicker, Drawer, Flex, Form, Image, Input, Modal, Radio, Row, Select, Space, Steps, Typography } from 'antd';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { queryClient } from '@core/api/queryClient';
import { bannerAdPrice } from '@core/utils/bannerAds';
import { dayjs } from '@core/utils/date';
import { formatINR } from '@core/utils/money';
import DataTable from '@ui/components/DataTable/DataTable';
import DateText from '@ui/components/DateText';
import ErrorState from '@ui/components/ErrorState';
import MediaWorkflowUpload from '@ui/components/MediaWorkflowUpload';
import MoneyText from '@ui/components/MoneyText';
import PageHeader from '@ui/components/PageHeader';
import StatusTag from '@ui/components/StatusTag';
import { bannerAdsApi, bannerAdsKeys } from '../api/bannerAds.api';

export default function BannerAdsPage() {
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState(null);
  const query = useQuery({ queryKey: bannerAdsKeys.list, queryFn: () => bannerAdsApi.list({ pageSize: 100 }) });
  const columns = [
    { key: 'campaignName', title: 'Campaign', dataIndex: 'campaignName', alwaysVisible: true, render: (value, row) => <Flex vertical><Typography.Text strong>{value}</Typography.Text><Typography.Text type="secondary">{row.placementName}</Typography.Text></Flex> },
    { key: 'schedule', title: 'Schedule', render: (_value, row) => <Typography.Text><DateText value={row.startsOn} variant="date" /> – <DateText value={row.endsOn} variant="date" /></Typography.Text> },
    { key: 'paid', title: 'Paid incl. GST', dataIndex: 'totalPaise', align: 'right', render: (value) => <MoneyText paise={value} strong /> },
    { key: 'status', title: 'Status', dataIndex: 'status', render: (value) => <StatusTag domain="bannerAd" code={value} /> },
  ];
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} title="Could not load banner ads" />;
  return <Flex vertical gap={12}>
    <PageHeader title="Shop banner ads" breadcrumbs={[{ label: 'Growth' }, { label: 'Shop banner ads' }]} subtitle="Book a customer-app banner by the day. Every paid creative is reviewed before it can go live." actions={<Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>Create banner ad</Button>} />
    <Alert type="info" showIcon message="How billing works" description="The admin sets the daily placement price. Your total is selected days × daily price, plus 18% GST. Rejected banners are automatically marked refunded in this UI demo." />
    <DataTable tableId="seller-banner-ads" columns={columns} rows={query.data?.data ?? []} meta={query.data?.meta} loading={query.isLoading} onRowClick={setSelected} emptyProps={{ title: 'No banner ads yet', description: 'Create your first paid shop banner.' }} />
    <CreateBannerModal open={creating} onClose={() => setCreating(false)} />
    <BannerDetail booking={selected} onClose={() => setSelected(null)} />
  </Flex>;
}

function CreateBannerModal({ open, onClose }) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [step, setStep] = useState(0);
  const placements = useQuery({ queryKey: bannerAdsKeys.placements, queryFn: bannerAdsApi.placements, enabled: open });
  const destinations = useQuery({ queryKey: bannerAdsKeys.destinations, queryFn: bannerAdsApi.destinations, enabled: open });
  const placementId = Form.useWatch('placementId', form);
  const range = Form.useWatch('dateRange', form);
  const destinationType = Form.useWatch('destinationType', form);
  const placement = placements.data?.data?.find((item) => item.id === placementId);
  const price = useMemo(() => placement && range?.[0] && range?.[1] ? bannerAdPrice({ startsOn: range[0].format('YYYY-MM-DD'), endsOn: range[1].format('YYYY-MM-DD'), dailyRatePaise: placement.dailyRatePaise }) : null, [placement, range]);
  const create = useMutation({
    mutationFn: (values) => bannerAdsApi.createAndPay({
      campaignName: values.campaignName, placementId: values.placementId,
      startsOn: values.dateRange[0].format('YYYY-MM-DD'), endsOn: values.dateRange[1].format('YYYY-MM-DD'),
      destinationType: values.destinationType, destinationValue: values.destinationValue,
      desktopCreative: values.desktopCreative[0], mobileCreative: values.mobileCreative[0], paymentMethod: values.paymentMethod,
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: bannerAdsKeys.list }); message.success('Mock payment successful; banner sent for admin review'); close(); },
    onError: (error) => message.error(error.message),
  });
  const close = () => { form.resetFields(); setStep(0); onClose(); };
  const next = async () => {
    const fields = step === 0 ? ['campaignName', 'placementId', 'dateRange', 'destinationType', 'destinationValue'] : ['desktopCreative', 'mobileCreative'];
    await form.validateFields(fields); setStep((value) => value + 1);
  };
  const destinationOptions = destinationType === 'PRODUCT' ? destinations.data?.data?.products : destinations.data?.data?.shop ? [destinations.data.data.shop] : [];
  return <Modal title="Create shop banner ad" open={open} onCancel={close} width={820} footer={null} destroyOnHidden>
    <Steps current={step} size="small" items={[{ title: 'Booking' }, { title: 'Creatives' }, { title: 'Review & pay' }]} style={{ marginBottom: 24 }} />
    <Form form={form} layout="vertical" initialValues={{ destinationType: 'SHOP', paymentMethod: 'UPI' }} onFinish={create.mutate}>
      <div hidden={step !== 0}>
        <Form.Item name="campaignName" label="Campaign name" rules={[{ required: true, message: 'Name this campaign.' }]}><Input maxLength={80} placeholder="e.g. Winter shop showcase" /></Form.Item>
        <Row gutter={12}><Col span={12}><Form.Item name="placementId" label="Banner placement" rules={[{ required: true }]}><Select loading={placements.isLoading} options={(placements.data?.data ?? []).map((item) => ({ value: item.id, label: `${item.name} — ₹${(item.dailyRatePaise / 100).toLocaleString('en-IN')}/day` }))} /></Form.Item></Col>
          <Col span={12}><Form.Item name="dateRange" label="Date range" rules={[{ required: true }]}><DatePicker.RangePicker style={{ width: '100%' }} disabledDate={(date) => date.isBefore(dayjs().startOf('day'))} /></Form.Item></Col></Row>
        <Form.Item name="destinationType" label="Banner opens" rules={[{ required: true }]}><Radio.Group options={[{ value: 'SHOP', label: 'My shop' }, { value: 'PRODUCT', label: 'A product' }]} onChange={() => form.setFieldValue('destinationValue', undefined)} /></Form.Item>
        <Form.Item name="destinationValue" label={destinationType === 'PRODUCT' ? 'Product' : 'Shop'} rules={[{ required: true }]}><Select loading={destinations.isLoading} showSearch optionFilterProp="label" options={destinationOptions ?? []} /></Form.Item>
        {price && <PriceCard price={price} />}
      </div>
      <div hidden={step !== 1}>
        {!placement ? <Alert type="warning" showIcon message="Select a placement first." /> : <Row gutter={[16, 16]}>
          <Col xs={24} md={12}><Card size="small" title="Desktop creative"><Typography.Paragraph type="secondary">Required: {placement.desktopWidth} × {placement.desktopHeight}px, JPG/PNG/WebP, up to 10 MB.</Typography.Paragraph><Form.Item name="desktopCreative" rules={[{ required: true, message: 'Upload the desktop creative.' }]}><MediaWorkflowUpload kind="BANNER_AD_DESKTOP" label="Desktop banner" maxCount={1} minWidth={placement.desktopWidth} maxWidth={placement.desktopWidth} minHeight={placement.desktopHeight} maxHeight={placement.desktopHeight} /></Form.Item></Card></Col>
          <Col xs={24} md={12}><Card size="small" title="Mobile creative"><Typography.Paragraph type="secondary">Required: {placement.mobileWidth} × {placement.mobileHeight}px, JPG/PNG/WebP, up to 10 MB.</Typography.Paragraph><Form.Item name="mobileCreative" rules={[{ required: true, message: 'Upload the mobile creative.' }]}><MediaWorkflowUpload kind="BANNER_AD_MOBILE" label="Mobile banner" maxCount={1} minWidth={placement.mobileWidth} maxWidth={placement.mobileWidth} minHeight={placement.mobileHeight} maxHeight={placement.mobileHeight} /></Form.Item></Card></Col>
        </Row>}
      </div>
      <div hidden={step !== 2}>
        <Alert type="warning" showIcon message="UI-only mock payment" description="No real payment is collected. Confirming creates a paid request for the admin review queue." style={{ marginBottom: 16 }} />
        {price && <PriceCard price={price} />}
        <Form.Item name="paymentMethod" label="Mock payment method" rules={[{ required: true }]}><Radio.Group options={[{ value: 'UPI', label: 'UPI' }, { value: 'CARD', label: 'Credit/debit card' }]} /></Form.Item>
      </div>
      <Flex justify="space-between" style={{ marginTop: 20 }}><Button onClick={step === 0 ? close : () => setStep((value) => value - 1)}>{step === 0 ? 'Cancel' : 'Back'}</Button>{step < 2 ? <Button type="primary" onClick={next}>Continue</Button> : <Button type="primary" htmlType="submit" loading={create.isPending}>Pay {price ? <MoneyText paise={price.totalPaise} /> : ''} and submit</Button>}</Flex>
    </Form>
  </Modal>;
}

function PriceCard({ price }) { return <Card size="small" title="Price summary"><Space direction="vertical" style={{ width: '100%' }}><Line label={`${price.days} day${price.days === 1 ? '' : 's'} × ${formatINR(price.dailyRatePaise)}/day`} value={price.subtotalPaise} /><Line label={`GST (${price.gstPct}%)`} value={price.gstPaise} /><Flex justify="space-between" style={{ borderTop: '1px solid var(--ant-color-border-secondary)', paddingTop: 8 }}><Typography.Text strong>Total payable</Typography.Text><MoneyText paise={price.totalPaise} strong /></Flex></Space></Card>; }
function Line({ label, value }) { return <Flex justify="space-between"><Typography.Text type="secondary">{label}</Typography.Text><MoneyText paise={value} /></Flex>; }

function BannerDetail({ booking, onClose }) { return <Drawer title={booking?.campaignName} open={Boolean(booking)} onClose={onClose} width={680}>{booking && <Flex vertical gap={16}>
  <Flex justify="space-between"><Typography.Text type="secondary">Status</Typography.Text><StatusTag domain="bannerAd" code={booking.status} /></Flex>
  {booking.rejectionReason && <Alert type="error" showIcon message="Banner rejected" description={booking.rejectionReason} />}
  <Row gutter={[12, 12]}><Col span={12}><Image src={booking.desktopCreative?.previewUrl} alt="Desktop banner creative" width="100%" /></Col><Col span={12}><Image src={booking.mobileCreative?.previewUrl} alt="Mobile banner creative" width="100%" /></Col></Row>
  <Card size="small" title="Booking"><LineText label="Placement" value={booking.placementName} /><LineText label="Schedule" value={`${booking.startsOn} – ${booking.endsOn}`} /><LineText label="Booked days" value={booking.days} /><LineText label="Paid incl. GST" value={<MoneyText paise={booking.totalPaise} strong />} /><LineText label="Payment status" value={booking.paymentStatus} /><LineText label="Payment reference" value={booking.paymentReference} />{booking.refundReference && <LineText label="Refund reference" value={booking.refundReference} />}</Card>
  {['LIVE', 'COMPLETED'].includes(booking.status) && <Card size="small" title="Performance"><Row><Col span={12}><Typography.Text type="secondary">Impressions</Typography.Text><Typography.Title level={4}>{booking.impressions.toLocaleString('en-IN')}</Typography.Title></Col><Col span={12}><Typography.Text type="secondary">Clicks</Typography.Text><Typography.Title level={4}>{booking.clicks.toLocaleString('en-IN')}</Typography.Title></Col></Row></Card>}
</Flex>}</Drawer>; }
function LineText({ label, value }) { return <Flex justify="space-between" gap={16} style={{ marginBottom: 8 }}><Typography.Text type="secondary">{label}</Typography.Text><Typography.Text>{value}</Typography.Text></Flex>; }
