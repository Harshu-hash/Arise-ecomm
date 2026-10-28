import { Card, Flex, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import DataTable from '@ui/components/DataTable/DataTable';
import MoneyText from '@ui/components/MoneyText';
import PageHeader from '@ui/components/PageHeader';
import DateText from '@ui/components/DateText';
import useListQuery from '@ui/hooks/useListQuery';
import useUrlTableState from '@ui/hooks/useUrlTableState';
import { orderKeys } from '../api/orders.api';

const columns = [
  { key: 'orderId', title: 'Order', dataIndex: 'orderId', render: (v, r) => <div><Typography.Text strong>{v}</Typography.Text><div><Typography.Text type="secondary" style={{ fontSize: 12 }}><DateText value={r.placedAt} /> · {r.city ?? '—'}</Typography.Text></div></div> },
  { key: 'itemCount', title: 'Items', dataIndex: 'itemCount', width: 80, align: 'center', render: (_, r) => r.items.length },
  { key: 'totalPaise', title: 'Value', dataIndex: 'totalPaise', align: 'right', width: 120, render: (p) => <MoneyText paise={p} /> },
];

export default function CancellationsPage() {
  const navigate = useNavigate();
  const state = useUrlTableState({ defaultSort: '-placedAt' });

  const { rows, meta, loading, error, refetch, fetching } = useListQuery({
    queryKey: orderKeys.list({ cancellations: true, ...state.queryParams }),
    url: '/orders',
    params: { ...state.queryParams, stage: 'CANCELLED' },
  });

  return (
    <Flex vertical gap={12}>
      <PageHeader
        title="Cancellations"
        breadcrumbs={[{ label: 'Orders' }, { label: 'Cancellations' }]}
        subtitle="Orders cancelled by you, the customer or Arise. High cancellation rates hurt account health."
      />
      <Card styles={{ body: { padding: 0 } }}>
        <DataTable
          tableId="seller-cancellations"
          columns={columns}
          rows={rows}
          meta={meta}
          loading={loading || fetching}
          error={error}
          onRetry={refetch}
          tableState={state}
          onRowClick={(row) => navigate(`/orders/${row.id}`)}
          emptyProps={{ title: 'No cancellations', description: 'Good news — none of your orders have been cancelled.' }}
        />
      </Card>
    </Flex>
  );
}
