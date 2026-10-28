import { Card, Flex, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import DataTable from '@ui/components/DataTable/DataTable';
import DateText from '@ui/components/DateText';
import MoneyText from '@ui/components/MoneyText';
import PageHeader from '@ui/components/PageHeader';
import StatusTag from '@ui/components/StatusTag';
import useListQuery from '@ui/hooks/useListQuery';
import useUrlTableState from '@ui/hooks/useUrlTableState';
import { financeKeys } from '../api/finance.api';

const columns = [
  { key: 'periodEnd', title: 'Payout period', dataIndex: 'periodEnd', priority: 1, render: (end, r) => (
    <div><Typography.Text strong><DateText value={r.periodStart} /> – <DateText value={end} /></Typography.Text><div><Typography.Text type="secondary" style={{ fontSize: 12 }}>{r.id} · {r.lineCount} orders</Typography.Text></div></div>
  ) },
  { key: 'grossPaise', title: 'Gross', dataIndex: 'grossPaise', align: 'right', width: 120, render: (p) => <MoneyText paise={p} /> },
  { key: 'netPaise', title: 'Net paid', dataIndex: 'netPaise', align: 'right', width: 130, sorter: true, render: (p, r) => <MoneyText paise={p} strong type={r.carriedForward ? 'danger' : undefined} /> },
  { key: 'status', title: 'Status', dataIndex: 'status', width: 150, render: (s, r) => (
    <Flex vertical gap={2}>
      <StatusTag domain="sellerPayout" code={s} />
      {r.utr && <Typography.Text type="secondary" style={{ fontSize: 11 }}>UTR {r.utr}</Typography.Text>}
    </Flex>
  ) },
];

export default function SettlementsPage() {
  const navigate = useNavigate();
  const state = useUrlTableState({ defaultSort: '-periodEnd' });
  const { rows, meta, loading, error, refetch, fetching } = useListQuery({
    queryKey: financeKeys.payouts(state.queryParams),
    url: '/finance/payouts',
    params: state.queryParams,
  });

  return (
    <Flex vertical gap={12}>
      <PageHeader title="Settlements" breadcrumbs={[{ label: 'Payments' }, { label: 'Settlements' }]} subtitle="Your weekly payout, one row per batch. Open a payout to see exactly how it was calculated." />
      <Card styles={{ body: { padding: 0 } }}>
        <DataTable
          tableId="seller-payouts"
          columns={columns}
          rows={rows}
          meta={meta}
          loading={loading || fetching}
          error={error}
          onRetry={refetch}
          tableState={state}
          onRowClick={(row) => navigate(`/payments/settlements/${row.id}`)}
          emptyProps={{ title: 'No payouts yet', description: 'Once orders are delivered and settled, your payouts appear here.' }}
        />
      </Card>
    </Flex>
  );
}
