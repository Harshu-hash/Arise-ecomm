import { Avatar, Flex, Space, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import DataTable from '@ui/components/DataTable/DataTable';
import DateText from '@ui/components/DateText';
import MoneyText from '@ui/components/MoneyText';
import PageHeader from '@ui/components/PageHeader';
import StatusTag from '@ui/components/StatusTag';
import useListQuery from '@ui/hooks/useListQuery';
import useUrlTableState from '@ui/hooks/useUrlTableState';
import { returnKeys } from '../api/returns.api';

const columns = [
  {
    key: 'productName', title: 'Item', dataIndex: 'productName', priority: 1,
    render: (name, r) => (
      <Flex gap={10} align="center" style={{ minWidth: 0 }}>
        <Avatar shape="square" src={r.image} style={{ background: '#f0f0f0', flexShrink: 0 }}>{name?.[0]}</Avatar>
        <div style={{ minWidth: 0 }}>
          <Typography.Text strong ellipsis style={{ display: 'block', maxWidth: 280 }}>{name}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>{r.orderId} · {r.reason}</Typography.Text>
        </div>
      </Flex>
    ),
  },
  { key: 'type', title: 'Type', dataIndex: 'type', width: 120, render: (t) => <Tag color={t === 'REPLACEMENT' ? 'blue' : 'default'}>{t}</Tag> },
  { key: 'amountPaise', title: 'Value', dataIndex: 'amountPaise', align: 'right', width: 110, render: (p) => <MoneyText paise={p} /> },
  { key: 'status', title: 'Status', dataIndex: 'status', width: 160, render: (s, r) => (
    <Flex gap={6} align="center">
      <StatusTag domain="returnRequest" code={s} />
      {r.fulfillmentType === 'ARISE' && <Tag color="geekblue" style={{ margin: 0 }}>By Arise</Tag>}
    </Flex>
  ) },
  { key: 'requestedAt', title: 'Requested', dataIndex: 'requestedAt', width: 130, render: (v) => <DateText value={v} /> },
];

export default function ReturnsPage() {
  const navigate = useNavigate();
  const state = useUrlTableState({ defaultSort: '-requestedAt', defaultTab: 'REQUESTED' });

  const { rows, meta, loading, error, refetch, fetching } = useListQuery({
    queryKey: returnKeys.list({ ...state.queryParams, tab: state.tab }),
    url: '/returns',
    params: { ...state.queryParams, ...(state.tab && state.tab !== 'all' ? { stage: state.tab } : {}) },
  });

  const counts = meta?.counts ?? {};
  const TABS = [
    { key: 'REQUESTED', label: 'Needs decision', count: counts.REQUESTED },
    { key: 'IN_PROGRESS', label: 'In progress', count: counts.IN_PROGRESS },
    { key: 'COMPLETED', label: 'Completed', count: counts.COMPLETED },
  ];

  return (
    <Flex vertical gap={12}>
      <PageHeader
        title="Returns & Replacements"
        breadcrumbs={[{ label: 'Orders' }, { label: 'Returns' }]}
        subtitle="Approve or reject return requests, track reverse pickups and QC returned items."
        tags={counts.REQUESTED > 0 && <Tag color="gold">{counts.REQUESTED} awaiting your decision</Tag>}
      />
      <DataTable
        tableId="seller-returns"
        columns={columns}
        rows={rows}
        meta={meta}
        loading={loading || fetching}
        error={error}
        onRetry={refetch}
        tableState={state}
        tabs={TABS}
        onRowClick={(row) => navigate(`/returns/${row.id}`)}
        emptyProps={{ title: 'No returns here', description: 'Return requests from customers will appear here.' }}
        mobileCard={(row) => (
          <Flex vertical gap={6}>
            <Flex justify="space-between" align="flex-start" gap={8}>
              <div style={{ minWidth: 0 }}><Typography.Text strong>{row.productName}</Typography.Text><div><Typography.Text type="secondary" style={{ fontSize: 12 }}>{row.orderId}</Typography.Text></div></div>
              <StatusTag domain="returnRequest" code={row.status} />
            </Flex>
            <Space size={8} wrap><MoneyText paise={row.amountPaise} strong /><Tag>{row.type}</Tag></Space>
          </Flex>
        )}
      />
    </Flex>
  );
}
