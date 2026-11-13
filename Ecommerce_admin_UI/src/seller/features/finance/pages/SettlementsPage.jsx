import { Flex, Modal, Tag, Tooltip, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { formatDate } from '@core/utils/date';
import { formatINR } from '@core/utils/money';
import DataTable from '@ui/components/DataTable/DataTable';
import MoneyText from '@ui/components/MoneyText';
import PageHeader from '@ui/components/PageHeader';
import useListQuery from '@ui/hooks/useListQuery';
import useUrlTableState from '@ui/hooks/useUrlTableState';
import { financeApi, financeKeys } from '../api/finance.api';

const STATE_LABEL = {
  WINDOW_OPEN: ['In return window', 'gold'],
  HELD: ['On hold', 'red'],
  READY: ['Awaiting payout', 'blue'],
  REVIEWED: ['Awaiting payout', 'blue'],
  PAYING: ['Paying', 'cyan'],
  SETTLED: ['Settled', 'green'],
  FAILED: ['Payout failed', 'volcano'],
};

function stateTag(state) {
  const [label, color] = STATE_LABEL[state] ?? [state, 'default'];
  return <Tag color={color === 'default' ? undefined : color} style={{ marginInlineEnd: 0 }}>{label}</Tag>;
}

function windowCell(row) {
  if (row.settled) return <Typography.Text type="secondary">—</Typography.Text>;
  if (!row.returnWindowEndsAt) return <Typography.Text type="secondary" style={{ fontSize: 12 }}>—</Typography.Text>;
  const open = new Date(row.returnWindowEndsAt).getTime() > Date.now();
  return open ? (
    <Tooltip title={`Closes ${formatDate(row.returnWindowEndsAt)}`}>
      <Typography.Text type="warning" style={{ fontSize: 12 }}>Open · {row.returnWindowDays}d</Typography.Text>
    </Tooltip>
  ) : (
    <Typography.Text type="success" style={{ fontSize: 12 }}>Closed</Typography.Text>
  );
}

/**
 * The seller's own per-order-item settlements. Each delivered item shows what
 * it was quoted, what was settled (red until paid, green after), where the
 * return window stands, and the settlement invoice once paid.
 */
export default function SettlementsPage() {
  const state = useUrlTableState({ defaultSort: '-deliveredAt', defaultPageSize: 25 });
  const [invoiceId, setInvoiceId] = useState(null);

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
          <Typography.Text strong style={{ fontSize: 13 }}>{title}</Typography.Text>
          <div><Typography.Text type="secondary" style={{ fontSize: 11 }}>{row.orderId}{row.sku ? ` · ${row.sku}` : ''}</Typography.Text></div>
        </div>
      ),
    },
    { key: 'deliveredAt', title: 'Delivered', dataIndex: 'deliveredAt', sorter: true, priority: 2, render: (v) => (v ? formatDate(v) : '—') },
    { key: 'window', title: 'Return window', priority: 2, render: (_v, row) => windowCell(row) },
    { key: 'quotedPaise', title: 'Quoted', dataIndex: 'quotedPaise', align: 'right', render: (p) => <MoneyText paise={p} /> },
    {
      key: 'settledPaise', title: 'Settled', dataIndex: 'settledPaise', align: 'right', sorter: true,
      render: (p, row) => <MoneyText paise={p} strong type={row.settled ? 'success' : 'danger'} />,
    },
    { key: 'state', title: 'Status', dataIndex: 'state', render: stateTag },
    {
      key: 'invoice', title: 'Invoice', align: 'right', priority: 2,
      render: (_v, row) => (row.settled ? (
        <Typography.Link onClick={() => setInvoiceId(row.id)}>{row.invoiceNo || 'View'}</Typography.Link>
      ) : <Typography.Text type="secondary">—</Typography.Text>),
    },
  ];

  return (
    <Flex vertical gap={16}>
      <PageHeader
        title="My settlements"
        breadcrumbs={[{ label: 'Payments' }, { label: 'Settlements' }]}
        subtitle="One line per delivered item. You're paid once its return window closes — amounts are red until settled, then green."
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
        emptyProps={{ title: 'No settlements yet' }}
      />

      <InvoiceModal lineId={invoiceId} open={Boolean(invoiceId)} onClose={() => setInvoiceId(null)} />
    </Flex>
  );
}

function InvoiceModal({ lineId, open, onClose }) {
  const { data } = useQuery({
    queryKey: financeKeys.settlementInvoice(lineId),
    queryFn: () => financeApi.settlementInvoice(lineId),
    enabled: open && Boolean(lineId),
  });

  return (
    <Modal open={open} onCancel={onClose} footer={null} title={data ? `Settlement invoice · ${data.invoiceNo}` : 'Settlement invoice'} destroyOnHidden>
      {data && (
        <Flex vertical gap={10}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {data.productTitle} · {data.orderId}{data.paidAt ? ` · paid ${formatDate(data.paidAt)}` : ''}
          </Typography.Text>
          <Row k="Item sale value" v={formatINR(data.money?.salePaise)} />
          <Row k="Commission" v={`−${formatINR(data.money?.commissionPaise)}`} danger />
          <Row k="Fees" v={`−${formatINR(data.money?.feesBeforeTaxPaise)}`} danger />
          <Row k="GST on fees" v={`−${formatINR(data.money?.gstOnFeesPaise)}`} danger />
          <Row k="TCS + TDS" v={`−${formatINR((data.money?.tcsPaise ?? 0) + (data.money?.tdsPaise ?? 0))}`} danger />
          <Row k="Seller quoted (net)" v={formatINR(data.quotedPaise)} strong />
          {data.deductionsTotalPaise > 0 && <Row k="Issue deductions" v={`−${formatINR(data.deductionsTotalPaise)}`} danger />}
          <div style={{ borderTop: '1px solid var(--ant-color-border-secondary)', paddingTop: 8 }}>
            <Row k="Settled amount" v={formatINR(data.settledPaise)} strong success />
          </div>
          {data.bulkRef ? <Row k="Bulk reference" v={data.bulkRef} /> : null}
          {data.txnNo ? <Row k="Txn" v={data.txnNo} /> : null}
          {data.utr ? <Row k="UTR" v={data.utr} /> : null}
        </Flex>
      )}
    </Modal>
  );
}

function Row({ k, v, danger, success, strong }) {
  return (
    <Flex justify="space-between">
      <Typography.Text type="secondary" style={{ fontSize: 13 }}>{k}</Typography.Text>
      <Typography.Text
        strong={strong}
        className="tabular"
        style={{ fontSize: 13, color: danger ? 'var(--ant-color-error)' : success ? 'var(--ant-color-success)' : undefined }}
      >
        {v}
      </Typography.Text>
    </Flex>
  );
}
