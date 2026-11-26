import { Flex, Typography } from 'antd';
import DataTable from '@ui/components/DataTable/DataTable';
import DateText from '@ui/components/DateText';
import FilterBar from '@ui/components/FilterBar';
import PageHeader from '@ui/components/PageHeader';
import useListQuery from '@ui/hooks/useListQuery';
import useUrlTableState from '@ui/hooks/useUrlTableState';

export default function AriseRatingsPage() {
  const state = useUrlTableState({ defaultSort: '-ratedAt' });
  const { rows, meta, loading, fetching, error, refetch } = useListQuery({
    queryKey: ['ariseRatings', state.queryParams],
    url: '/arise-ratings',
    params: state.queryParams,
  });
  const columns = [
    {
      key: 'customerName', title: 'Customer', dataIndex: 'customerName', alwaysVisible: true,
      render: (value, row) => <Flex vertical><Typography.Text strong>{value}</Typography.Text><Typography.Text type="secondary" copyable={{ text: row.customerId }}>{row.customerId}</Typography.Text></Flex>,
    },
    {
      key: 'rating', title: 'Rating', dataIndex: 'rating', sorter: true, priority: 1,
      render: (value) => <Typography.Text style={{ color: '#f59e0b', fontSize: 18 }}>{'★'.repeat(value)}<span style={{ color: '#555' }}>{'★'.repeat(5 - value)}</span></Typography.Text>,
    },
    { key: 'ratedAt', title: 'Rated', dataIndex: 'ratedAt', sorter: true, priority: 1, render: (value) => <DateText value={value} /> },
  ];

  return (
    <Flex vertical gap={12}>
      <PageHeader
        title="Arise ratings"
        breadcrumbs={[{ label: 'Support' }, { label: 'Arise ratings' }]}
        subtitle="Ratings customers submit from the Rate Us page in their account."
      />
      <FilterBar
        schema={[{ key: 'rating', label: 'Stars', kind: 'select', options: [5, 4, 3, 2, 1].map((value) => ({ value, label: `${value} stars` })) }]}
        tableState={state}
      />
      <DataTable
        tableId="ariseRatings"
        columns={columns}
        rows={rows}
        meta={meta}
        loading={loading || fetching}
        error={error}
        onRetry={refetch}
        tableState={state}
        emptyProps={{ title: 'No Arise ratings yet', description: 'Customer ratings appear here after submission.' }}
      />
    </Flex>
  );
}
