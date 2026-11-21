import { Flex, Space, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import DataTable from '@ui/components/DataTable/DataTable';
import DateText from '@ui/components/DateText';
import FilterBar from '@ui/components/FilterBar';
import MaskedValue from '@ui/components/MaskedValue';
import PageHeader from '@ui/components/PageHeader';
import useListQuery from '@ui/hooks/useListQuery';
import useUrlTableState from '@ui/hooks/useUrlTableState';
import { customerKeys } from '@admin/features/orders/api/orders.api';

export default function CustomersListPage() {
  const navigate = useNavigate();
  const state = useUrlTableState({ defaultSort: '-joinedAt' });

  const { rows, meta, loading, error, refetch, fetching } = useListQuery({
    queryKey: customerKeys.list({ ...state.queryParams, tab: state.tab }),
    url: '/customers',
    params: { ...state.queryParams, ...(state.tab ? { status: state.tab } : {}) },
  });

  const columns = [
    {
      key: 'name', title: 'Customer', dataIndex: 'name', sorter: true, alwaysVisible: true,
      render: (name, row) => (
        <div style={{ minWidth: 0 }}>
          <Space size={6}>
            <Typography.Text strong style={{ fontSize: 13 }}>{name}</Typography.Text>
            {row.status === 'BLOCKED' && <Tag color="red" style={{ marginInlineEnd: 0 }}>Blocked</Tag>}
            {row.status === 'DELETED' && <Tag style={{ marginInlineEnd: 0 }}>Deleted</Tag>}
          </Space>
          <div>
            <MaskedValue value={row.phone} kind="phone" entityType="customer" entityId={row.id} entityLabel={name} />
          </div>
        </div>
      ),
    },
    {
      key: 'email', title: 'Email', dataIndex: 'email', priority: 2,
      render: (v, row) => <MaskedValue value={v} kind="email" entityType="customer" entityId={row.id} entityLabel={row.name} />,
    },
    {
      key: 'lastLoginAt', title: 'Last sign-in', dataIndex: 'lastLoginAt', sorter: true, priority: 2,
      render: (v) => (v ? <DateText value={v} /> : <Typography.Text type="secondary">Never</Typography.Text>),
    },
    {
      key: 'joinedAt', title: 'Joined', dataIndex: 'joinedAt', sorter: true, priority: 1,
      render: (v) => <DateText value={v} variant="date" />,
    },
  ];

  return (
    <Flex vertical gap={12}>
      <PageHeader
        title="Customers"
        breadcrumbs={[{ label: 'Customers' }, { label: 'All customers' }]}
        subtitle="Personal data is masked by default. Revealing it is logged against your name."
      />

      <FilterBar
        schema={[
          { key: 'joinedAt', label: 'Joined', kind: 'dateRange' },
        ]}
        tableState={state}
        searchPlaceholder="Search name, phone or email"
      />

      <DataTable
        tableId="customers"
        columns={columns}
        rows={rows}
        meta={meta}
        loading={loading || fetching}
        error={error}
        onRetry={refetch}
        tableState={state}
        tabs={[
          { key: 'all', label: 'All' },
          { key: 'ACTIVE', label: 'Active' },
          { key: 'BLOCKED', label: 'Blocked' },
          { key: 'DELETED', label: 'Deleted' },
        ]}
        onRowClick={(row) => navigate(`/customers/${row.id}`)}
        onExport={() => {}}
        exportPerm="customers.customer.export"
        emptyProps={{ title: 'No customers match' }}
        mobileCard={(row) => (
          <Flex vertical gap={4}>
            <Typography.Text strong>{row.name}</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>Joined <DateText value={row.joinedAt} variant="date" /></Typography.Text>
          </Flex>
        )}
      />
    </Flex>
  );
}
