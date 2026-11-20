import { PlusOutlined } from '@ant-design/icons';
import { Alert, App, Button, Card, Col, DatePicker, Drawer, Empty, Flex, Form, Image, Input, Modal, Radio, Row, Select, Space, Steps, Typography } from 'antd';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { queryClient } from '@core/api/queryClient';
import { bannerAdPrice, isDayBooked, rangesOverlap } from '@core/utils/bannerAds';
import { dayjs } from '@core/utils/date';
import { formatINR } from '@core/utils/money';
import DataTable from '@ui/components/DataTable/DataTable';
import DateText from '@ui/components/DateText';
import ErrorState from '@ui/components/ErrorState';
import MediaWorkflowUpload from '@ui/components/MediaWorkflowUpload';
import MoneyText from '@ui/components/MoneyText';
import PageHeader from '@ui/components/PageHeader';
import StatusTag from '@ui/components/StatusTag';
import { IS_MOCK } from '@core/config/env';
import useRealtime from '@ui/hooks/useRealtime';
import { bannerAdsApi, bannerAdsKeys } from '../api/bannerAds.api';
import { payForBooking } from '../razorpayCheckout';

export default function BannerAdsPage() {
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState(null);
  const query = useQuery({ queryKey: bannerAdsKeys.list, queryFn: () => bannerAdsApi.list({ pageSize: 100 }) });
  // The admin approving or rejecting shows up here at once.
  useRealtime('seller', {
    'banner-ad:updated': () => queryClient.invalidateQueries({ queryKey: bannerAdsKeys.list }),
    'session:ready': () => queryClient.invalidateQueries({ queryKey: bannerAdsKeys.list }),
  });
  const columns = [
    { key: 'campaignName', title: 'Campaign', dataIndex: 'campaignName', alwaysVisible: true, render: (value, row) => <Flex vertical><Typography.Text strong>{value}</Typography.Text><Typography.Text type="secondary">{row.placementName}</Typography.Text></Flex> },
    { key: 'schedule', title: 'Schedule', render: (_value, row) => <Typography.Text><DateText value={row.startsOn} variant="date" /> – <DateText value={row.endsOn} variant="date" /></Typography.Text> },
    { key: 'paid', title: 'Paid incl. GST', dataIndex: 'totalPaise', align: 'right', render: (value) => <MoneyText paise={value} strong /> },
    { key: 'status', title: 'Status', dataIndex: 'status', render: (value) => <StatusTag domain="bannerAd" code={value} /> },
  ];
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} title="Could not load banner ads" />;
  return <Flex vertical gap={12}>
    <PageHeader title="Shop banner ads" breadcrumbs={[{ label: 'Growth' }, { label: 'Shop banner ads' }]} subtitle="Book a customer-app banner by the day. Every paid creative is reviewed before it can go live." actions={<Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>Create banner ad</Button>} />
    <Alert type="info" showIcon message="How billing works" description="The admin sets the daily placement price. Your total is selected days × daily price, plus 18% GST. You pay securely through Razorpay. If the admin rejects a banner, the full amount is refunded to your original payment method." />
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
    mutationFn: async (values) => {
      const { data } = await bannerAdsApi.createAndPay({
      campaignName: values.campaignName, placementId: values.placementId,
      startsOn: values.dateRange[0].format('YYYY-MM-DD'), endsOn: values.dateRange[1].format('YYYY-MM-DD'),
      destinationType: values.destinationType, destinationValue: values.destinationValue,
      mobileCreative: values.mobileCreative[0], paymentMethod: values.paymentMethod,
      });
      // Live backend: the dates are now held and a Razorpay order is open. The mock API pays in one step.
      if (data.payment) await payForBooking(data.payment, { description: values.campaignName });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: bannerAdsKeys.list }); message.success(IS_MOCK ? 'Mock payment successful; banner sent for admin review' : 'Payment received; banner sent for admin review'); close(); },
    onError: (error) => {
      message.error(error.message);
      // A closed payment window leaves the booking held (payable from the list), so refresh it too.
      if (error.cancelled) { queryClient.invalidateQueries({ queryKey: bannerAdsKeys.list }); close(); }
      // Someone else may have taken the dates: reload availability so the calendar is current.
      if (error.code === 'SLOT_BOOKED') queryClient.invalidateQueries({ queryKey: bannerAdsKeys.placements });
    },
  });
  const close = () => { form.resetFields(); setStep(0); onClose(); };
  const next = async () => {
    const fields = step === 0 ? ['campaignName', 'placementId', 'dateRange', 'destinationType', 'destinationValue'] : ['mobileCreative'];
    await form.validateFields(fields); setStep((value) => value + 1);
  };
  const destinationOptions = destinationType === 'PRODUCT' ? destinations.data?.data?.products : destinations.data?.data?.shop ? [destinations.data.data.shop] : [];
  return <Modal title="Create shop banner ad" open={open} onCancel={close} width={820} footer={null} destroyOnHidden>
    <Steps current={step} size="small" items={[{ title: 'Booking' }, { title: 'Creatives' }, { title: 'Review & pay' }]} style={{ marginBottom: 24 }} />
    <Form form={form} layout="vertical" initialValues={{ destinationType: 'SHOP', paymentMethod: 'UPI' }} onFinish={create.mutate}>
      <div hidden={step !== 0}>
        <Form.Item name="campaignName" label="Campaign name" rules={[{ required: true, message: 'Name this campaign.' }]}><Input maxLength={80} placeholder="e.g. Winter shop showcase" /></Form.Item>
        <Form.Item name="placementId" label="Choose a banner slot" rules={[{ required: true, message: 'Choose the slot you want to rent.' }]}>
          <SlotPicker slots={placements.data?.data ?? []} loading={placements.isLoading} onPick={() => form.setFieldValue('dateRange', undefined)} />
        </Form.Item>
        <Form.Item
          name="dateRange"
          label="Dates"
          extra={placement?.bookedRanges?.length ? `Already booked on this slot: ${placement.bookedRanges.map((r) => `${r.startsOn} to ${r.endsOn}`).join(', ')}. Those days are greyed out.` : placement ? 'This slot is free on every upcoming date.' : 'Choose a slot first to see its availability.'}
          rules={[{ required: true, message: 'Pick the start and end dates.' }, { validator: (_rule, range) => (range && placement && placement.bookedRanges.some((r) => rangesOverlap(r, { startsOn: range[0].format('YYYY-MM-DD'), endsOn: range[1].format('YYYY-MM-DD') })) ? Promise.reject(new Error('Your dates include days that are already booked. Pick a free stretch.')) : Promise.resolve()) }]}
        >
          <DatePicker.RangePicker style={{ width: '100%' }} disabled={!placement} disabledDate={(date) => date.isBefore(dayjs().startOf('day')) || isDayBooked(date.format('YYYY-MM-DD'), placement?.bookedRanges ?? [])} />
        </Form.Item>
        <Form.Item name="destinationType" label="Banner opens" rules={[{ required: true }]}><Radio.Group options={[{ value: 'SHOP', label: 'My shop' }, { value: 'PRODUCT', label: 'A product' }]} onChange={() => form.setFieldValue('destinationValue', undefined)} /></Form.Item>
        <Form.Item name="destinationValue" label={destinationType === 'PRODUCT' ? 'Product' : 'Shop'} rules={[{ required: true }]}><Select loading={destinations.isLoading} showSearch optionFilterProp="label" options={destinationOptions ?? []} /></Form.Item>
        {price && <PriceCard price={price} />}
      </div>
      <div hidden={step !== 1}>
        {!placement ? <Alert type="warning" showIcon message="Select a placement first." /> : <Row gutter={[16, 16]}>
          <Col xs={24} md={12}><Card size="small" title="Mobile creative"><Typography.Paragraph type="secondary">Required: {placement.mobileWidth} × {placement.mobileHeight}px, JPG/PNG/WebP, up to 10 MB.</Typography.Paragraph><Form.Item name="mobileCreative" rules={[{ required: true, message: 'Upload the mobile creative.' }]}><MediaWorkflowUpload kind="BANNER_AD_MOBILE" label="Mobile banner" maxCount={1} minWidth={placement.mobileWidth} maxWidth={placement.mobileWidth} minHeight={placement.mobileHeight} maxHeight={placement.mobileHeight} /></Form.Item></Card></Col>
        </Row>}
      </div>
      <div hidden={step !== 2}>
        {IS_MOCK
          ? <Alert type="warning" showIcon message="UI-only mock payment" description="No real payment is collected. Confirming creates a paid request for the admin review queue." style={{ marginBottom: 16 }} />
          : <Alert type="info" showIcon message="Secure payment with Razorpay" description="Your dates are held while you pay. Pay by UPI, card or net banking in the Razorpay window; the banner then goes to admin review." style={{ marginBottom: 16 }} />}
        {price && <PriceCard price={price} />}
        {IS_MOCK && <Form.Item name="paymentMethod" label="Mock payment method" rules={[{ required: true }]}><Radio.Group options={[{ value: 'UPI', label: 'UPI' }, { value: 'CARD', label: 'Credit/debit card' }]} /></Form.Item>}
      </div>
      <Flex justify="space-between" style={{ marginTop: 20 }}><Button onClick={step === 0 ? close : () => setStep((value) => value - 1)}>{step === 0 ? 'Cancel' : 'Back'}</Button>{step < 2 ? <Button type="primary" onClick={next}>Continue</Button> : <Button type="primary" htmlType="submit" loading={create.isPending}>Pay {price ? formatINR(price.totalPaise) : ''} and submit</Button>}</Flex>
    </Form>
  </Modal>;
}

/** Radio-style cards: one per slot the admin has opened, with its daily price and creative sizes. */
function SlotPicker({ value, onChange, slots, loading, onPick }) {
  if (!loading && !slots.length) return <Empty description="No banner slots are open for booking right now." />;
  return <Row gutter={[12, 12]}>{slots.map((slot) => {
    const selected = value === slot.id;
    return <Col xs={24} md={12} key={slot.id}>
      <Card
        size="small" hoverable loading={loading} role="radio" aria-checked={selected} tabIndex={0}
        onClick={() => { onChange?.(slot.id); onPick?.(); }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange?.(slot.id); onPick?.(); } }}
        style={{ borderColor: selected ? 'var(--ant-color-primary)' : undefined, borderWidth: selected ? 2 : 1 }}
      >
        <Flex justify="space-between" align="start" gap={8}>
          <Typography.Text strong>{slot.name}</Typography.Text>
          <Typography.Text strong>{formatINR(slot.dailyRatePaise)}<Typography.Text type="secondary">/day</Typography.Text></Typography.Text>
        </Flex>
        <Typography.Paragraph type="secondary" style={{ margin: '4px 0' }}>{slot.description || 'No description.'}</Typography.Paragraph>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>Shows on {slot.categoryName ? `${slot.categoryName} page` : 'For You page'} · Mobile banner {slot.mobileWidth}×{slot.mobileHeight} px</Typography.Text>
        <div><Typography.Text type={slot.bookedRanges.length ? 'warning' : 'success'} style={{ fontSize: 12 }}>{slot.bookedRanges.length ? `${slot.bookedRanges.length} upcoming booking${slot.bookedRanges.length === 1 ? '' : 's'}` : 'Fully open'}</Typography.Text></div>
      </Card>
    </Col>;
  })}</Row>;
}

function PriceCard({ price }) { return <Card size="small" title="Price summary"><Space direction="vertical" style={{ width: '100%' }}><Line label={`${price.days} day${price.days === 1 ? '' : 's'} × ${formatINR(price.dailyRatePaise)}/day`} value={price.subtotalPaise} /><Line label={`GST (${price.gstPct}%)`} value={price.gstPaise} /><Flex justify="space-between" style={{ borderTop: '1px solid var(--ant-color-border-secondary)', paddingTop: 8 }}><Typography.Text strong>Total payable</Typography.Text><MoneyText paise={price.totalPaise} strong /></Flex></Space></Card>; }
function Line({ label, value }) { return <Flex justify="space-between"><Typography.Text type="secondary">{label}</Typography.Text><MoneyText paise={value} /></Flex>; }

function PayNow({ booking, onPaid }) {
  const { message } = App.useApp();
  const pay = useMutation({
    mutationFn: async () => payForBooking((await bannerAdsApi.paymentOrder(booking.id)).data, { description: booking.campaignName }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: bannerAdsKeys.list }); message.success('Payment received; banner sent for admin review'); onPaid(); },
    onError: (error) => { message.error(error.message); queryClient.invalidateQueries({ queryKey: bannerAdsKeys.list }); },
  });
  return <Alert type="warning" showIcon message="Payment pending" description="Your dates are held for 15 minutes after booking. Complete the payment to send the banner for review."
    action={<Button type="primary" loading={pay.isPending} onClick={() => pay.mutate()}>Pay {formatINR(booking.totalPaise)}</Button>} />;
}

function BannerDetail({ booking, onClose }) { return <Drawer title={booking?.campaignName} open={Boolean(booking)} onClose={onClose} width={680}>{booking && <Flex vertical gap={16}>
  {booking.status === 'PENDING_PAYMENT' && <PayNow booking={booking} onPaid={onClose} />}
  <Flex justify="space-between"><Typography.Text type="secondary">Status</Typography.Text><StatusTag domain="bannerAd" code={booking.status} /></Flex>
  {booking.rejectionReason && <Alert type="error" showIcon message="Banner rejected" description={booking.rejectionReason} />}
  <Image src={booking.mobileCreative?.previewUrl} alt="Mobile banner creative" style={{ maxHeight: 360, objectFit: 'contain' }} />
  <Card size="small" title="Booking"><LineText label="Placement" value={`${booking.placementName} (${booking.categoryName ? `${booking.categoryName} page` : 'For You page'})`} /><LineText label="Schedule" value={`${booking.startsOn} – ${booking.endsOn}`} /><LineText label="Booked days" value={booking.days} /><LineText label="Paid incl. GST" value={<MoneyText paise={booking.totalPaise} strong />} /><LineText label="Payment status" value={booking.paymentStatus} /><LineText label="Payment reference" value={booking.paymentReference} />{booking.refundReference && <LineText label="Refund reference" value={booking.refundReference} />}</Card>
  {['LIVE', 'COMPLETED'].includes(booking.status) && <Card size="small" title="Performance"><Row><Col span={12}><Typography.Text type="secondary">Impressions</Typography.Text><Typography.Title level={4}>{booking.impressions.toLocaleString('en-IN')}</Typography.Title></Col><Col span={12}><Typography.Text type="secondary">Clicks</Typography.Text><Typography.Title level={4}>{booking.clicks.toLocaleString('en-IN')}</Typography.Title></Col></Row></Card>}
</Flex>}</Drawer>; }
function LineText({ label, value }) { return <Flex justify="space-between" gap={16} style={{ marginBottom: 8 }}><Typography.Text type="secondary">{label}</Typography.Text><Typography.Text>{value}</Typography.Text></Flex>; }
