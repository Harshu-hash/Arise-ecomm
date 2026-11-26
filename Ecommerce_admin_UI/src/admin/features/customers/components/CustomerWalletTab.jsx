import { App, Button, Flex, Form, Input, InputNumber, Modal, Segmented, Table, Tag, Typography } from 'antd';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@core/api/axiosInstance';
import { queryClient } from '@core/api/queryClient';
import DateText from '@ui/components/DateText';
import ErrorState from '@ui/components/ErrorState';
import MoneyText from '@ui/components/MoneyText';

const key = (id) => ['customers', 'wallet', id];

/** A customer's store credit: balance, the full ledger, and a manual credit/debit (over the admin's limit it goes to another admin to approve). */
export default function CustomerWalletTab({ customerId }) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [open, setOpen] = useState(false);
  const [freezing, setFreezing] = useState(false);
  const [why, setWhy] = useState('');
  const [page, setPage] = useState(1);
  const PAGE = 20;
  const wallet = useQuery({ queryKey: [...key(customerId), page], queryFn: () => api.get(`/customer-wallets/${customerId}`, { cursor: (page - 1) * PAGE, limit: PAGE }) });

  const adjust = useMutation({
    mutationFn: ({ direction, rupees, reason }) => api.post(`/customer-wallets/${customerId}/adjustments`, { amountPaise: Math.round(rupees * 100) * (direction === 'DEBIT' ? -1 : 1), reason }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: key(customerId) });
      setOpen(false);
      form.resetFields();
      if (res?.data?.approvalRequired) message.info('That is over your limit: sent to another admin for approval (System > Approvals).');
      else message.success('Wallet updated');
    },
    onError: (e) => message.error(e.message),
  });

  const freeze = useMutation({
    mutationFn: ({ frozen, reason }) => api.post(`/customer-wallets/${customerId}/freeze`, { frozen, reason }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: key(customerId) }); setFreezing(false); setWhy(''); message.success('Wallet updated'); },
    onError: (e) => message.error(e.message),
  });

  if (wallet.isError) return <ErrorState error={wallet.error} onRetry={wallet.refetch} />;
  const data = wallet.data?.data;

  return (
    <Flex vertical gap={12}>
      <Flex justify="space-between" align="center">
        <Flex vertical>
          <Typography.Text type="secondary">Spendable balance</Typography.Text>
          <Typography.Title level={3} style={{ margin: 0 }}><MoneyText paise={data?.balancePaise ?? 0} /></Typography.Title>
        </Flex>
        <Flex gap={8} align="center">
          {data?.frozen && <Tag color="red">Frozen{data.frozenReason ? `: ${data.frozenReason}` : ''}</Tag>}
          <Button danger={!data?.frozen} onClick={() => (data?.frozen ? freeze.mutate({ frozen: false, reason: 'Unfrozen by admin' }) : setFreezing(true))}>{data?.frozen ? 'Unfreeze' : 'Freeze spending'}</Button>
          <Button type="primary" onClick={() => setOpen(true)}>Adjust balance</Button>
        </Flex>
      </Flex>
      <Table
        size="small"
        rowKey="id"
        loading={wallet.isLoading}
        dataSource={data?.items ?? []}
        pagination={{ current: page, pageSize: PAGE, total: data?.total ?? 0, onChange: setPage, showSizeChanger: false }}
        locale={{ emptyText: 'No wallet activity yet' }}
        columns={[
          { title: 'When', dataIndex: 'occurredAt', render: (v) => <DateText value={v} /> },
          { title: 'What', dataIndex: 'title', render: (v, row) => <Flex vertical><Typography.Text>{v}</Typography.Text>{row.reference ? <Typography.Text type="secondary" style={{ fontSize: 11 }}>{row.reference}</Typography.Text> : null}</Flex> },
          { title: 'Type', dataIndex: 'type', render: (v) => <Tag>{v.replace(/_/g, ' ')}</Tag> },
          { title: 'Amount', dataIndex: 'amountPaise', align: 'right', render: (v, row) => <MoneyText paise={row.direction === 'DEBIT' ? -v : v} signed colorBySign /> },
          { title: 'Balance after', dataIndex: 'balanceAfterPaise', align: 'right', render: (v) => <MoneyText paise={v} /> },
        ]}
      />
      <Modal title="Freeze spending from this wallet?" open={freezing} okText="Freeze" okButtonProps={{ danger: true, disabled: why.trim().length < 3, loading: freeze.isPending }} onOk={() => freeze.mutate({ frozen: true, reason: why.trim() })} onCancel={() => setFreezing(false)}>
        <Typography.Paragraph type="secondary">The customer cannot spend their credit at checkout. Refunds and rewards still arrive. You can still make adjustments.</Typography.Paragraph>
        <Input.TextArea rows={3} maxLength={300} placeholder="Reason (kept in the audit log)" value={why} onChange={(e) => setWhy(e.target.value)} />
      </Modal>
      <Modal
        title="Adjust wallet balance"
        open={open}
        okText="Apply"
        confirmLoading={adjust.isPending}
        onOk={() => form.validateFields().then((values) => adjust.mutate(values)).catch(() => {})}
        onCancel={() => setOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={{ direction: 'CREDIT' }}>
          <Form.Item name="direction" label="Action"><Segmented options={[{ label: 'Add credit', value: 'CREDIT' }, { label: 'Remove credit', value: 'DEBIT' }]} /></Form.Item>
          <Form.Item name="rupees" label="Amount" rules={[{ required: true, message: 'Enter an amount.' }]}><InputNumber min={1} max={100000} addonBefore="₹" style={{ width: 200 }} /></Form.Item>
          <Form.Item name="reason" label="Reason (kept in the audit log, shown to the customer)" rules={[{ required: true, min: 3, message: 'Give a reason.' }]}><Input.TextArea rows={3} maxLength={500} /></Form.Item>
        </Form>
      </Modal>
    </Flex>
  );
}
