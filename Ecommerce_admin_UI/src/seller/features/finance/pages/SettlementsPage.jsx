import { Flex, Modal, Tag, Tooltip, Typography } from 'antd';
import { useState } from 'react';
import { formatDate } from '@core/utils/date';
import { formatINR } from '@core/utils/money';
import DataTable from '@ui/components/DataTable/DataTable';
import MoneyText from '@ui/components/MoneyText';
import PageHeader from '@ui/components/PageHeader';
import useListQuery from '@ui/hooks/useListQuery';
import useUrlTableState from '@ui/hooks/useUrlTableState';
import { financeKeys } from '../api/finance.api';

// Where one item's money stands. The old per-item payout words (WINDOW_OPEN, READY...) are still mapped so the mock backend reads sensibly.
const STATE_LABEL = {
  PENDING: ['Pending', 'gold'],
  HELD: ['On hold', 'red'],
  AVAILABLE: ['In your wallet', 'green'],
  REVERSED: ['Returned', undefined],
  WINDOW_OPEN: ['Pending', 'gold'],
  READY: ['In your wallet', 'green'],
  REVIEWED: ['In your wallet', 'green'],
  SETTLED: ['Paid', 'green'],
  PAYING: ['Paying', 'cyan'],
  FAILED: ['Payout failed', 'volcano'],
};

function stateTag(row) {
  const [label, color] = STATE_LABEL[row.state] ?? [row.state];
  const tag = <Tag color={color} style={{ marginInlineEnd: 0 }}>{label}</Tag>;
  return row.holdReason ? <Tooltip title={row.holdReason}>{tag}</Tooltip> : tag;
}

const releaseOf = (row) => row.releaseAt ?? row.returnWindowEndsAt;

function releaseCell(row) {
  if (row.releasedAt || row.reversedAt || row.settled) return <Typography.Text type="secondary">—</Typography.Text>;
  const at = releaseOf(row);
  if (!at) return <Typography.Text type="secondary" style={{ fontSize: 12 }}>—</Typography.Text>;
  const waiting = new Date(at).getTime() > Date.now();
  return waiting ? (
    <Tooltip title={`Moves to your wallet on ${formatDate(at)}`}>
      <Typography.Text type="warning" style={{ fontSize: 12 }}>{formatDate(at)}</Typography.Text>
    </Tooltip>
  ) : <Typography.Text type="success" style={{ fontSize: 12 }}>Due</Typography.Text>;
}

/**
 * The seller's earnings, one line per delivered item (read only). Money moves through the Wallet: each line shows what it was worth
 * after fees and taxes, and when it becomes available to withdraw.
 */
export default function SettlementsPage() {
  const state = useUrlTableState({ defaultSort: '-deliveredAt', defaultPageSize: 25 });
  const [open, setOpen] = useState(null);

  const { rows, meta, loading, error, refetch, fetching } = useListQuery({
    queryKey: financeKeys.settlements(state.queryParams),
    url: '/settlements/mine',
    params: state.queryParams,
  });

  const columns = [
    {
      key: 'line', title: 'Order item', dataIndex: 'productTitle', alwaysVisible: true,
      render: (title, row) => (
        <div>
          <Typography.Link strong style={{ fontSize: 13 }} onClick={() => setOpen(row)}>{title}</Typography.Link>
          <div><Typography.Text type="secondary" style={{ fontSize: 11 }}>{row.orderId}{row.sku ? ` · ${row.sku}` : ''}</Typography.Text></div>
        </div>
      ),
    },
    { key: 'deliveredAt', title: 'Delivered', dataIndex: 'deliveredAt', sorter: true, priority: 2, render: (v) => (v ? formatDate(v) : '—') },
    { key: 'release', title: 'Available from', priority: 2, render: (_v, row) => releaseCell(row) },
    { key: 'salePaise', title: 'Sale', dataIndex: 'salePaise', align: 'right', priority: 3, render: (p) => <MoneyText paise={p} /> },
    { key: 'netPaise', title: 'You earn', dataIndex: 'netPaise', align: 'right', sorter: true, render: (p, row) => <MoneyText paise={p} strong type={row.state === 'REVERSED' ? undefined : 'success'} /> },
    { key: 'state', title: 'Status', dataIndex: 'state', render: (_v, row) => stateTag(row) },
  ];

  return (
    <Flex vertical gap={16}>
      <PageHeader
        title="Earnings by item"
        breadcrumbs={[{ label: 'Payments' }, { label: 'Earnings' }]}
        subtitle="One line per delivered item. Its money is pending until the return window closes, then it moves to your wallet."
      />

      <DataTable
        tableId="seller-settlements"
        columns={columns}
        rows={rows}
        meta={meta}
        loading={loading || fetching}
        error={error}
        onRetry={refetch}
        tableState={state}
        emptyProps={{ title: 'No delivered items yet' }}
      />

      <BreakdownModal row={open} onClose={() => setOpen(null)} />
    </Flex>
  );
}

function BreakdownModal({ row, onClose }) {
  return (
    <Modal open={Boolean(row)} onCancel={onClose} footer={null} title={row ? `${row.productTitle}` : ''} destroyOnHidden>
      {row && (
        <Flex vertical gap={10}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {row.orderId} · delivered {formatDate(row.deliveredAt)}{row.paymentMethod ? ` · ${row.paymentMethod}` : ''}
          </Typography.Text>
          <Line k="Item sale value" v={formatINR(row.salePaise)} />
          <Line k={`Commission${row.commissionPct != null ? ` (${row.commissionPct}%)` : ''}`} v={`−${formatINR(row.commissionPaise)}`} danger />
          {row.closingFeePaise > 0 ? <Line k="Closing fee" v={`−${formatINR(row.closingFeePaise)}`} danger /> : null}
          {row.collectionFeePaise > 0 ? <Line k="Payment collection fee" v={`−${formatINR(row.collectionFeePaise)}`} danger /> : null}
          <Line k="GST on fees" v={`−${formatINR(row.gstOnFeesPaise)}`} danger />
          <Line k="TCS + TDS" v={`−${formatINR((row.tcsPaise ?? 0) + (row.tdsPaise ?? 0))}`} danger />
          <div style={{ borderTop: '1px solid var(--ant-color-border-secondary)', paddingTop: 8 }}>
            <Line k="You earn" v={formatINR(row.netPaise)} strong success />
          </div>
          {row.holdReason ? <Typography.Text type="danger" style={{ fontSize: 12 }}>{row.holdReason}</Typography.Text> : null}
        </Flex>
      )}
    </Modal>
  );
}

function Line({ k, v, danger, success, strong }) {
  return (
    <Flex justify="space-between">
      <Typography.Text type="secondary">{k}</Typography.Text>
      <Typography.Text strong={strong} type={danger ? 'danger' : success ? 'success' : undefined} className="tabular">{v}</Typography.Text>
    </Flex>
  );
}
