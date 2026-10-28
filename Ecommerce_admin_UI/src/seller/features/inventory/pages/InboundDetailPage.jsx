import { App, Alert, Button, Card, Col, Descriptions, Flex, Row, Space, Table, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import DateText from '@ui/components/DateText';
import ErrorState from '@ui/components/ErrorState';
import FullPageSpinner from '@ui/components/FullPageSpinner';
import PageHeader from '@ui/components/PageHeader';
import StatusTag from '@ui/components/StatusTag';
import { inventoryApi, inventoryKeys } from '../api/inventory.api';

export default function InboundDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: inventoryKeys.inboundDetail(id), queryFn: () => inventoryApi.inboundDetail(id) });
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: inventoryKeys.inboundDetail(id) });
    queryClient.invalidateQueries({ queryKey: ['seller', 'inbound', 'list'] });
  };
  const submitMut = useMutation({ mutationFn: () => inventoryApi.submitInbound(id), onSuccess: () => { message.success('Submitted to the warehouse.'); invalidate(); }, onError: (e) => message.error(e?.message ?? 'Could not submit.') });
  const cancelMut = useMutation({ mutationFn: () => inventoryApi.cancelInbound(id), onSuccess: () => { message.success('Consignment cancelled.'); invalidate(); }, onError: (e) => message.error(e?.message ?? 'Could not cancel.') });

  if (isLoading) return <FullPageSpinner label="Loading consignment…" />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;

  const isDraft = data.status === 'DRAFT';
  const received = ['RECEIVED', 'CLOSED'].includes(data.status);
  const cancellable = !['RECEIVED', 'CLOSED', 'CANCELLED'].includes(data.status);

  return (
    <Flex vertical gap={16}>
      <PageHeader
        title={data.id}
        breadcrumbs={[{ label: 'Inventory', to: '/inventory' }, { label: 'FBA Inbound', to: '/inventory/inbound' }, { label: data.id }]}
        onBack={() => navigate('/inventory/inbound')}
        tags={<StatusTag domain="inbound" code={data.status} />}
        actions={
          <Space>
            {cancellable && <Button danger loading={cancelMut.isPending} onClick={() => cancelMut.mutate()}>Cancel</Button>}
            {isDraft && <Button type="primary" loading={submitMut.isPending} onClick={() => submitMut.mutate()}>Submit to warehouse</Button>}
          </Space>
        }
      />

      {isDraft && <Alert type="info" showIcon message="Draft" description="Submit this consignment so the warehouse can book an appointment and receive it." />}
      {received && data.discrepancyUnits > 0 && <Alert type="warning" showIcon message={`${data.discrepancyUnits} units short or damaged on receipt`} description="Check the line details below. Short/damaged units in Arise's care are reimbursable." />}

      <Row gutter={16}>
        <Col xs={24} lg={8}>
          <Card title="Consignment" size="small">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Warehouse">{data.warehouseName}</Descriptions.Item>
              <Descriptions.Item label="Created"><DateText value={data.createdAt} /></Descriptions.Item>
              {data.appointmentAt && <Descriptions.Item label="Appointment"><DateText value={data.appointmentAt} withTime /></Descriptions.Item>}
              <Descriptions.Item label="Invoice">{data.invoiceNo ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Boxes">{data.boxCount}</Descriptions.Item>
              <Descriptions.Item label="Declared units">{data.declaredUnits}</Descriptions.Item>
              {received && <Descriptions.Item label="Received units">{data.receivedUnits}</Descriptions.Item>}
            </Descriptions>
          </Card>
        </Col>
        <Col xs={24} lg={16}>
          <Card title={`Lines (${data.lines?.length ?? 0})`} size="small">
            <Table
              rowKey="id"
              scroll={{ x: 'max-content' }}
              size="small"
              pagination={false}
              dataSource={data.lines ?? []}
              columns={[
                { title: 'Product', dataIndex: 'productTitle', render: (t, r) => <div><Typography.Text>{t}</Typography.Text><div><Typography.Text type="secondary" style={{ fontSize: 12 }}>{r.sku}</Typography.Text></div></div> },
                { title: 'Declared', dataIndex: 'declaredQty', align: 'right', width: 90 },
                ...(received ? [
                  { title: 'Received', dataIndex: 'receivedSellable', align: 'right', width: 90 },
                  { title: 'Damaged', dataIndex: 'receivedDamaged', align: 'right', width: 90, render: (v) => v ? <Typography.Text type="warning">{v}</Typography.Text> : 0 },
                  { title: 'Missing', dataIndex: 'receivedMissing', align: 'right', width: 90, render: (v) => v ? <Typography.Text type="danger">{v}</Typography.Text> : 0 },
                ] : []),
              ]}
            />
          </Card>
        </Col>
      </Row>
    </Flex>
  );
}
