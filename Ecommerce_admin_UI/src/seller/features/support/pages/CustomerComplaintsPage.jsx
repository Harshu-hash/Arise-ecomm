import { Flex, Space, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import DataTable from '@ui/components/DataTable/DataTable';
import DateText from '@ui/components/DateText';
import FilterBar from '@ui/components/FilterBar';
import PageHeader from '@ui/components/PageHeader';
import StatusTag from '@ui/components/StatusTag';
import useListQuery from '@ui/hooks/useListQuery';
import useUrlTableState from '@ui/hooks/useUrlTableState';
import { supportKeys } from '../api/support.api';

export default function CustomerComplaintsPage() {
  const navigate = useNavigate();
  const state = useUrlTableState({ defaultSort: '-createdAt' });
  const { rows, meta, loading, fetching, error, refetch } = useListQuery({
    queryKey: supportKeys.customerComplaints(state.queryParams),
    url: '/support/customer-complaints',
    params: state.queryParams,
  });
  const columns = [
    { key: 'subject', title: 'Complaint', dataIndex: 'subject', priority: 1, render: (value, row) => <div><Typography.Text strong>{value}</Typography.Text><div><Typography.Text className="mono" type="secondary">{row.id}</Typography.Text></div></div> },
    { key: 'customerName', title: 'Customer', dataIndex: 'customerName', priority: 1 },
    { key: 'orderId', title: 'Order', dataIndex: 'orderId', priority: 2, render: (value) => <Typography.Text className="mono">{value}</Typography.Text> },
    { key: 'products', title: 'Your products', dataIndex: 'products', priority: 3, render: (items) => <Typography.Text ellipsis style={{ maxWidth: 240 }}>{items.join(', ')}</Typography.Text> },
    { key: 'priority', title: 'Priority', dataIndex: 'priority', priority: 2, render: (value) => <Tag color={value === 'HIGH' ? 'red' : value === 'MEDIUM' ? 'gold' : 'default'}>{value}</Tag> },
    { key: 'status', title: 'Status', dataIndex: 'status', priority: 1, render: (value) => <StatusTag domain="ticket" code={value} /> },
    { key: 'createdAt', title: 'Raised', dataIndex: 'createdAt', sorter: true, priority: 2, render: (value) => <DateText value={value} /> },
  ];
  return (
    <Flex vertical gap={12}>
      <PageHeader title="Customer complaints" breadcrumbs={[{ label: 'Support' }, { label: 'Customer complaints' }]} subtitle="Review and resolve complaints for orders containing products sold by your store." />
      <FilterBar schema={[
        { key: 'status', label: 'Status', kind: 'multiSelect', options: ['NEW', 'OPEN', 'PENDING_CUSTOMER', 'PENDING_INTERNAL', 'RESOLVED', 'CLOSED'].map((value) => ({ value, label: value.replaceAll('_', ' ') })) },
        { key: 'priority', label: 'Priority', kind: 'select', options: ['LOW', 'MEDIUM', 'HIGH'].map((value) => ({ value, label: value })) },
      ]} tableState={state} searchPlaceholder="Search complaint, customer or order" />
      <DataTable tableId="seller-customer-complaints" columns={columns} rows={rows} meta={meta} loading={loading || fetching} error={error} onRetry={refetch} tableState={state} onRowClick={(row) => navigate(`/support/customer-complaints/${row.id}`)} emptyProps={{ title: 'No customer complaints', description: 'Complaints linked to your fulfilled orders will appear here.' }} mobileCard={(row) => <Flex vertical gap={5}><Flex justify="space-between"><Typography.Text strong>{row.subject}</Typography.Text><StatusTag domain="ticket" code={row.status} /></Flex><Typography.Text type="secondary">{row.customerName} · {row.orderId}</Typography.Text><Space><Tag>{row.priority}</Tag><DateText value={row.createdAt} /></Space></Flex>} />
    </Flex>
  );
}
