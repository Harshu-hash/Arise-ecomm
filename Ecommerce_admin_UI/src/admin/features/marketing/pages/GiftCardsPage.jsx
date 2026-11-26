import { App, Button, DatePicker, Flex, Form, InputNumber, Input, Modal, Segmented, Table, Tag, Typography } from 'antd';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@core/api/axiosInstance';
import { queryClient } from '@core/api/queryClient';
import DateText from '@ui/components/DateText';
import ErrorState from '@ui/components/ErrorState';
import MoneyText from '@ui/components/MoneyText';
import PageHeader from '@ui/components/PageHeader';

const STATUS = { ACTIVE: 'green', REDEEMED: 'default', BLOCKED: 'red' };
const FILTERS = [{ label: 'All', value: 'ALL' }, { label: 'Unused', value: 'ACTIVE' }, { label: 'Redeemed', value: 'REDEEMED' }, { label: 'Blocked', value: 'BLOCKED' }];

// The PINs exist only in this response; the file is the only copy the admin gets.
const toCsv = (cards) => ['code,pin,amount_inr,expires', ...cards.map((c) => `${c.code},${c.pin},${c.amountPaise / 100},${c.expiresAt.slice(0, 10)}`)].join('\n');
function download(cards) {
  const url = URL.createObjectURL(new Blob([toCsv(cards)], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `gift-cards-${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/** Gift cards: generate a batch (codes + PINs shown once), see which are used, block an unused one. */
export default function GiftCardsPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [made, setMade] = useState(null);
  const params = { page, limit: 20, ...(status === 'ALL' ? {} : { status }) };
  const list = useQuery({ queryKey: ['marketing', 'giftCards', params], queryFn: () => api.get('/gift-cards', params) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['marketing', 'giftCards'] });

  const generate = useMutation({
    mutationFn: ({ count, rupees, expiresAt, note }) => api.post('/gift-cards', { count, amountPaise: Math.round(rupees * 100), expiresAt: expiresAt.endOf('day').toISOString(), note: note ?? '' }),
    onSuccess: (res) => { setCreating(false); form.resetFields(); setMade(res.data); refresh(); },
    onError: (e) => message.error(e.message),
  });
  const block = useMutation({
    mutationFn: (id) => api.post(`/gift-cards/${id}/block`, {}),
    onSuccess: () => { refresh(); message.success('Gift card blocked'); },
    onError: (e) => message.error(e.message),
  });

  if (list.isError) return <ErrorState error={list.error} onRetry={list.refetch} />;
  const data = list.data?.data;

  return (
    <Flex vertical gap={16}>
      <PageHeader title="Gift cards" subtitle="Prepaid codes customers redeem into their wallet as store credit." actions={<Button type="primary" onClick={() => setCreating(true)}>Generate cards</Button>} />
      <Segmented options={FILTERS} value={status} onChange={(v) => { setStatus(v); setPage(1); }} />
      <Table
        size="small"
        rowKey="id"
        loading={list.isLoading}
        dataSource={data?.items ?? []}
        pagination={{ current: page, pageSize: 20, total: data?.total ?? 0, onChange: setPage, showSizeChanger: false }}
        locale={{ emptyText: 'No gift cards yet' }}
        columns={[
          { title: 'Code', dataIndex: 'code', render: (v, row) => <Flex vertical><Typography.Text copyable className="tabular">{v}</Typography.Text>{row.batchNote ? <Typography.Text type="secondary" style={{ fontSize: 11 }}>{row.batchNote}</Typography.Text> : null}</Flex> },
          { title: 'Value', dataIndex: 'amountPaise', align: 'right', render: (v) => <MoneyText paise={v} /> },
          { title: 'Status', dataIndex: 'status', render: (v) => <Tag color={STATUS[v]}>{v === 'ACTIVE' ? 'Unused' : v === 'REDEEMED' ? 'Redeemed' : 'Blocked'}</Tag> },
          { title: 'Expires', dataIndex: 'expiresAt', render: (v) => <DateText value={v} variant="date" /> },
          { title: 'Redeemed', dataIndex: 'redeemedAt', render: (v) => <DateText value={v} /> },
          { title: '', align: 'right', render: (_, row) => row.status === 'ACTIVE' && <Button size="small" danger loading={block.isPending} onClick={() => block.mutate(row.id)}>Block</Button> },
        ]}
      />

      <Modal title="Generate gift cards" open={creating} okText="Generate" confirmLoading={generate.isPending} onCancel={() => setCreating(false)} destroyOnClose
        onOk={() => form.validateFields().then((values) => generate.mutate(values)).catch(() => {})}>
        <Form form={form} layout="vertical" initialValues={{ count: 10 }}>
          <Form.Item name="count" label="How many" rules={[{ required: true }]}><InputNumber min={1} max={500} /></Form.Item>
          <Form.Item name="rupees" label="Value of each card" rules={[{ required: true, message: 'Enter a value.' }]}><InputNumber min={1} max={100000} addonBefore="₹" style={{ width: 200 }} /></Form.Item>
          <Form.Item name="expiresAt" label="Valid until" rules={[{ required: true, message: 'Pick an expiry date.' }]}><DatePicker disabledDate={(d) => d.isBefore(new Date(), 'day')} /></Form.Item>
          <Form.Item name="note" label="Batch note (optional)"><Input maxLength={120} placeholder="e.g. Diwali giveaway" /></Form.Item>
        </Form>
      </Modal>

      <Modal title={`${made?.length ?? 0} gift cards created`} open={Boolean(made)} onCancel={() => setMade(null)} footer={<Button type="primary" onClick={() => made && download(made)}>Download CSV</Button>}>
        <Typography.Paragraph type="warning">The PINs are shown only now and are not stored in readable form. Download the file before closing.</Typography.Paragraph>
        <Table size="small" rowKey="code" pagination={{ pageSize: 8, size: 'small' }} dataSource={made ?? []} columns={[{ title: 'Code', dataIndex: 'code' }, { title: 'PIN', dataIndex: 'pin' }]} />
      </Modal>
    </Flex>
  );
}
