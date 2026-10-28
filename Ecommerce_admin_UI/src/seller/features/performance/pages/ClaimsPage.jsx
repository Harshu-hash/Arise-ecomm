import { PlusOutlined } from '@ant-design/icons';
import { App, Button, Flex, Form, Input, InputNumber, Modal, Select, Space, Typography } from 'antd';
import { useState } from 'react';
import DataTable from '@ui/components/DataTable/DataTable';
import DateText from '@ui/components/DateText';
import MoneyText from '@ui/components/MoneyText';
import PageHeader from '@ui/components/PageHeader';
import StatusTag from '@ui/components/StatusTag';
import useListQuery from '@ui/hooks/useListQuery';
import useUrlTableState from '@ui/hooks/useUrlTableState';
import { performanceApi, performanceKeys } from '../api/performance.api';
import { CLAIM_TYPE_OPTIONS } from '../claimTypes';

export default function ClaimsPage() {
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const state = useUrlTableState({ defaultSort: '-submittedAt' });

  const { rows, meta, loading, error, refetch, fetching } = useListQuery({
    queryKey: performanceKeys.claims(state.queryParams),
    url: '/claims',
    params: state.queryParams,
  });

  const submit = async (values) => {
    setSaving(true);
    try {
      await performanceApi.createClaim(values);
      message.success('Claim submitted.');
      setOpen(false);
      form.resetFields();
      refetch();
    } catch (e) {
      message.error(e?.message ?? 'Could not submit the claim.');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      key: 'typeLabel', title: 'Type', dataIndex: 'typeLabel', priority: 1,
      render: (v, r) => <div><Typography.Text strong>{v}</Typography.Text><div><Typography.Text type="secondary" style={{ fontSize: 12 }}>{r.orderId}</Typography.Text></div></div>,
    },
    { key: 'amountClaimedPaise', title: 'Claimed', dataIndex: 'amountClaimedPaise', align: 'right', width: 110, priority: 1, render: (p) => <MoneyText paise={p} /> },
    { key: 'amountApprovedPaise', title: 'Approved', dataIndex: 'amountApprovedPaise', align: 'right', width: 110, priority: 2, render: (p) => (p != null ? <MoneyText paise={p} strong type="success" /> : '—') },
    { key: 'submittedAt', title: 'Submitted', dataIndex: 'submittedAt', width: 120, priority: 2, sorter: true, render: (v) => <DateText value={v} /> },
    {
      key: 'status', title: 'Status', dataIndex: 'status', width: 170, priority: 1,
      render: (s, r) => (
        <Flex vertical gap={2}>
          <StatusTag domain="claim" code={s} />
          {r.decisionReason && <Typography.Text type="secondary" style={{ fontSize: 11 }}>{r.decisionReason}</Typography.Text>}
        </Flex>
      ),
    },
  ];

  return (
    <Flex vertical gap={12}>
      <PageHeader
        title="Seller Claims"
        breadcrumbs={[{ label: 'Performance' }, { label: 'Claims' }]}
        subtitle="Claim reimbursement for stock lost, damaged or mishandled by Arise or a courier."
        actions={<Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>File a claim</Button>}
      />

      <DataTable
        tableId="seller-claims"
        columns={columns}
        rows={rows}
        meta={meta}
        loading={loading || fetching}
        error={error}
        onRetry={refetch}
        tableState={state}
        emptyProps={{ title: 'No claims yet', description: 'File a claim when stock is lost or damaged by Arise or a courier.' }}
        mobileCard={(row) => (
          <Flex vertical gap={6}>
            <Flex justify="space-between" align="flex-start" gap={8}>
              <div><Typography.Text strong>{row.typeLabel}</Typography.Text><div><Typography.Text type="secondary" style={{ fontSize: 12 }}>{row.orderId}</Typography.Text></div></div>
              <StatusTag domain="claim" code={row.status} />
            </Flex>
            <Space size={8} wrap>
              <MoneyText paise={row.amountClaimedPaise} strong />
              {row.amountApprovedPaise != null && <MoneyText paise={row.amountApprovedPaise} type="success" />}
            </Space>
          </Flex>
        )}
      />

      <Modal title="File a claim" open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} okText="Submit claim" confirmLoading={saving}>
        <Form form={form} layout="vertical" onFinish={submit}>
          <Form.Item name="type" label="What went wrong" rules={[{ required: true, message: 'Choose a type.' }]}>
            <Select options={CLAIM_TYPE_OPTIONS} placeholder="Select a reason" />
          </Form.Item>
          <Form.Item name="orderId" label="Order ID" rules={[{ required: true, message: 'Enter the order ID.' }]}>
            <Input placeholder="e.g. ORD-80123" />
          </Form.Item>
          <Form.Item name="amountClaimed" label="Amount claimed (₹)" rules={[{ required: true, message: 'Enter the amount.' }]}>
            <InputNumber style={{ width: '100%' }} min={1} prefix="₹" />
          </Form.Item>
          <Form.Item name="evidence" label="Evidence" rules={[{ required: true, message: 'Describe the evidence you have.' }]}>
            <Input.TextArea rows={3} placeholder="e.g. Courier POD shows no delivery scan; tracking stalled on 12 Oct." />
          </Form.Item>
        </Form>
      </Modal>
    </Flex>
  );
}
