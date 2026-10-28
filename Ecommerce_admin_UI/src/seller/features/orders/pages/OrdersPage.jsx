import { App, Flex, Space, Tag, Typography } from 'antd';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { statusOptions } from '@ui/constants/statusMaps';
import DataTable from '@ui/components/DataTable/DataTable';
import FilterBar from '@ui/components/FilterBar';
import MoneyText from '@ui/components/MoneyText';
import PageHeader from '@ui/components/PageHeader';
import StatusTag from '@ui/components/StatusTag';
import useListQuery from '@ui/hooks/useListQuery';
import useUrlTableState from '@ui/hooks/useUrlTableState';
import { ACTION_LABELS, orderKeys, ordersApi } from '../api/orders.api';
import { makeOrderColumns } from '../orderColumns';

export default function OrdersPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const state = useUrlTableState({ defaultSort: '-placedAt', defaultTab: 'NEW' });
  const [pendingId, setPendingId] = useState(null);

  const { rows, meta, loading, error, refetch, fetching } = useListQuery({
    queryKey: orderKeys.list({ ...state.queryParams, tab: state.tab }),
    url: '/orders',
    params: { ...state.queryParams, ...(state.tab && state.tab !== 'all' ? { stage: state.tab } : {}) },
  });

  const counts = meta?.counts ?? {};
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['seller', 'orders', 'list'] });

  const actionMut = useMutation({
    mutationFn: ({ id, action }) => ordersApi.action(id, action),
    onMutate: ({ id }) => setPendingId(id),
    onSuccess: (_d, { action }) => { message.success(`${ACTION_LABELS[action]} done.`); invalidate(); },
    onError: (e) => message.error(e?.message ?? 'Could not update the order.'),
    onSettled: () => setPendingId(null),
  });

  const bulkMut = useMutation({
    mutationFn: ({ action, ids }) => ordersApi.bulk(action, ids),
    onSuccess: (res, { action }) => {
      message.success(`${ACTION_LABELS[action]}: ${res.done} done${res.failed ? `, ${res.failed} skipped` : ''}.`);
      invalidate();
    },
    onError: (e) => message.error(e?.message ?? 'Bulk action failed.'),
  });

  const columns = makeOrderColumns({ onAction: (row, action) => actionMut.mutate({ id: row.id, action }), pendingId });

  const TABS = [
    { key: 'NEW', label: 'New', count: counts.NEW },
    { key: 'PROCESSING', label: 'To ship', count: counts.PROCESSING },
    { key: 'SHIPPED', label: 'Shipped', count: counts.SHIPPED },
    { key: 'DELIVERED', label: 'Delivered', count: counts.DELIVERED },
    { key: 'RTO', label: 'RTO', count: counts.RTO },
    { key: 'CANCELLED', label: 'Cancelled', count: counts.CANCELLED },
  ];

  return (
    <Flex vertical gap={12}>
      <PageHeader
        title="Orders"
        breadcrumbs={[{ label: 'Orders' }, { label: 'All Orders' }]}
        subtitle="Process new orders through to dispatch."
        tags={counts.breaching > 0 && <Tag color="red">{counts.breaching} overdue to dispatch</Tag>}
      />

      <FilterBar
        schema={[
          { key: 'status', label: 'Status', kind: 'multiSelect', options: statusOptions('orderItem'), width: 220 },
          {
            key: 'fulfillmentType', label: 'Fulfilment', kind: 'select', width: 170,
            options: [
              { value: 'SELLER', label: 'Self-ship' },
              { value: 'ARISE', label: 'Fulfilled by Arise' },
            ],
          },
          { key: 'slaBreached', label: 'Overdue only', kind: 'boolean' },
        ]}
        tableState={state}
        searchPlaceholder="Search order ID, AWB or customer"
      />

      <DataTable
        tableId="seller-orders"
        columns={columns}
        rows={rows}
        meta={meta}
        loading={loading || fetching}
        error={error}
        onRetry={refetch}
        tableState={state}
        tabs={TABS}
        onRowClick={(row) => navigate(`/orders/${row.id}`)}
        selection={{ getCheckboxProps: (row) => ({ disabled: row.fulfillmentType === 'ARISE' || !row.nextAction }) }}
        bulkActions={[
          { key: 'confirm', label: 'Confirm', perm: 'orders.order.process', onClick: ({ selectedKeys }) => bulkMut.mutate({ action: 'confirm', ids: selectedKeys }) },
          { key: 'pack', label: 'Pack & invoice', perm: 'orders.order.process', onClick: ({ selectedKeys }) => bulkMut.mutate({ action: 'pack', ids: selectedKeys }) },
          { key: 'manifest', label: 'Label & manifest', perm: 'orders.order.process', onClick: ({ selectedKeys }) => bulkMut.mutate({ action: 'manifest', ids: selectedKeys }) },
          { key: 'dispatch', label: 'Mark dispatched', perm: 'orders.order.process', onClick: ({ selectedKeys }) => bulkMut.mutate({ action: 'dispatch', ids: selectedKeys }) },
        ]}
        emptyProps={{ title: 'No orders here yet', description: 'New orders will show up in this tab.' }}
        mobileCard={(row) => (
          <Flex vertical gap={6}>
            <Flex justify="space-between" align="flex-start" gap={8}>
              <div style={{ minWidth: 0 }}>
                <Typography.Text strong>{row.orderId}</Typography.Text>
                <div>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {row.itemCount} item{row.itemCount === 1 ? '' : 's'} · {row.city ?? '—'}
                  </Typography.Text>
                </div>
              </div>
              <StatusTag domain="orderItem" code={row.status} />
            </Flex>
            <Space size={8} wrap>
              <MoneyText paise={row.totalPaise} strong />
              <Tag color={row.prepaid ? 'green' : 'orange'}>{row.prepaid ? 'Prepaid' : 'COD'}</Tag>
              {row.slaBreached && <Tag color="red">Overdue</Tag>}
            </Space>
          </Flex>
        )}
      />
    </Flex>
  );
}
