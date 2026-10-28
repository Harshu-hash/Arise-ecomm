import { Card, Drawer, Flex, Tag, Typography } from 'antd';
import { useState } from 'react';
import DataTable from '@ui/components/DataTable/DataTable';
import DateText from '@ui/components/DateText';
import MoneyText from '@ui/components/MoneyText';
import PageHeader from '@ui/components/PageHeader';
import useListQuery from '@ui/hooks/useListQuery';
import useUrlTableState from '@ui/hooks/useUrlTableState';
import SettlementBreakdown from '../components/SettlementBreakdown';
import { financeKeys } from '../api/finance.api';

const STATUS_TAG = { UPCOMING: ['gold', 'Upcoming'], SETTLED: ['green', 'Settled'], ON_HOLD: ['default', 'On hold'] };

const columns = [
  { key: 'orderId', title: 'Order', dataIndex: 'orderId', priority: 1, render: (v, r) => (
    <div><Typography.Text strong>{v}</Typography.Text><div><Typography.Text type="secondary" style={{ fontSize: 12 }} ellipsis>{r.productTitle}</Typography.Text></div></div>
  ) },
  { key: 'deliveredAt', title: 'Delivered', dataIndex: 'deliveredAt', width: 120, render: (v) => <DateText value={v} /> },
  { key: 'salePaise', title: 'Sale', dataIndex: 'salePaise', align: 'right', width: 110, sorter: true, render: (p) => <MoneyText paise={p} /> },
  { key: 'feesBeforeTaxPaise', title: 'Fees', dataIndex: 'feesBeforeTaxPaise', align: 'right', width: 110, render: (p) => <MoneyText paise={-p} type="danger" signed /> },
  { key: 'netPaise', title: 'Net', dataIndex: 'netPaise', align: 'right', width: 120, sorter: true, render: (p) => <MoneyText paise={p} strong type={p < 0 ? 'danger' : undefined} /> },
  { key: 'status', title: 'Status', dataIndex: 'status', width: 130, render: (s, r) => {
    const [color, label] = STATUS_TAG[s] ?? ['default', s];
    return <Flex vertical gap={2}><Tag color={color} style={{ margin: 0 }}>{label}</Tag>{s === 'ON_HOLD' && r.holdReason && <Typography.Text type="secondary" style={{ fontSize: 11 }}>{r.holdReason}</Typography.Text>}</Flex>;
  } },
];

export default function TransactionsPage() {
  const state = useUrlTableState({ defaultSort: '-deliveredAt', defaultTab: 'all' });
  const [line, setLine] = useState(null);

  const { rows, meta, loading, error, refetch, fetching } = useListQuery({
    queryKey: financeKeys.transactions({ ...state.queryParams, tab: state.tab }),
    url: '/finance/transactions',
    params: { ...state.queryParams, ...(state.tab && state.tab !== 'all' ? { tab: state.tab } : {}) },
  });
  const counts = meta?.counts ?? {};

  const TABS = [
    { key: 'all', label: 'All' },
    { key: 'UPCOMING', label: 'Upcoming', count: counts.UPCOMING },
    { key: 'SETTLED', label: 'Settled', count: counts.SETTLED },
    { key: 'ON_HOLD', label: 'On hold', count: counts.ON_HOLD },
  ];

  return (
    <Flex vertical gap={12}>
      <PageHeader title="Transactions" breadcrumbs={[{ label: 'Payments' }, { label: 'Transactions' }]} subtitle="Every delivered order, with a full breakdown of what you earned on it." />
      <Card styles={{ body: { padding: 0 } }}>
        <DataTable
          tableId="seller-transactions"
          columns={columns}
          rows={rows}
          meta={meta}
          loading={loading || fetching}
          error={error}
          onRetry={refetch}
          tableState={state}
          tabs={TABS}
          onRowClick={(row) => setLine(row)}
          emptyProps={{ title: 'No transactions', description: 'Delivered orders and their settlement appear here.' }}
        />
      </Card>
      <Drawer title={line?.productTitle} open={Boolean(line)} onClose={() => setLine(null)} width={420}>
        {line && <SettlementBreakdown line={line} />}
      </Drawer>
    </Flex>
  );
}
