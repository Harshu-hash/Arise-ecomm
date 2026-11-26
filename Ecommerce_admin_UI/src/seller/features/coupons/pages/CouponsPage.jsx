import { PlusOutlined } from '@ant-design/icons';
import { App, Button, DatePicker, Drawer, Flex, Form, Input, InputNumber, Popconfirm, Select, Space, Typography } from 'antd';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError, showFieldErrors } from '@core/api/errors';
import { queryClient } from '@core/api/queryClient';
import { useSessionStore } from '@core/auth/sessionStore';
import { dayjs } from '@core/utils/date';
import DataTable from '@ui/components/DataTable/DataTable';
import DateText from '@ui/components/DateText';
import FilterBar from '@ui/components/FilterBar';
import MoneyText from '@ui/components/MoneyText';
import PageHeader from '@ui/components/PageHeader';
import StatusTag from '@ui/components/StatusTag';
import useListQuery from '@ui/hooks/useListQuery';
import useRealtime from '@ui/hooks/useRealtime';
import useUrlTableState from '@ui/hooks/useUrlTableState';
import { COUPON_TYPE_LABELS, sellerCouponKeys, sellerCouponsApi } from '../api/coupons.api';

const TYPE_OPTIONS = Object.entries(COUPON_TYPE_LABELS).map(([value, label]) => ({ value, label }));
const MAX_DAYS = 366; // keep in step with the server's MAX_COUPON_DAYS
// Server field names → the form's own (the form edits rupees and one validity range).
const FIELD_ALIASES = { valuePaise: 'valueRupees', maxDiscountPaise: 'maxDiscountRupees', minCartPaise: 'minCartRupees', startsAt: 'validity', endsAt: 'validity' };
const OPEN_STATUSES = ['ACTIVE', 'PAUSED', 'SCHEDULED'];
const refreshCoupons = () => queryClient.invalidateQueries({ queryKey: ['seller', 'coupons'] });

function discountText(row) {
  if (row.type === 'PERCENT') {
    return `${row.valuePct}% off${row.maxDiscountPaise ? ` (max ₹${(row.maxDiscountPaise / 100).toLocaleString('en-IN')})` : ''}`;
  }
  if (row.type === 'FLAT') return <MoneyText paise={row.valuePaise} />;
  return 'Free delivery';
}

export default function CouponsPage() {
  const [creating, setCreating] = useState(false);
  // Changing coupons costs money, so only the account owner may; staff can look.
  const canManage = useSessionStore((state) => state.user?.role === 'SELLER');
  const state = useUrlTableState({ defaultSort: '-createdAt' });
  const { rows, meta, loading, fetching, error, refetch } = useListQuery({
    queryKey: sellerCouponKeys.list({ ...state.queryParams, tab: state.tab }),
    url: '/coupons',
    params: { ...state.queryParams, ...(state.tab && state.tab !== 'all' ? { status: state.tab } : {}) },
  });
  // An admin pausing your coupon, another device, or a reconnect after a dropped connection refreshes the list.
  useRealtime('seller', { 'coupon:changed': refreshCoupons, 'session:ready': refreshCoupons });

  const columns = [
    {
      key: 'code', title: 'Coupon', dataIndex: 'code', alwaysVisible: true,
      render: (value, row) => (
        <Flex vertical gap={0}>
          <Typography.Text className="mono" strong>{value}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }} ellipsis>{row.name}</Typography.Text>
        </Flex>
      ),
    },
    { key: 'type', title: 'Discount', render: (_v, row) => <Typography.Text>{discountText(row)}</Typography.Text> },
    { key: 'minCart', title: 'Min cart', dataIndex: 'minCartPaise', align: 'right', render: (value) => (value ? <MoneyText paise={value} /> : <Typography.Text type="secondary">—</Typography.Text>) },
    { key: 'usage', title: 'Used', render: (_v, row) => <Typography.Text className="tabular">{row.totalRedemptions.toLocaleString('en-IN')} / {row.totalLimit.toLocaleString('en-IN')}</Typography.Text> },
    { key: 'endsAt', title: 'Valid till', dataIndex: 'endsAt', sorter: true, render: (value) => <DateText value={value} variant="date" /> },
    { key: 'status', title: 'Status', dataIndex: 'status', render: (value) => <StatusTag domain="coupon" code={value} /> },
    ...(canManage ? [{ key: 'actions', title: '', align: 'right', render: (_v, row) => <CouponActions coupon={row} /> }] : []),
  ];

  return (
    <Flex vertical gap={12}>
      <PageHeader
        title="Coupons"
        breadcrumbs={[{ label: 'Catalog & Growth' }, { label: 'Coupons' }]}
        subtitle="Create your own discount codes. Customers enter the code at checkout; you fund the discount, and it applies to your products only."
        actions={canManage ? <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>Create coupon</Button> : null}
      />
      <FilterBar tableState={state} searchPlaceholder="Search code or name" />
      <DataTable
        tableId="seller-coupons"
        columns={columns}
        rows={rows}
        meta={meta}
        loading={loading || fetching}
        error={error}
        onRetry={refetch}
        tableState={state}
        tabs={[
          { key: 'all', label: 'All' },
          { key: 'ACTIVE', label: 'Active' },
          { key: 'SCHEDULED', label: 'Scheduled' },
          { key: 'PAUSED', label: 'Paused' },
          { key: 'EXHAUSTED', label: 'Used up' },
          { key: 'EXPIRED', label: 'Expired' },
        ]}
        emptyProps={{ title: 'No coupons here', description: canManage ? 'Create a discount code to get started.' : undefined }}
      />
      <CreateCouponDrawer open={creating} onClose={() => setCreating(false)} />
    </Flex>
  );
}

function CouponActions({ coupon }) {
  const { message } = App.useApp();
  const run = (mutationFn, done) => ({
    mutationFn,
    onSuccess: () => { refreshCoupons(); message.success(done); },
    onError: (error) => message.error(error.message),
  });
  const paused = coupon.status === 'PAUSED';
  const pause = useMutation(run(() => (paused ? sellerCouponsApi.resume(coupon.id) : sellerCouponsApi.pause(coupon.id)), paused ? 'Coupon resumed' : 'Coupon paused'));
  const end = useMutation(run(() => sellerCouponsApi.end(coupon.id), 'Coupon ended'));
  if (!OPEN_STATUSES.includes(coupon.status)) return null;
  return (
    <Space wrap size={4} onClick={(e) => e.stopPropagation()}>
      <Button size="small" loading={pause.isPending} onClick={() => pause.mutate()}>{paused ? 'Resume' : 'Pause'}</Button>
      <Popconfirm title="End this coupon now?" description="Customers can no longer use it. This cannot be undone." okText="End coupon" okButtonProps={{ danger: true }} onConfirm={() => end.mutate()}>
        <Button size="small" type="text" danger loading={end.isPending}>End</Button>
      </Popconfirm>
    </Space>
  );
}

function CreateCouponDrawer({ open, onClose }) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const type = Form.useWatch('type', form);
  const close = () => { form.resetFields(); onClose(); };

  const create = useMutation({
    mutationFn: (values) => sellerCouponsApi.create({
      code: values.code,
      name: values.name,
      description: values.description,
      type: values.type,
      valuePct: values.type === 'PERCENT' ? values.valuePct : undefined,
      valuePaise: values.type === 'FLAT' ? Math.round(values.valueRupees * 100) : undefined,
      maxDiscountPaise: values.type === 'PERCENT' && values.maxDiscountRupees ? Math.round(values.maxDiscountRupees * 100) : undefined,
      minCartPaise: Math.round((values.minCartRupees ?? 0) * 100),
      totalLimit: values.totalLimit,
      perUserLimit: values.perUserLimit,
      startsAt: values.validity[0].startOf('day').toISOString(),
      endsAt: values.validity[1].endOf('day').toISOString(),
    }),
    onSuccess: () => { refreshCoupons(); message.success('Coupon created'); close(); },
    onError: (error) => {
      if (error instanceof ApiError && error.fieldErrors) showFieldErrors(form, message, error, FIELD_ALIASES);
      else message.error(error.message);
    },
  });

  return (
    <Drawer
      open={open}
      onClose={close}
      width={560}
      title="Create coupon"
      destroyOnHidden
      extra={<Button type="primary" loading={create.isPending} onClick={() => form.submit()}>Create</Button>}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ type: 'PERCENT', perUserLimit: 1, validity: [dayjs(), dayjs().add(30, 'day')] }}
        onFinish={create.mutate}
      >
        <Flex gap={8}>
          <Form.Item name="code" label="Code" style={{ flex: '1 1 180px' }} normalize={(v) => v?.toUpperCase()}
            rules={[{ required: true, message: 'Enter a code' }, { pattern: /^[A-Z0-9]{3,20}$/, message: '3–20 letters or digits' }]}>
            <Input className="mono" placeholder="WELCOME10" maxLength={20} />
          </Form.Item>
          <Form.Item name="type" label="Discount type" style={{ flex: '1 1 200px' }} rules={[{ required: true }]}>
            <Select options={TYPE_OPTIONS} />
          </Form.Item>
        </Flex>

        <Form.Item name="name" label="Name shown to customers" rules={[{ required: true, whitespace: true, message: 'Required' }]}>
          <Input maxLength={80} placeholder="10% off your first order" />
        </Form.Item>
        <Form.Item name="description" label="Description (optional)">
          <Input.TextArea rows={2} maxLength={200} />
        </Form.Item>

        {type === 'PERCENT' && (
          <Flex gap={8}>
            <Form.Item name="valuePct" label="Percentage off" style={{ flex: 1 }} rules={[{ required: true, message: 'Required' }, { type: 'integer', message: 'Use a whole number' }]}>
              <InputNumber min={1} max={100} addonAfter="%" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="maxDiscountRupees" label="Max discount (₹)" style={{ flex: 1 }}>
              <InputNumber min={1} style={{ width: '100%' }} placeholder="No cap" />
            </Form.Item>
          </Flex>
        )}
        {type === 'FLAT' && (
          <Form.Item name="valueRupees" label="Amount off (₹)" rules={[{ required: true, message: 'Required' }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        )}

        <Form.Item
          name="minCartRupees" label="Minimum cart value (₹)" dependencies={['valueRupees', 'type']}
          rules={[({ getFieldValue }) => ({
            validator: (_rule, min) => (getFieldValue('type') === 'FLAT' && min && getFieldValue('valueRupees') > min
              ? Promise.reject(new Error('Cannot be below the amount off'))
              : Promise.resolve()),
          })]}
        >
          <InputNumber min={0} style={{ width: '100%' }} placeholder="No minimum" />
        </Form.Item>

        <Flex gap={8}>
          <Form.Item name="totalLimit" label="Total redemptions" style={{ flex: 1 }} rules={[{ required: true, message: 'Required' }]}>
            <InputNumber min={1} max={10_000_000} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="perUserLimit" label="Per customer" style={{ flex: 1 }} dependencies={['totalLimit']}
            rules={[{ required: true, message: 'Required' }, ({ getFieldValue }) => ({
              validator: (_rule, limit) => (limit > getFieldValue('totalLimit') ? Promise.reject(new Error('Cannot exceed total redemptions')) : Promise.resolve()),
            })]}
          >
            <InputNumber min={1} max={1000} style={{ width: '100%' }} />
          </Form.Item>
        </Flex>

        <Form.Item
          name="validity" label="Valid between"
          rules={[
            { required: true, message: 'Pick a date range' },
            { validator: (_rule, range) => {
              if (!range?.[1]) return Promise.resolve();
              if (range[1].endOf('day').isBefore(dayjs())) return Promise.reject(new Error('The end date is in the past'));
              if (range[1].diff(range[0], 'day') > MAX_DAYS) return Promise.reject(new Error(`At most ${MAX_DAYS} days`));
              return Promise.resolve();
            } },
          ]}
        >
          <DatePicker.RangePicker style={{ width: '100%' }} disabledDate={(date) => date.isBefore(dayjs().startOf('day'))} />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
