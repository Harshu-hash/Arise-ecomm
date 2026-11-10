/* eslint-disable max-lines */
import { App, Button, DatePicker, Flex, Form, Input, Modal, Space, Tag, Typography } from 'antd';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import DataTable from '@ui/components/DataTable/DataTable';
import FilterBar from '@ui/components/FilterBar';
import MoneyText from '@ui/components/MoneyText';
import PageHeader from '@ui/components/PageHeader';
import DocumentUpload from '@ui/components/DocumentUpload';
import useListQuery from '@ui/hooks/useListQuery';
import useUrlTableState from '@ui/hooks/useUrlTableState';
import { logisticsApi, logisticsKeys } from '../api/logistics.api';

const CONFIG = {
  shipments: {
    title: 'Shipments',
    subtitle: 'Track seller-scoped parcels and courier events.',
    search: 'Shipment, order or AWB',
  },
  pickups: {
    title: 'Pickups & manifests',
    subtitle: 'Schedule and recover courier handovers.',
    search: 'Manifest or courier',
  },
  ndr: {
    title: 'NDR action queue',
    subtitle: 'Respond within the configured courier hold window.',
    search: 'AWB, order or reason',
  },
  rto: {
    title: 'Return to origin',
    subtitle: 'Track parcels returning to your warehouse.',
    search: 'Shipment, order or AWB',
  },
  'weight-disputes': {
    title: 'Weight disputes',
    subtitle: 'Challenge courier charged weight with durable evidence.',
    search: 'AWB, order or SKU',
  },
};

export default function LogisticsListPage({ kind }) {
  const config = CONFIG[kind];
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const state = useUrlTableState({ defaultSort: kind === 'ndr' ? 'actionDueAt' : '-raisedAt' });
  const [target, setTarget] = useState(null);
  const [evidence, setEvidence] = useState([]);
  const [form] = Form.useForm();
  const { rows, meta, loading, fetching, error, refetch } = useListQuery({
    queryKey: logisticsKeys.list(kind, state.queryParams),
    url: `/logistics/${kind}`,
    params: state.queryParams,
  });
  const actionMut = useMutation({
    mutationFn: async (values) => {
      if (kind === 'ndr')
        return logisticsApi.respondNdr(target.id, { ...values, reason: values.note });
      if (kind === 'pickups')
        return logisticsApi.reschedulePickup(target.id, {
          ...values,
          date: values.date.format('YYYY-MM-DD'),
        });
      return logisticsApi.disputeWeight(target.id, { ...values, evidence });
    },
    onSuccess: () => {
      message.success('Action submitted.');
      setTarget(null);
      setEvidence([]);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['seller', 'logistics', kind] });
    },
    onError: (err) => message.error(err?.message ?? 'Action failed.'),
  });
  const action = (row) => {
    if (kind === 'ndr' && row.status === 'OPEN')
      return (
        <Button size="small" onClick={() => setTarget(row)}>
          Respond
        </Button>
      );
    if (kind === 'pickups' && row.status !== 'PICKED_UP')
      return (
        <Button size="small" onClick={() => setTarget(row)}>
          Reschedule
        </Button>
      );
    if (
      kind === 'weight-disputes' &&
      !['ACCEPTED', 'REJECTED', 'AUTO_ACCEPTED'].includes(row.status)
    )
      return (
        <Button size="small" onClick={() => setTarget(row)}>
          Dispute
        </Button>
      );
    return null;
  };
  const columns =
    kind === 'pickups'
      ? [
          { title: 'Manifest', dataIndex: 'id' },
          { title: 'Courier', dataIndex: 'courierName' },
          { title: 'Date / slot', render: (_, row) => `${row.date} · ${row.slot}` },
          { title: 'Shipments', dataIndex: 'shipmentCount' },
          { title: 'Status', dataIndex: 'status', render: (value) => <Tag>{value}</Tag> },
          { title: '', render: (_, row) => action(row) },
        ]
      : kind === 'ndr'
        ? [
            {
              title: 'AWB / order',
              render: (_, row) => (
                <>
                  {row.awb}
                  <br />
                  <Typography.Text type="secondary">{row.orderId}</Typography.Text>
                </>
              ),
            },
            { title: 'Reason', dataIndex: 'reason' },
            { title: 'Attempt', dataIndex: 'attempt' },
            { title: 'Respond by', dataIndex: 'actionDueAt' },
            {
              title: 'Status',
              dataIndex: 'status',
              render: (value, row) => <Tag color={row.overdue ? 'red' : 'orange'}>{value}</Tag>,
            },
            { title: '', render: (_, row) => action(row) },
          ]
        : kind === 'weight-disputes'
          ? [
              {
                title: 'AWB / SKU',
                render: (_, row) => (
                  <>
                    {row.awb}
                    <br />
                    <Typography.Text type="secondary">{row.sku}</Typography.Text>
                  </>
                ),
              },
              { title: 'Declared', render: (_, row) => `${row.declaredWeightG} g` },
              { title: 'Charged', render: (_, row) => `${row.chargedWeightG} g` },
              {
                title: 'Extra charge',
                dataIndex: 'extraChargePaise',
                render: (value) => <MoneyText paise={value} />,
              },
              { title: 'Status', dataIndex: 'status', render: (value) => <Tag>{value}</Tag> },
              { title: '', render: (_, row) => action(row) },
            ]
          : [
              {
                title: 'Shipment',
                render: (_, row) => (
                  <>
                    {row.id}
                    <br />
                    <Typography.Text type="secondary">{row.orderId}</Typography.Text>
                  </>
                ),
              },
              { title: 'AWB', dataIndex: 'awb' },
              { title: 'Courier', dataIndex: 'courierName' },
              { title: 'Status', dataIndex: 'status', render: (value) => <Tag>{value}</Tag> },
              { title: 'Last scan', dataIndex: 'lastScanAt' },
            ];
  return (
    <Flex vertical gap={12}>
      <PageHeader
        title={config.title}
        breadcrumbs={[{ label: 'Logistics' }, { label: config.title }]}
        subtitle={config.subtitle}
      />
      <FilterBar
        schema={[{ key: 'status', label: 'Status', kind: 'text' }]}
        tableState={state}
        savedViews
        searchPlaceholder={config.search}
      />
      <DataTable
        tableId={`seller-logistics-${kind}`}
        rows={rows}
        meta={meta}
        columns={columns}
        loading={loading || fetching}
        error={error}
        onRetry={refetch}
        tableState={state}
        emptyProps={{ title: `No ${config.title.toLowerCase()}` }}
      />
      <Modal
        title={
          kind === 'ndr'
            ? 'Respond to NDR'
            : kind === 'pickups'
              ? 'Reschedule pickup'
              : 'Dispute charged weight'
        }
        open={Boolean(target)}
        onCancel={() => setTarget(null)}
        onOk={() => form.submit()}
        confirmLoading={actionMut.isPending}
      >
        <Form form={form} layout="vertical" onFinish={actionMut.mutate}>
          {kind === 'ndr' && (
            <Form.Item name="action" label="Decision" rules={[{ required: true }]}>
              <Space.Compact block>
                <Button onClick={() => form.setFieldValue('action', 'REATTEMPT')}>
                  Request reattempt
                </Button>
                <Button danger onClick={() => form.setFieldValue('action', 'RTO')}>
                  Return to origin
                </Button>
              </Space.Compact>
            </Form.Item>
          )}
          {kind === 'pickups' && (
            <Form.Item name="date" label="Pickup date" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          )}
          {kind !== 'pickups' && (
            <Form.Item
              name={kind === 'ndr' ? 'note' : 'reason'}
              label="Reason / instructions"
              rules={[{ required: true }]}
            >
              <Input.TextArea rows={3} />
            </Form.Item>
          )}
          {kind === 'weight-disputes' && (
            <Form.Item label="Evidence" required>
              <DocumentUpload
                value={evidence}
                onChange={setEvidence}
                maxCount={5}
                label="Weight evidence"
                kind="WEIGHT_EVIDENCE"
              />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </Flex>
  );
}
