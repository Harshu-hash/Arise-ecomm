import { PlusOutlined } from '@ant-design/icons';
import { App, Button, Flex, Form, Input, InputNumber, Modal, Progress, Radio, Space, Typography } from 'antd';
import { useState } from 'react';
import DataTable from '@ui/components/DataTable/DataTable';
import DateText from '@ui/components/DateText';
import MoneyText from '@ui/components/MoneyText';
import PageHeader from '@ui/components/PageHeader';
import StatusTag from '@ui/components/StatusTag';
import useListQuery from '@ui/hooks/useListQuery';
import useUrlTableState from '@ui/hooks/useUrlTableState';
import { promotionsApi, promotionsKeys } from '../api/promotions.api';

export default function CouponsPage() {
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const state = useUrlTableState({ defaultSort: '-createdAt' });

  const { rows, meta, loading, error, refetch, fetching } = useListQuery({
    queryKey: promotionsKeys.coupons(state.queryParams),
    url: '/promotions/coupons',
    params: state.queryParams,
  });

  const submit = async (values) => {
    setSaving(true);
    try {
      await promotionsApi.createCoupon(values);
      message.success('Coupon created.');
      setOpen(false);
      form.resetFields();
      refetch();
    } catch (e) {
      message.error(e?.message ?? 'Could not create the coupon.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Flex vertical gap={12}>
      <PageHeader
        title="Coupons"
        breadcrumbs={[{ label: 'Growth & Ads' }, { label: 'Coupons' }]}
        subtitle="Seller-funded discount codes, shown at checkout."
        actions={<Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>Create coupon</Button>}
      />

      <DataTable
        tableId="seller-coupons"
        columns={[
          { key: 'code', title: 'Code', dataIndex: 'code', priority: 1, render: (v, r) => <div><Typography.Text strong code>{v}</Typography.Text><div><Typography.Text type="secondary" style={{ fontSize: 12 }}>{r.name}</Typography.Text></div></div> },
          { key: 'discount', title: 'Discount', dataIndex: 'valuePct', priority: 1, render: (_, r) => (r.type === 'PERCENT' ? `${r.valuePct}% off` : <MoneyText paise={r.valuePaise} />) },
          {
            key: 'totalRedemptions', title: 'Redemptions', dataIndex: 'totalRedemptions', width: 160, priority: 2,
            render: (v, r) => (
              <div style={{ minWidth: 120 }}>
                <Typography.Text style={{ fontSize: 12 }}>{v} / {r.totalLimit}</Typography.Text>
                <Progress percent={Math.round((v / Math.max(1, r.totalLimit)) * 100)} size="small" showInfo={false} />
              </div>
            ),
          },
          { key: 'endsAt', title: 'Valid until', dataIndex: 'endsAt', priority: 2, sorter: true, render: (v) => <DateText value={v} /> },
          { key: 'status', title: 'Status', dataIndex: 'status', priority: 1, render: (s) => <StatusTag domain="coupon" code={s} /> },
        ]}
        rows={rows}
        meta={meta}
        loading={loading || fetching}
        error={error}
        onRetry={refetch}
        tableState={state}
        emptyProps={{ title: 'No coupons yet', description: 'Create a seller-funded coupon to drive conversions.' }}
        mobileCard={(row) => (
          <Flex vertical gap={6}>
            <Flex justify="space-between" align="flex-start" gap={8}>
              <Typography.Text strong code>{row.code}</Typography.Text>
              <StatusTag domain="coupon" code={row.status} />
            </Flex>
            <Space size={8} wrap>
              {row.type === 'PERCENT' ? <Typography.Text>{row.valuePct}% off</Typography.Text> : <MoneyText paise={row.valuePaise} />}
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>{row.totalRedemptions}/{row.totalLimit} used</Typography.Text>
            </Space>
          </Flex>
        )}
      />

      <Modal title="Create a coupon" open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} okText="Create" confirmLoading={saving}>
        <Form form={form} layout="vertical" onFinish={submit} initialValues={{ type: 'PERCENT' }}>
          <Form.Item name="code" label="Coupon code" rules={[{ required: true, message: 'Enter a code.' }]}>
            <Input placeholder="e.g. NOVA20" style={{ textTransform: 'uppercase' }} />
          </Form.Item>
          <Form.Item name="name" label="Display name">
            <Input placeholder="e.g. Flat 20% off" />
          </Form.Item>
          <Form.Item name="type" label="Discount type">
            <Radio.Group>
              <Radio.Button value="PERCENT">Percentage</Radio.Button>
              <Radio.Button value="FLAT">Flat amount</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prev, cur) => prev.type !== cur.type}
          >
            {({ getFieldValue }) => (
              <Form.Item name="value" label={getFieldValue('type') === 'PERCENT' ? 'Discount %' : 'Discount amount (₹)'} rules={[{ required: true, message: 'Enter the discount value.' }]}>
                <InputNumber style={{ width: '100%' }} min={1} max={getFieldValue('type') === 'PERCENT' ? 90 : undefined} />
              </Form.Item>
            )}
          </Form.Item>
          <Form.Item name="minCart" label="Minimum cart value (₹)">
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="budget" label="Total discount budget (₹)" rules={[{ required: true, message: 'Set a budget.' }]}>
            <InputNumber style={{ width: '100%' }} min={100} />
          </Form.Item>
        </Form>
      </Modal>
    </Flex>
  );
}
