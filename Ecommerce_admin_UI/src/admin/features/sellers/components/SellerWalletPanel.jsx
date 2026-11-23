import { Alert, App, Button, Col, Flex, Form, Input, InputNumber, Modal, Radio, Row, Space, Table, Tag, Typography } from 'antd';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@core/api/axiosInstance';
import { queryClient } from '@core/api/queryClient';
import { formatINR } from '@core/utils/money';
import DateText from '@ui/components/DateText';
import MoneyText from '@ui/components/MoneyText';
import StatCard from '@ui/components/StatCard';
import { financeApi } from '../../finance/api/finance.api';

const ENTRY_LABEL = {
  EARNING: 'Delivered order',
  RELEASE: 'Released to available',
  RETURN_REVERSAL: 'Returned item taken back',
  WITHDRAWAL_LOCK: 'Withdrawal requested',
  WITHDRAWAL_UNLOCK: 'Withdrawal returned',
  WITHDRAWAL_PAID: 'Withdrawal paid',
  ADJUSTMENT: 'Manual adjustment',
};

/** One seller's wallet for the admin: balances, ledger, the payout hold and manual credits or debits. */
export default function SellerWalletPanel({ seller }) {
  const { message } = App.useApp();
  const [page, setPage] = useState(1);
  const [holding, setHolding] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const wallet = useQuery({ queryKey: ['finance', 'seller-wallet', seller.id], queryFn: () => api.get(`/seller-wallets/${seller.id}`).then((r) => r.data) });
  const ledger = useQuery({ queryKey: ['finance', 'seller-wallet', seller.id, 'ledger', page], queryFn: () => api.get(`/seller-wallets/${seller.id}/transactions`, { page, pageSize: 10 }) });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['finance'] });
    queryClient.invalidateQueries({ queryKey: ['sellers'] });
  };
  const hold = useMutation({
    mutationFn: (values) => financeApi.holdSellerPayouts(seller.id, { onHold: !seller.payoutOnHold, reason: values.reason }),
    onSuccess: () => { refresh(); setHolding(false); message.success(seller.payoutOnHold ? 'Withdrawals resumed.' : 'Withdrawals are on hold.'); },
    onError: (e) => message.error(e.message),
  });
  const adjust = useMutation({
    mutationFn: (values) => financeApi.adjustWallet(seller.id, { amountPaise: Math.round(values.rupees * 100) * (values.direction === 'DEBIT' ? -1 : 1), reason: values.reason }),
    onSuccess: () => { refresh(); setAdjusting(false); message.success('Wallet adjusted.'); },
    onError: (e) => message.error(e.message),
  });

  const w = wallet.data ?? {};
  return (
    <Flex vertical gap={12}>
      {seller.payoutOnHold ? <Alert type="warning" showIcon message="Withdrawals are on hold for this seller" description="They keep earning, but cannot request, be approved for, or be paid a withdrawal until the hold is released." /> : null}
      {w.availablePaise < 0 ? <Alert type="error" showIcon message="Negative balance" description="A refund after withdrawal left this seller owing Arise. New earnings will cover it." /> : null}

      <Row gutter={[12, 12]}>
        <Col xs={12} md={6}><StatCard label="Available" valuePaise={w.availablePaise} format="money" loading={wallet.isLoading} extra={w.reservePaise > 0 ? <Typography.Text type="secondary" style={{ fontSize: 12 }}>{formatINR(w.reservePaise)} reserve</Typography.Text> : null} /></Col>
        <Col xs={12} md={6}><StatCard label="Pending" valuePaise={w.pendingPaise} format="money" loading={wallet.isLoading} /></Col>
        <Col xs={12} md={6}><StatCard label="In withdrawal" valuePaise={w.lockedPaise} format="money" loading={wallet.isLoading} /></Col>
        <Col xs={12} md={6}><StatCard label="Withdrawn so far" valuePaise={w.lifetimeWithdrawnPaise} format="money" loading={wallet.isLoading} /></Col>
      </Row>

      <Space>
        <Button onClick={() => setAdjusting(true)}>Adjust balance</Button>
        <Button danger={!seller.payoutOnHold} onClick={() => setHolding(true)}>{seller.payoutOnHold ? 'Release withdrawal hold' : 'Hold withdrawals'}</Button>
      </Space>

      <Table
        size="small"
        rowKey="id"
        loading={ledger.isLoading}
        dataSource={ledger.data?.data ?? []}
        pagination={{ current: page, pageSize: 10, total: ledger.data?.meta?.total ?? 0, onChange: setPage, showSizeChanger: false }}
        columns={[
          { title: 'When', dataIndex: 'createdAt', render: (v) => <DateText value={v} variant="datetime" /> },
          { title: 'What', dataIndex: 'type', render: (v, row) => <div>{ENTRY_LABEL[v] ?? v}{row.note ? <div><Typography.Text type="secondary" style={{ fontSize: 11 }}>{row.orderNumber ? `${row.orderNumber} · ` : ''}{row.note}</Typography.Text></div> : null}</div> },
          { title: 'Balance', dataIndex: 'bucket', render: (v) => <Tag style={{ marginInlineEnd: 0 }}>{v}</Tag> },
          { title: 'Change', dataIndex: 'deltaPaise', align: 'right', render: (v) => <MoneyText paise={v} signed colorBySign strong /> },
        ]}
      />

      <ReasonModal
        open={holding}
        title={seller.payoutOnHold ? 'Release the withdrawal hold' : 'Hold this seller\'s withdrawals'}
        okText={seller.payoutOnHold ? 'Release hold' : 'Hold withdrawals'}
        danger={!seller.payoutOnHold}
        loading={hold.isPending}
        onCancel={() => setHolding(false)}
        onSubmit={(values) => hold.mutate(values)}
      />
      <AdjustModal open={adjusting} loading={adjust.isPending} onCancel={() => setAdjusting(false)} onSubmit={(values) => adjust.mutate(values)} />
    </Flex>
  );
}

function ReasonModal({ open, title, okText, danger, loading, onCancel, onSubmit }) {
  const [form] = Form.useForm();
  return (
    <Modal open={open} title={title} onCancel={onCancel} onOk={() => form.submit()} okText={okText} okButtonProps={{ danger, loading }} afterClose={() => form.resetFields()} destroyOnHidden>
      <Form form={form} layout="vertical" requiredMark={false} onFinish={onSubmit}>
        <Form.Item name="reason" label="Reason (kept in the audit log)" rules={[{ required: true, min: 3, message: 'A reason is required.' }]}><Input.TextArea rows={3} maxLength={500} showCount autoFocus /></Form.Item>
      </Form>
    </Modal>
  );
}

function AdjustModal({ open, loading, onCancel, onSubmit }) {
  const [form] = Form.useForm();
  return (
    <Modal open={open} title="Adjust available balance" onCancel={onCancel} onOk={() => form.submit()} okText="Apply adjustment" okButtonProps={{ loading }} afterClose={() => form.resetFields()} destroyOnHidden>
      <Form form={form} layout="vertical" requiredMark={false} initialValues={{ direction: 'CREDIT' }} onFinish={onSubmit}>
        <Form.Item name="direction" label="Type"><Radio.Group optionType="button" options={[{ value: 'CREDIT', label: 'Credit the seller' }, { value: 'DEBIT', label: 'Debit the seller' }]} /></Form.Item>
        <Form.Item name="rupees" label="Amount (₹)" rules={[{ required: true, message: 'Enter an amount.' }, { type: 'number', min: 0.01, message: 'Enter an amount above zero.' }]}><InputNumber style={{ width: '100%' }} precision={2} min={0} /></Form.Item>
        <Form.Item name="reason" label="Reason (the seller sees it in their wallet activity)" rules={[{ required: true, min: 3, message: 'A reason is required.' }]}><Input.TextArea rows={3} maxLength={500} showCount /></Form.Item>
      </Form>
    </Modal>
  );
}
