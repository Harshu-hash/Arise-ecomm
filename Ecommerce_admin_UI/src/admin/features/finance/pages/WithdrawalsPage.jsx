import { App, Button, Col, Flex, Form, Input, Modal, Row, Space, Tag, Typography } from 'antd';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { queryClient } from '@core/api/queryClient';
import CopyableId from '@ui/components/CopyableId';
import DataTable from '@ui/components/DataTable/DataTable';
import DateText from '@ui/components/DateText';
import MoneyText from '@ui/components/MoneyText';
import PageHeader from '@ui/components/PageHeader';
import StatCard from '@ui/components/StatCard';
import useListQuery from '@ui/hooks/useListQuery';
import useUrlTableState from '@ui/hooks/useUrlTableState';
import { financeApi, financeKeys } from '../api/finance.api';

const STATUS = {
  REQUESTED: ['Needs approval', 'gold'],
  APPROVED: ['Approved: transfer', 'blue'],
  PAID: ['Paid', 'green'],
  REJECTED: ['Rejected', 'red'],
  CANCELLED: ['Cancelled by seller', undefined],
};

/**
 * Seller withdrawal requests. Every request is approved by hand, then paid by bank transfer with the transaction number recorded.
 * The amount is already locked in the seller's wallet, so rejecting returns it.
 */
export default function WithdrawalsPage() {
  const { message, modal } = App.useApp();
  const state = useUrlTableState({ defaultSort: '-requestedAt', defaultPageSize: 25 });
  const [paying, setPaying] = useState(null);
  const [rejecting, setRejecting] = useState(null);

  const summary = useQuery({ queryKey: financeKeys.settlementSummary, queryFn: () => financeApi.settlementSummary().then((r) => r.data) });
  const { rows, meta, loading, error, refetch, fetching } = useListQuery({
    queryKey: financeKeys.withdrawals({ ...state.queryParams, tab: state.tab }),
    url: '/withdrawals',
    params: { ...state.queryParams, ...(state.tab && state.tab !== 'all' ? { status: state.tab } : {}) },
  });
  const done = (text) => () => { queryClient.invalidateQueries({ queryKey: ['finance'] }); setPaying(null); setRejecting(null); message.success(text); };
  const fail = (e) => message.error(e.message);

  const approve = useMutation({ mutationFn: (id) => financeApi.approveWithdrawal(id), onSuccess: done('Withdrawal approved. Transfer the money, then record it as paid.'), onError: fail });
  const reject = useMutation({ mutationFn: ({ id, reason }) => financeApi.rejectWithdrawal(id, { reason }), onSuccess: done('Withdrawal rejected. The amount is back in the seller\'s wallet.'), onError: fail });
  const pay = useMutation({ mutationFn: ({ id, ...body }) => financeApi.payWithdrawal(id, body), onSuccess: done('Marked as paid. The seller has been told.'), onError: fail });

  const s = summary.data ?? {};
  const askApprove = (row) => modal.confirm({
    title: `Approve ${row.number}?`,
    content: <Typography.Text>Approve <MoneyText paise={row.amountPaise} strong /> for {row.sellerName} to {row.bank.bankName ?? 'bank'} {row.bank.maskedAccount} ({row.bank.holder}). You will transfer it next.</Typography.Text>,
    okText: 'Approve',
    onOk: () => approve.mutateAsync(row.id).catch(() => {}),
  });

  const actions = (row) => (
    <Space size={4} wrap>
      {row.allowedActions?.includes('APPROVE') ? <Button size="small" type="primary" onClick={() => askApprove(row)}>Approve</Button> : null}
      {row.allowedActions?.includes('PAY') ? <Button size="small" type="primary" onClick={() => setPaying(row)}>Record payment</Button> : null}
      {row.allowedActions?.includes('REJECT') ? <Button size="small" danger onClick={() => setRejecting(row)}>Reject</Button> : null}
    </Space>
  );

  const columns = [
    { key: 'number', title: 'Request', dataIndex: 'number', alwaysVisible: true, render: (v) => <CopyableId value={v} /> },
    { key: 'sellerName', title: 'Seller', dataIndex: 'sellerName', priority: 1 },
    { key: 'amountPaise', title: 'Amount', dataIndex: 'amountPaise', sorter: true, align: 'right', render: (v) => <MoneyText paise={v} strong /> },
    {
      key: 'bank', title: 'Pay to', priority: 2,
      render: (_v, row) => (
        <div>
          <Typography.Text style={{ fontSize: 13 }}>{row.bank.holder}</Typography.Text>
          <div><Typography.Text type="secondary" className="mono" style={{ fontSize: 11 }}>{row.bank.bankName ?? 'Bank'} {row.bank.maskedAccount} · {row.bank.ifsc}</Typography.Text></div>
        </div>
      ),
    },
    { key: 'requestedAt', title: 'Requested', dataIndex: 'requestedAt', sorter: true, priority: 2, render: (v) => <DateText value={v} variant="datetime" /> },
    {
      key: 'status', title: 'Status', dataIndex: 'status',
      render: (v, row) => {
        const [label, color] = STATUS[v] ?? [v];
        return (
          <Flex vertical gap={2} align="flex-start">
            <Tag color={color} style={{ marginInlineEnd: 0 }}>{label}</Tag>
            {v === 'PAID' ? <Typography.Text type="secondary" className="mono" style={{ fontSize: 10 }}>{row.txnNo}</Typography.Text> : null}
            {v === 'REJECTED' && row.decisionReason ? <Typography.Text type="danger" style={{ fontSize: 11 }}>{row.decisionReason}</Typography.Text> : null}
          </Flex>
        );
      },
    },
    {
      key: 'actions', title: '', align: 'right', alwaysVisible: true,
      render: (_v, row) => actions(row),
    },
  ];

  return (
    <Flex vertical gap={12}>
      <PageHeader
        title="Seller withdrawals"
        breadcrumbs={[{ label: 'Finance' }, { label: 'Withdrawals' }]}
        subtitle="Approve each request, transfer the money from the bank, then record the transaction number."
      />

      <Row gutter={[12, 12]}>
        <Col xs={12} md={6}><StatCard label="Needs approval" valuePaise={s.requestedPaise} format="money" loading={summary.isLoading} extra={count(s.requestedCount)} /></Col>
        <Col xs={12} md={6}><StatCard label="Approved, to transfer" valuePaise={s.approvedPaise} format="money" loading={summary.isLoading} extra={count(s.approvedCount)} /></Col>
        <Col xs={12} md={6}><StatCard label="Available in seller wallets" valuePaise={s.availablePaise} format="money" loading={summary.isLoading} /></Col>
        <Col xs={12} md={6}><StatCard label="Owed to sellers (all)" valuePaise={s.owedToSellersPaise} format="money" loading={summary.isLoading} /></Col>
      </Row>

      <DataTable
        tableId="withdrawals"
        columns={columns}
        rows={rows}
        meta={meta}
        loading={loading || fetching}
        error={error}
        onRetry={refetch}
        tableState={state}
        tabs={[
          { key: 'all', label: 'All' },
          { key: 'REQUESTED', label: 'Needs approval' },
          { key: 'APPROVED', label: 'To transfer' },
          { key: 'PAID', label: 'Paid' },
          { key: 'REJECTED', label: 'Rejected' },
        ]}
        emptyProps={{ title: 'No withdrawals here' }}
        mobileCard={(row) => (
          <Flex vertical gap={6}>
            <Flex justify="space-between" gap={8}>
              <Typography.Text className="mono" strong style={{ fontSize: 12 }}>{row.number}</Typography.Text>
              <MoneyText paise={row.amountPaise} strong />
            </Flex>
            <Typography.Text style={{ fontSize: 12 }}>{row.sellerName} · {row.bank.bankName ?? 'Bank'} {row.bank.maskedAccount}</Typography.Text>
            <Tag color={(STATUS[row.status] ?? [])[1]} style={{ marginInlineEnd: 0, alignSelf: 'flex-start' }}>{(STATUS[row.status] ?? [row.status])[0]}</Tag>
            {actions(row)}
          </Flex>
        )}
      />

      <PayModal row={paying} loading={pay.isPending} onCancel={() => setPaying(null)} onSubmit={(values) => pay.mutate({ id: paying.id, ...values })} />
      <RejectModal row={rejecting} loading={reject.isPending} onCancel={() => setRejecting(null)} onSubmit={(values) => reject.mutate({ id: rejecting.id, ...values })} />
    </Flex>
  );
}

const count = (n) => <span style={{ fontSize: 12, color: 'var(--ant-color-text-secondary)' }}>{n ?? 0} request{n === 1 ? '' : 's'}</span>;

function PayModal({ row, loading, onCancel, onSubmit }) {
  const [form] = Form.useForm();
  return (
    <Modal open={Boolean(row)} title={row ? `Record payment · ${row.number}` : ''} onCancel={onCancel} onOk={() => form.submit()} okText="Mark as paid" okButtonProps={{ loading }} afterClose={() => form.resetFields()} destroyOnHidden>
      {row && (
        <Flex vertical gap={12}>
          <Typography.Text>
            Transfer <MoneyText paise={row.amountPaise} strong /> to <b>{row.bank.holder}</b>, {row.bank.bankName ?? 'bank'} {row.bank.maskedAccount} (IFSC {row.bank.ifsc}). Then record the transaction number here.
          </Typography.Text>
          <Form form={form} layout="vertical" requiredMark={false} onFinish={onSubmit}>
            <Form.Item name="txnNo" label="Bank / UPI transaction number" rules={[{ required: true, min: 4, message: 'Enter the transaction number.' }]}><Input maxLength={60} autoFocus /></Form.Item>
            <Form.Item name="utr" label="UTR (optional)"><Input maxLength={40} /></Form.Item>
          </Form>
        </Flex>
      )}
    </Modal>
  );
}

function RejectModal({ row, loading, onCancel, onSubmit }) {
  const [form] = Form.useForm();
  return (
    <Modal open={Boolean(row)} title={row ? `Reject ${row.number}` : ''} onCancel={onCancel} onOk={() => form.submit()} okText="Reject" okButtonProps={{ danger: true, loading }} afterClose={() => form.resetFields()} destroyOnHidden>
      <Form form={form} layout="vertical" requiredMark={false} onFinish={onSubmit}>
        <Form.Item name="reason" label="Reason (the seller sees this)" rules={[{ required: true, min: 3, message: 'Tell the seller why.' }]}><Input.TextArea rows={3} maxLength={500} showCount autoFocus /></Form.Item>
      </Form>
    </Modal>
  );
}
