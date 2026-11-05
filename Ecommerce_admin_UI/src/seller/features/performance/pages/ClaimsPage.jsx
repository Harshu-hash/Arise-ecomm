import { PlusOutlined } from '@ant-design/icons';
import { App, Button, Descriptions, Drawer, Flex, Form, Input, InputNumber, List, Modal, Select, Space, Tag, Typography } from 'antd';
import { useState } from 'react';
import DataTable from '@ui/components/DataTable/DataTable';
import DateText from '@ui/components/DateText';
import MoneyText from '@ui/components/MoneyText';
import PageHeader from '@ui/components/PageHeader';
import StatusTag from '@ui/components/StatusTag';
import useListQuery from '@ui/hooks/useListQuery';
import useUrlTableState from '@ui/hooks/useUrlTableState';
import DocumentUpload from '@ui/components/DocumentUpload';
import { performanceApi, performanceKeys } from '../api/performance.api';
import { CLAIM_TYPE_OPTIONS } from '../claimTypes';

export default function ClaimsPage() {
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [evidence, setEvidence] = useState([]);
  const [selected, setSelected] = useState(null);
  const state = useUrlTableState({ defaultSort: '-submittedAt' });

  const { rows, meta, loading, error, refetch, fetching } = useListQuery({
    queryKey: performanceKeys.claims(state.queryParams),
    url: '/claims',
    params: state.queryParams,
  });

  const submit = async (values) => {
    setSaving(true);
    try {
      await performanceApi.createClaim({ ...values, evidenceMediaIds: evidence.map((item) => item.mediaId) });
      message.success('Claim submitted.');
      setOpen(false);
      form.resetFields();
      setEvidence([]);
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
        onRowClick={setSelected}
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
          <Form.Item name="returnId" label="Return ID"><Input placeholder="Optional linked return" /></Form.Item>
          <Form.Item name="amountClaimed" label="Amount claimed (₹)" rules={[{ required: true, message: 'Enter the amount.' }]}>
            <InputNumber style={{ width: '100%' }} min={1} prefix="₹" />
          </Form.Item>
          <Form.Item name="evidence" label="What does the evidence show?"><Input.TextArea rows={3} /></Form.Item>
          <Form.Item label="Attachments" required><DocumentUpload value={evidence} onChange={setEvidence} maxCount={5} label="Claim evidence" /></Form.Item>
        </Form>
      </Modal>
      <Drawer title={selected?.id} open={Boolean(selected)} onClose={() => setSelected(null)} width={480}>
        {selected && <Flex vertical gap={16}><Descriptions column={1} size="small" items={[
          { key: 'order', label: 'Order', children: selected.orderId }, { key: 'return', label: 'Return', children: selected.returnId ?? '—' }, { key: 'adjustment', label: 'Payout adjustment', children: selected.payoutAdjustmentId ? <Tag color="green">{selected.payoutAdjustmentId}</Tag> : 'Pending decision' },
        ]} /><List header="Linked entities" dataSource={selected.linkedEntities ?? []} renderItem={(item) => <List.Item>{item.type}: {item.id}</List.Item>} /><List header="Timeline" dataSource={selected.timeline ?? []} renderItem={(item) => <List.Item><List.Item.Meta title={item.type} description={`${item.actorName} · ${new Date(item.at).toLocaleString()}${item.note ? ` · ${item.note}` : ''}`} /></List.Item>} /></Flex>}
      </Drawer>
    </Flex>
  );
}
