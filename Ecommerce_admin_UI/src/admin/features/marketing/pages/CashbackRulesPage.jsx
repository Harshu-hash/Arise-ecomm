import { App, Button, DatePicker, Flex, Form, Input, InputNumber, Modal, Table, Tag } from 'antd';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@core/api/axiosInstance';
import { queryClient } from '@core/api/queryClient';
import DateText from '@ui/components/DateText';
import ErrorState from '@ui/components/ErrorState';
import MoneyText from '@ui/components/MoneyText';
import PageHeader from '@ui/components/PageHeader';

const COLORS = { ACTIVE: 'green', SCHEDULED: 'blue', PAUSED: 'gold', ENDED: 'default', EXHAUSTED: 'default' };
const KEY = ['marketing', 'cashbackRules'];

/** Cashback rules: a delivered parcel earns the best fitting rule's percentage back as wallet credit, within its cap and budget. */
export default function CashbackRulesPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [creating, setCreating] = useState(false);
  const list = useQuery({ queryKey: KEY, queryFn: () => api.get('/cashback-rules') });
  const refresh = () => queryClient.invalidateQueries({ queryKey: KEY });

  const create = useMutation({
    mutationFn: (v) => api.post('/cashback-rules', {
      name: v.name, pct: v.pct, maxCashbackPaise: Math.round(v.maxRupees * 100), minOrderPaise: Math.round((v.minRupees ?? 0) * 100),
      creditExpiryDays: v.expiryDays ?? 0, budgetPaise: Math.round((v.budgetRupees ?? 0) * 100),
      startsAt: v.period[0].startOf('day').toISOString(), endsAt: v.period[1].endOf('day').toISOString(),
    }),
    onSuccess: () => { setCreating(false); form.resetFields(); refresh(); message.success('Rule created'); },
    onError: (e) => message.error(e.message),
  });
  const pause = useMutation({ mutationFn: (id) => api.post(`/cashback-rules/${id}/pause`, {}), onSuccess: refresh, onError: (e) => message.error(e.message) });

  if (list.isError) return <ErrorState error={list.error} onRetry={list.refetch} />;

  return (
    <Flex vertical gap={16}>
      <PageHeader title="Cashback rules" subtitle="When a parcel is delivered, the customer gets the best matching rule back as wallet credit." actions={<Button type="primary" onClick={() => setCreating(true)}>New rule</Button>} />
      <Table
        size="small"
        rowKey="id"
        loading={list.isLoading}
        dataSource={list.data?.data ?? []}
        pagination={false}
        locale={{ emptyText: 'No cashback rules yet' }}
        columns={[
          { title: 'Rule', dataIndex: 'name' },
          { title: 'Cashback', render: (_, r) => <>{r.pct}% up to <MoneyText paise={r.maxCashbackPaise} /></> },
          { title: 'Min. order', dataIndex: 'minOrderPaise', align: 'right', render: (v) => <MoneyText paise={v} /> },
          { title: 'Paid so far', align: 'right', render: (_, r) => <><MoneyText paise={r.usedPaise} />{r.budgetPaise ? <> of <MoneyText paise={r.budgetPaise} /></> : null} ({r.grants})</> },
          { title: 'Runs', render: (_, r) => <><DateText value={r.startsAt} variant="date" /> → <DateText value={r.endsAt} variant="date" /></> },
          { title: 'Status', dataIndex: 'status', render: (v) => <Tag color={COLORS[v]}>{v.toLowerCase()}</Tag> },
          { title: '', align: 'right', render: (_, r) => ['ACTIVE', 'SCHEDULED', 'PAUSED'].includes(r.status) && <Button size="small" loading={pause.isPending} onClick={() => pause.mutate(r.id)}>{r.status === 'PAUSED' ? 'Resume' : 'Pause'}</Button> },
        ]}
      />
      <Modal title="New cashback rule" open={creating} okText="Create" confirmLoading={create.isPending} onCancel={() => setCreating(false)} destroyOnClose onOk={() => form.validateFields().then((v) => create.mutate(v)).catch(() => {})}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Name customers will see" rules={[{ required: true }]}><Input maxLength={80} placeholder="e.g. 5% back on every order" /></Form.Item>
          <Flex gap={12}>
            <Form.Item name="pct" label="Cashback %" rules={[{ required: true }]}><InputNumber min={1} max={100} addonAfter="%" /></Form.Item>
            <Form.Item name="maxRupees" label="Max per parcel" rules={[{ required: true }]}><InputNumber min={1} addonBefore="₹" /></Form.Item>
          </Flex>
          <Flex gap={12}>
            <Form.Item name="minRupees" label="Minimum order"><InputNumber min={0} addonBefore="₹" /></Form.Item>
            <Form.Item name="budgetRupees" label="Total budget (0 = none)"><InputNumber min={0} addonBefore="₹" /></Form.Item>
          </Flex>
          <Form.Item name="expiryDays" label="Credit expires after (days, 0 = never)"><InputNumber min={0} max={730} /></Form.Item>
          <Form.Item name="period" label="Runs from / to" rules={[{ required: true, message: 'Pick the dates.' }]}><DatePicker.RangePicker /></Form.Item>
        </Form>
      </Modal>
    </Flex>
  );
}
