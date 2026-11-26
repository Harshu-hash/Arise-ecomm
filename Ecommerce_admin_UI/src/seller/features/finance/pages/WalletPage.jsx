import { App, Alert, Button, Col, Flex, Form, InputNumber, Modal, Popconfirm, Row, Segmented, Tag, Typography } from 'antd';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { queryClient } from '@core/api/queryClient';
import { formatINR } from '@core/utils/money';
import DataTable from '@ui/components/DataTable/DataTable';
import DateText from '@ui/components/DateText';
import ErrorState from '@ui/components/ErrorState';
import MoneyText from '@ui/components/MoneyText';
import PageHeader from '@ui/components/PageHeader';
import StatCard from '@ui/components/StatCard';
import useListQuery from '@ui/hooks/useListQuery';
import useUrlTableState from '@ui/hooks/useUrlTableState';
import { financeApi, financeKeys } from '../api/finance.api';

const WITHDRAWAL_STATUS = {
  REQUESTED: ['Waiting for approval', 'gold'],
  APPROVED: ['Approved, transfer pending', 'blue'],
  PAID: ['Paid', 'green'],
  REJECTED: ['Rejected', 'red'],
  CANCELLED: ['Cancelled', undefined],
};

const ENTRY_LABEL = {
  EARNING: 'Delivered order',
  RELEASE: 'Released to available',
  RETURN_REVERSAL: 'Returned item taken back',
  WITHDRAWAL_LOCK: 'Withdrawal requested',
  WITHDRAWAL_UNLOCK: 'Withdrawal returned',
  WITHDRAWAL_PAID: 'Withdrawal paid',
  ADJUSTMENT: 'Adjustment by Arise',
};
const BUCKET_LABEL = { pending: 'Pending', available: 'Available', locked: 'In withdrawal' };

/**
 * The seller's wallet. Money from a delivered order arrives as pending, becomes available once the return window closes, and is
 * withdrawn by request: Arise approves each request and transfers it to the verified bank account.
 */
export default function WalletPage() {
  const { message } = App.useApp();
  const [view, setView] = useState('withdrawals');
  const [asking, setAsking] = useState(false);
  const wallet = useQuery({ queryKey: financeKeys.wallet, queryFn: financeApi.wallet });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['seller', 'finance'] });
  const cancel = useMutation({
    mutationFn: (id) => financeApi.cancelWithdrawal(id),
    onSuccess: () => { invalidate(); message.success('Withdrawal cancelled. The money is back in your available balance.'); },
    onError: (e) => message.error(e.message),
  });

  if (wallet.isError) return <ErrorState error={wallet.error} onRetry={wallet.refetch} title="Could not load your wallet" />;
  const w = wallet.data ?? {};

  return (
    <Flex vertical gap={16}>
      <PageHeader
        title="Wallet"
        breadcrumbs={[{ label: 'Payments' }, { label: 'Wallet' }]}
        subtitle="Money from delivered orders is pending until the return window closes, then available to withdraw."
        actions={<Button type="primary" disabled={!w.canWithdraw} onClick={() => setAsking(true)}>Withdraw</Button>}
      />

      {w.blockedReason ? <Alert type="warning" showIcon message={w.blockedReason} /> : null}
      {w.availablePaise < 0 ? (
        <Alert type="error" showIcon message="Your available balance is negative" description="A returned item was refunded after you had withdrawn its money. New earnings will cover it before you can withdraw again." />
      ) : null}

      <Row gutter={[12, 12]}>
        <Col xs={12} md={6}><StatCard label="Available to withdraw" valuePaise={w.withdrawablePaise} format="money" loading={wallet.isLoading} extra={w.reservePaise > 0 ? <Typography.Text type="secondary" style={{ fontSize: 12 }}>{formatINR(w.reservePaise)} kept in reserve</Typography.Text> : null} /></Col>
        <Col xs={12} md={6}><StatCard label="Pending" valuePaise={w.pendingPaise} format="money" loading={wallet.isLoading} extra={<Typography.Text type="secondary" style={{ fontSize: 12 }}>In the return window</Typography.Text>} /></Col>
        <Col xs={12} md={6}><StatCard label="In withdrawal" valuePaise={w.lockedPaise} format="money" loading={wallet.isLoading} /></Col>
        <Col xs={12} md={6}><StatCard label="Withdrawn so far" valuePaise={w.lifetimeWithdrawnPaise} format="money" loading={wallet.isLoading} /></Col>
      </Row>

      <Segmented value={view} onChange={setView} options={[{ value: 'withdrawals', label: 'Withdrawals' }, { value: 'activity', label: 'Wallet activity' }]} />
      {view === 'withdrawals' ? <WithdrawalsTable onCancel={(id) => cancel.mutate(id)} cancelling={cancel.isPending} /> : <ActivityTable />}

      <WithdrawModal open={asking} wallet={w} onClose={() => setAsking(false)} onDone={() => { setAsking(false); invalidate(); }} />
    </Flex>
  );
}

function WithdrawalsTable({ onCancel, cancelling }) {
  const state = useUrlTableState({ defaultSort: '', defaultPageSize: 10 });
  const { rows, meta, loading, error, refetch, fetching } = useListQuery({ queryKey: financeKeys.withdrawals(state.queryParams), url: '/finance/withdrawals', params: state.queryParams });
  const cancelButton = (row) => (row.status === 'REQUESTED' ? (
    <Popconfirm title="Cancel this withdrawal?" description="The money goes back to your available balance." okText="Cancel withdrawal" cancelText="Keep" onConfirm={() => onCancel(row.id)}>
      <Button size="small" loading={cancelling}>Cancel</Button>
    </Popconfirm>
  ) : null);
  const columns = [
    { key: 'number', title: 'Request', dataIndex: 'number', alwaysVisible: true, render: (v, row) => <div><Typography.Text strong className="mono" style={{ fontSize: 12 }}>{v}</Typography.Text><div><DateText value={row.requestedAt} variant="datetime" /></div></div> },
    { key: 'amountPaise', title: 'Amount', dataIndex: 'amountPaise', align: 'right', render: (v) => <MoneyText paise={v} strong /> },
    { key: 'bank', title: 'To account', priority: 2, render: (_v, row) => <Typography.Text style={{ fontSize: 12 }}>{row.bank.bankName ?? 'Bank'} {row.bank.maskedAccount}</Typography.Text> },
    {
      key: 'status', title: 'Status', dataIndex: 'status',
      render: (v, row) => {
        const [label, color] = WITHDRAWAL_STATUS[v] ?? [v];
        return (
          <Flex vertical gap={2} align="flex-start">
            <Tag color={color} style={{ marginInlineEnd: 0 }}>{label}</Tag>
            {v === 'PAID' ? <Typography.Text type="secondary" style={{ fontSize: 11 }}>Transaction {row.txnNo}</Typography.Text> : null}
            {v === 'REJECTED' && row.decisionReason ? <Typography.Text type="danger" style={{ fontSize: 11 }}>{row.decisionReason}</Typography.Text> : null}
          </Flex>
        );
      },
    },
    {
      key: 'actions', title: '', align: 'right',
      render: (_v, row) => cancelButton(row),
    },
  ];
  const card = (row) => {
    const [label, color] = WITHDRAWAL_STATUS[row.status] ?? [row.status];
    return (
      <Flex vertical gap={6}>
        <Flex wrap justify="space-between" gap={8}>
          <Typography.Text className="mono" strong style={{ fontSize: 12 }}>{row.number}</Typography.Text>
          <MoneyText paise={row.amountPaise} strong />
        </Flex>
        <Tag color={color} style={{ marginInlineEnd: 0, alignSelf: 'flex-start' }}>{label}</Tag>
        {cancelButton(row)}
      </Flex>
    );
  };
  return <DataTable tableId="seller-withdrawals" columns={columns} rows={rows} meta={meta} loading={loading || fetching} error={error} onRetry={refetch} tableState={state} emptyProps={{ title: 'No withdrawals yet' }} mobileCard={card} />;
}

function ActivityTable() {
  const state = useUrlTableState({ defaultSort: '', defaultPageSize: 25 });
  const { rows, meta, loading, error, refetch, fetching } = useListQuery({ queryKey: financeKeys.walletActivity(state.queryParams), url: '/finance/wallet/transactions', params: state.queryParams });
  const columns = [
    { key: 'createdAt', title: 'When', dataIndex: 'createdAt', alwaysVisible: true, render: (v) => <DateText value={v} variant="datetime" /> },
    { key: 'type', title: 'What', dataIndex: 'type', render: (v, row) => <div><Typography.Text style={{ fontSize: 13 }}>{ENTRY_LABEL[v] ?? v}</Typography.Text>{row.note ? <div><Typography.Text type="secondary" style={{ fontSize: 11 }}>{row.orderNumber ? `${row.orderNumber} · ` : ''}{row.note}</Typography.Text></div> : null}</div> },
    { key: 'bucket', title: 'Balance', dataIndex: 'bucket', priority: 2, render: (v) => <Tag style={{ marginInlineEnd: 0 }}>{BUCKET_LABEL[v] ?? v}</Tag> },
    { key: 'deltaPaise', title: 'Change', dataIndex: 'deltaPaise', align: 'right', render: (v) => <MoneyText paise={v} signed colorBySign strong /> },
  ];
  return <DataTable tableId="seller-wallet-activity" columns={columns} rows={rows} meta={meta} loading={loading || fetching} error={error} onRetry={refetch} tableState={state} emptyProps={{ title: 'No wallet activity yet' }} />;
}

function WithdrawModal({ open, wallet, onClose, onDone }) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const limits = wallet.limits ?? {};
  const ceiling = Math.min(wallet.withdrawablePaise ?? 0, limits.maxWithdrawalPaise ?? Infinity);
  const ask = useMutation({
    mutationFn: ({ rupees }) => financeApi.requestWithdrawal({ amountPaise: Math.round(rupees * 100) }),
    onSuccess: () => { form.resetFields(); message.success('Withdrawal requested. Arise will review it and transfer the money.'); onDone(); },
    onError: (e) => message.error(e.message),
  });

  return (
    <Modal open={open} title="Withdraw to your bank account" onCancel={onClose} onOk={() => form.submit()} okText="Request withdrawal" okButtonProps={{ loading: ask.isPending }} destroyOnHidden>
      <Flex vertical gap={12}>
        <Typography.Text type="secondary">
          To account ending {wallet.bank?.last4 ?? '••••'}. You can withdraw between {formatINR(limits.minWithdrawalPaise)} and {formatINR(ceiling)} now
          {limits.dailyWithdrawalLimitPaise > 0 ? `, up to ${formatINR(limits.dailyWithdrawalLimitPaise)} a day` : ''}. Every request is reviewed by Arise.
        </Typography.Text>
        <Form form={form} layout="vertical" requiredMark={false} onFinish={ask.mutate}>
          <Form.Item name="rupees" label="Amount (₹)" rules={[
            { required: true, message: 'Enter an amount.' },
            { type: 'number', min: (limits.minWithdrawalPaise ?? 0) / 100, message: `The smallest withdrawal is ${formatINR(limits.minWithdrawalPaise)}.` },
            { type: 'number', max: ceiling / 100, message: `You can withdraw at most ${formatINR(ceiling)} right now.` },
          ]}>
            <InputNumber style={{ width: '100%' }} min={0} precision={2} autoFocus />
          </Form.Item>
        </Form>
      </Flex>
    </Modal>
  );
}
