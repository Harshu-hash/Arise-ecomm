import { PlusOutlined } from '@ant-design/icons';
import { App, Button, DatePicker, Drawer, Flex, Form, Input, InputNumber, Select, Space, Typography } from 'antd';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { queryClient } from '@core/api/queryClient';
import { dayjs } from '@core/utils/date';
import DataTable from '@ui/components/DataTable/DataTable';
import DateText from '@ui/components/DateText';
import ErrorState from '@ui/components/ErrorState';
import MoneyText from '@ui/components/MoneyText';
import PageHeader from '@ui/components/PageHeader';
import StatusTag from '@ui/components/StatusTag';
import { COUPON_TYPE_LABELS, sellerCouponKeys, sellerCouponsApi } from '../api/coupons.api';

const TYPE_OPTIONS = Object.entries(COUPON_TYPE_LABELS).map(([value, label]) => ({ value, label }));

function discountText(row) {
  if (row.type === 'PERCENT') {
    return `${row.valuePct}% off${row.maxDiscountPaise ? ` (max ₹${(row.maxDiscountPaise / 100).toLocaleString('en-IN')})` : ''}`;
  }
  if (row.type === 'FLAT') return <MoneyText paise={row.valuePaise} />;
  return 'Free delivery';
}

export default function CouponsPage() {
  const [creating, setCreating] = useState(false);
  const query = useQuery({
    queryKey: sellerCouponKeys.list({}),
    queryFn: () => sellerCouponsApi.list(),
  });

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
    { key: 'endsAt', title: 'Valid till', dataIndex: 'endsAt', render: (value) => <DateText value={value} variant="date" /> },
    { key: 'status', title: 'Status', dataIndex: 'status', render: (value) => <StatusTag domain="coupon" code={value} /> },
    { key: 'actions', title: '', align: 'right', render: (_v, row) => <CouponActions coupon={row} /> },
  ];

  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} title="Could not load coupons" />;

  return (
    <Flex vertical gap={12}>
      <PageHeader
        title="Coupons"
        breadcrumbs={[{ label: 'Catalog & Growth' }, { label: 'Coupons' }]}
        subtitle="Create your own discount codes. Customers enter the code at checkout; you fund the discount."
        actions={<Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>Create coupon</Button>}
      />
      <DataTable
        tableId="seller-coupons"
        columns={columns}
        rows={query.data?.data ?? []}
        meta={query.data?.meta}
        loading={query.isLoading}
        emptyProps={{ title: 'No coupons yet', description: 'Create your first discount code.' }}
      />
      <CreateCouponDrawer open={creating} onClose={() => setCreating(false)} />
    </Flex>
  );
}

function CouponActions({ coupon }) {
  const { message } = App.useApp();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['seller', 'coupons'] });
  const pause = useMutation({
    mutationFn: () => sellerCouponsApi.setPaused(coupon.id, coupon.status !== 'PAUSED'),
    onSuccess: () => { invalidate(); message.success(coupon.status === 'PAUSED' ? 'Coupon resumed' : 'Coupon paused'); },
    onError: (error) => message.error(error.message),
  });
  const end = useMutation({
    mutationFn: () => sellerCouponsApi.end(coupon.id),
    onSuccess: () => { invalidate(); message.success('Coupon ended'); },
    onError: (error) => message.error(error.message),
  });
  const lifecycle = ['ACTIVE', 'PAUSED', 'SCHEDULED'].includes(coupon.status);
  if (!lifecycle) return null;
  return (
    <Space size={4} onClick={(e) => e.stopPropagation()}>
      <Button size="small" loading={pause.isPending} onClick={() => pause.mutate()}>
        {coupon.status === 'PAUSED' ? 'Resume' : 'Pause'}
      </Button>
      <Button size="small" type="text" danger loading={end.isPending} onClick={() => end.mutate()}>End</Button>
    </Space>
  );
}

function CreateCouponDrawer({ open, onClose }) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const type = Form.useWatch('type', form);

  const create = useMutation({
    mutationFn: (values) => sellerCouponsApi.create({
      code: values.code,
      name: values.name,
      description: values.description,
      type: values.type,
      valuePct: values.valuePct,
      valuePaise: values.valueRupees != null ? Math.round(values.valueRupees * 100) : undefined,
      maxDiscountPaise: values.maxDiscountRupees != null ? Math.round(values.maxDiscountRupees * 100) : undefined,
      minCartPaise: Math.round((values.minCartRupees ?? 0) * 100),
      totalLimit: values.totalLimit,
      perUserLimit: values.perUserLimit,
      startsAt: values.validity[0].startOf('day').toISOString(),
      endsAt: values.validity[1].endOf('day').toISOString(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller', 'coupons'] });
      message.success('Coupon created');
      close();
    },
    onError: (error) => form.setFields([{ name: 'code', errors: [error.message] }]),
  });

  const close = () => { form.resetFields(); onClose(); };

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
            <Input className="mono" placeholder="WELCOME10" />
          </Form.Item>
          <Form.Item name="type" label="Discount type" style={{ flex: '1 1 200px' }} rules={[{ required: true }]}>
            <Select options={TYPE_OPTIONS} />
          </Form.Item>
        </Flex>

        <Form.Item name="name" label="Name shown to customers" rules={[{ required: true, message: 'Required' }]}>
          <Input maxLength={80} placeholder="10% off your first order" />
        </Form.Item>
        <Form.Item name="description" label="Description (optional)">
          <Input.TextArea rows={2} maxLength={200} />
        </Form.Item>

        {type === 'PERCENT' && (
          <Flex gap={8}>
            <Form.Item name="valuePct" label="Percentage off" style={{ flex: 1 }} rules={[{ required: true, message: 'Required' }]}>
              <InputNumber min={1} max={100} addonAfter="%" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="maxDiscountRupees" label="Max discount (₹)" style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: '100%' }} placeholder="No cap" />
            </Form.Item>
          </Flex>
        )}
        {type === 'FLAT' && (
          <Form.Item name="valueRupees" label="Amount off (₹)" rules={[{ required: true, message: 'Required' }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        )}

        <Form.Item name="minCartRupees" label="Minimum cart value (₹)">
          <InputNumber min={0} style={{ width: '100%' }} placeholder="No minimum" />
        </Form.Item>

        <Flex gap={8}>
          <Form.Item name="totalLimit" label="Total redemptions" style={{ flex: 1 }} rules={[{ required: true, message: 'Required' }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="perUserLimit" label="Per customer" style={{ flex: 1 }} rules={[{ required: true, message: 'Required' }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </Flex>

        <Form.Item name="validity" label="Valid between" rules={[{ required: true, message: 'Pick a date range' }]}>
          <DatePicker.RangePicker style={{ width: '100%' }} disabledDate={(date) => date.isBefore(dayjs().startOf('day'))} />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
