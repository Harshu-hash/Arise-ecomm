import { Alert, Button, Card, Descriptions, Drawer, Flex, Input, InputNumber, Modal, Select, Space, Tag, Timeline, Typography, message } from 'antd';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import DataTable from '@ui/components/DataTable/DataTable';
import DateText from '@ui/components/DateText';
import DocumentUpload from '@ui/components/DocumentUpload';
import DateRangeCompare from '@ui/components/DateRangeCompare';
import MoneyText from '@ui/components/MoneyText';
import PageHeader from '@ui/components/PageHeader';
import useListQuery from '@ui/hooks/useListQuery';
import useUrlTableState from '@ui/hooks/useUrlTableState';
import { financeApi, financeKeys } from '../api/finance.api';

const statusColor = { MATCHED: 'green', UNMATCHED: 'gold', ON_HOLD: 'default', FAILED: 'red', ADJUSTED: 'blue' };

export default function ReconciliationPage() {
  const state = useUrlTableState({ defaultSort: '-deliveredAt', defaultTab: 'all' });
  const queryClient = useQueryClient();
  const [range, setRange] = useState({ from: '2020-01-01T00:00:00.000Z', to: '2030-12-31T23:59:59.999Z', compare: false });
  const [line, setLine] = useState(null);
  const [disputing, setDisputing] = useState(false);
  const [reasonCode, setReasonCode] = useState('OTHER_DEDUCTION');
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState(null);
  const [evidence, setEvidence] = useState([]);
  const params = { ...state.queryParams, ...(state.tab !== 'all' ? { status: state.tab } : {}), ...(range?.from ? { from: range.from.slice(0, 10), to: range.to.slice(0, 10), compare: range.compare } : {}) };
  const { rows, meta, loading, error, refetch, fetching } = useListQuery({ queryKey: financeKeys.reconciliation(params), url: '/finance/reconciliation', params });
  const dispute = useMutation({ mutationFn: () => financeApi.disputeLine(line.id, { reasonCode, reason, disputedPaise: amount, evidenceMediaIds: evidence.map((item) => item.mediaId) }), onSuccess: () => { message.success('Deduction dispute submitted for admin review.'); setDisputing(false); setLine(null); queryClient.invalidateQueries({ queryKey: ['seller', 'finance', 'reconciliation'] }); }, onError: (e) => message.error(e?.message ?? 'Could not submit dispute.') });
  const columns = [
    { key: 'orderId', title: 'Order / item', dataIndex: 'orderId', priority: 1, render: (v, r) => <div><Typography.Text strong>{v}</Typography.Text><div><Typography.Text type="secondary">{r.productTitle}</Typography.Text></div></div> },
    { key: 'deliveredAt', title: 'Delivered', dataIndex: 'deliveredAt', width: 120, render: (v) => <DateText value={v} /> },
    { key: 'netPaise', title: 'Net', dataIndex: 'netPaise', align: 'right', sorter: true, width: 110, render: (v) => <MoneyText paise={v} strong /> },
    { key: 'payout', title: 'Payout / UTR', width: 190, render: (_, r) => r.payout ? <div>{r.payout.id}<div><Typography.Text type="secondary">{r.payout.utr ?? r.payout.bankTransfer?.utrStatus}</Typography.Text></div></div> : 'Not yet assigned' },
    { key: 'status', title: 'Match', dataIndex: 'status', width: 120, render: (v) => <Tag color={statusColor[v]}>{v.replace('_', ' ')}</Tag> },
  ];
  const tabs = ['all', 'MATCHED', 'UNMATCHED', 'ON_HOLD', 'FAILED', 'ADJUSTED'].map((key) => ({ key, label: key === 'all' ? 'All' : key.replace('_', ' '), count: meta?.counts?.[key] }));
  return <Flex vertical gap={12}>
    <PageHeader title="Reconciliation" breadcrumbs={[{ label: 'Payments' }, { label: 'Reconciliation' }]} subtitle="Trace each order, return, refund, weight correction and adjustment through to its bank transfer." />
    <Card size="small"><Space wrap><Typography.Text strong>Settlement period</Typography.Text><DateRangeCompare value={range} onChange={setRange} /></Space></Card>
    <Card styles={{ body: { padding: 0 } }}><DataTable tableId="seller-reconciliation" columns={columns} rows={rows} meta={meta} loading={loading || fetching} error={error} onRetry={refetch} tableState={state} tabs={tabs} savedViews exportJob={{ resource: 'finance-reconciliation', label: 'Export reconciliation', filters: { from: params.from, to: params.to, compare: params.compare } }} exportPerm="exports.job.create" onRowClick={setLine} emptyProps={{ title: 'Nothing to reconcile', description: 'Settlement traces appear after an order is delivered.' }} /></Card>
    <Drawer title={`Trace ${line?.orderId ?? ''}`} open={Boolean(line)} onClose={() => setLine(null)} width={520} extra={<Button disabled={!line} onClick={() => { setAmount(Math.max(1, line?.feesBeforeTaxPaise ?? 1)); setDisputing(true); }}>Dispute deduction</Button>}>
      {line && <Space direction="vertical" size={16} style={{ width: '100%' }}>
        {line.status === 'ON_HOLD' && <Alert type="warning" showIcon message={line.holdReason} description={line.requiredAction} />}
        {line.payout?.status === 'FAILED' && <Alert type="error" showIcon message={line.payout.bankTransfer?.failureReason} description={line.payout.bankTransfer?.correctionAction?.label} />}
        <Descriptions size="small" column={1} bordered items={[{ key: 'net', label: 'Order net', children: <MoneyText paise={line.netPaise} strong /> }, { key: 'payout', label: 'Payout', children: line.payout?.id ?? 'Unmatched' }, { key: 'utr', label: 'UTR state', children: line.payout?.utr ?? line.payout?.bankTransfer?.utrStatus ?? 'Awaiting payout' }, { key: 'bank', label: 'Bank', children: line.payout?.bankTransfer?.maskedAccount ?? '—' }]} />
        <Timeline items={(line.trace ?? []).map((event) => ({ children: <div><Typography.Text strong>{event.type.replaceAll('_', ' ')}</Typography.Text> · {event.id}<div><DateText value={event.at} withTime />{event.amountPaise != null && <> · <MoneyText paise={event.amountPaise} signed /></>}</div></div> }))} />
      </Space>}
    </Drawer>
    <Modal title="Dispute a settlement deduction" open={disputing} onCancel={() => setDisputing(false)} onOk={() => dispute.mutate()} okText="Submit dispute" confirmLoading={dispute.isPending} okButtonProps={{ disabled: !reason.trim() || !amount || !evidence.length }}>
      <Space direction="vertical" style={{ width: '100%' }}><Select style={{ width: '100%' }} value={reasonCode} onChange={setReasonCode} options={[{ value: 'COMMISSION_INCORRECT', label: 'Commission is incorrect' }, { value: 'WEIGHT_FEE_INCORRECT', label: 'Weight/shipping fee is incorrect' }, { value: 'RETURN_DEDUCTION_INCORRECT', label: 'Return/refund deduction is incorrect' }, { value: 'OTHER_DEDUCTION', label: 'Other deduction' }]} /><InputNumber style={{ width: '100%' }} min={1} precision={0} addonBefore="Paise" value={amount} onChange={setAmount} /><Input.TextArea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explain the discrepancy" /><DocumentUpload value={evidence} onChange={setEvidence} maxCount={5} label="Reconciliation evidence" /></Space>
    </Modal>
  </Flex>;
}
