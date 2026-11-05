import { App, Flex, Tag, Typography } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import DataTable from '@ui/components/DataTable/DataTable';
import FilterBar from '@ui/components/FilterBar';
import PageHeader from '@ui/components/PageHeader';
import StatusTag from '@ui/components/StatusTag';
import useListQuery from '@ui/hooks/useListQuery';
import useUrlTableState from '@ui/hooks/useUrlTableState';
import { logisticsApi } from '@seller/features/logistics/api/logistics.api';

const TABS = ['ACCEPTANCE', 'PICK', 'PACK', 'HANDOVER', 'OVERDUE'];

export default function ProcessingPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const state = useUrlTableState({ defaultSort: 'dispatchByAt', defaultTab: 'ACCEPTANCE' });
  const { rows, meta, loading, fetching, error, refetch } = useListQuery({
    queryKey: ['seller', 'orders', 'processing', state.queryParams, state.tab],
    url: '/orders/processing',
    params: { ...state.queryParams, queue: state.tab },
  });
  const batchMut = useMutation({
    mutationFn: logisticsApi.batch,
    onSuccess: (result) => {
      message.success(
        `${result.succeeded} completed${result.failed ? `, ${result.failed} failed` : ''}.`,
      );
      queryClient.invalidateQueries({ queryKey: ['seller', 'orders'] });
    },
    onError: (err) => message.error(err?.message ?? 'Batch action failed.'),
  });
  return (
    <Flex vertical gap={12}>
      <PageHeader
        title="Dispatch work queue"
        breadcrumbs={[{ label: 'Orders', to: '/orders' }, { label: 'Processing' }]}
        subtitle="Accept, pick, pack, document and hand over high-volume fulfilments without opening every order."
        tags={meta?.counts?.OVERDUE > 0 && <Tag color="red">{meta.counts.OVERDUE} overdue</Tag>}
      />
      <FilterBar
        schema={[
          {
            key: 'fulfillmentType',
            label: 'Fulfilment',
            kind: 'select',
            options: [
              { value: 'SELLER', label: 'Self-ship' },
              { value: 'ARISE', label: 'Arise' },
            ],
          },
        ]}
        tableState={state}
        savedViews
        searchPlaceholder="Order, shipment or AWB"
      />
      <DataTable
        tableId="seller-processing"
        rows={rows}
        meta={meta}
        loading={loading || fetching}
        error={error}
        onRetry={refetch}
        tableState={state}
        tabs={TABS.map((key) => ({
          key,
          label: key === 'ACCEPTANCE' ? 'New / SLA' : key[0] + key.slice(1).toLowerCase(),
          count: meta?.counts?.[key],
        }))}
        onRowClick={(row) => navigate(`/orders/${row.id}`)}
        selection={{ getCheckboxProps: (row) => ({ disabled: row.fulfillmentType === 'ARISE' }) }}
        bulkActions={[
          {
            key: 'packing-slips',
            label: 'Generate packing slips',
            perm: 'logistics.document.generate',
            onClick: ({ selectedKeys }) =>
              batchMut.mutate({
                action: 'GENERATE_DOCUMENTS',
                documentType: 'PACKING_SLIP',
                ids: selectedKeys,
              }),
          },
          {
            key: 'invoices',
            label: 'Generate invoices',
            perm: 'logistics.document.generate',
            onClick: ({ selectedKeys }) =>
              batchMut.mutate({
                action: 'GENERATE_DOCUMENTS',
                documentType: 'TAX_INVOICE',
                ids: selectedKeys,
              }),
          },
          {
            key: 'labels',
            label: 'Generate labels',
            perm: 'logistics.document.generate',
            onClick: ({ selectedKeys }) =>
              batchMut.mutate({
                action: 'GENERATE_DOCUMENTS',
                documentType: 'SHIPPING_LABEL',
                ids: selectedKeys,
              }),
          },
          {
            key: 'handover',
            label: 'Confirm handover',
            perm: 'logistics.shipment.handover',
            onClick: ({ selectedKeys }) =>
              batchMut.mutate({ action: 'HANDOVER', ids: selectedKeys }),
          },
        ]}
        columns={[
          {
            title: 'Order / shipment',
            render: (_, row) => (
              <>
                <Typography.Text strong>{row.orderId}</Typography.Text>
                <br />
                <Typography.Text type="secondary">{row.id}</Typography.Text>
              </>
            ),
          },
          { title: 'Queue', dataIndex: 'queue', render: (value) => <Tag>{value}</Tag> },
          { title: 'Items', dataIndex: 'itemCount' },
          {
            title: 'Status',
            dataIndex: 'status',
            render: (value) => <StatusTag domain="orderItem" code={value} />,
          },
          { title: 'Dispatch by', dataIndex: 'dispatchByAt' },
        ]}
      />
    </Flex>
  );
}
