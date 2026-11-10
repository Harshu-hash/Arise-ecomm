import { App, Alert, Button, Card, Col, Descriptions, Flex, Form, Input, List, Modal, Row, Select, Space, Table, Tag, Timeline, Typography } from 'antd';
import { useState } from 'react';
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
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeForm] = Form.useForm();

  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: inventoryKeys.inboundDetail(id), queryFn: () => inventoryApi.inboundDetail(id) });
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: inventoryKeys.inboundDetail(id) });
    queryClient.invalidateQueries({ queryKey: ['seller', 'inbound', 'list'] });
  };
  const submitMut = useMutation({ mutationFn: () => inventoryApi.submitInbound(id), onSuccess: () => { message.success('Submitted to the warehouse.'); invalidate(); }, onError: (e) => message.error(e?.message ?? 'Could not submit.') });
  const cancelMut = useMutation({ mutationFn: () => inventoryApi.cancelInbound(id), onSuccess: () => { message.success('Consignment cancelled.'); invalidate(); }, onError: (e) => message.error(e?.message ?? 'Could not cancel.') });
  const disputeMut = useMutation({ mutationFn: (values) => inventoryApi.disputeInbound(id, values), onSuccess: () => { message.success('Receiving dispute opened.'); setDisputeOpen(false); disputeForm.resetFields(); invalidate(); }, onError: (e) => message.error(e?.message ?? 'Could not open dispute.') });

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
      {received && data.discrepancyUnits > 0 && <Alert type="warning" showIcon message={`${data.discrepancyUnits} units short or damaged on receipt`} description="Check expected versus received below and open a dispute with evidence." action={<Button onClick={() => setDisputeOpen(true)}>Open dispute</Button>} />}

      <Row gutter={16}>
        <Col xs={24} lg={8}>
          <Card title="Consignment" size="small">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Warehouse">{data.warehouseName}</Descriptions.Item>
              <Descriptions.Item label="Created"><DateText value={data.createdAt} /></Descriptions.Item>
              {data.appointmentAt && <Descriptions.Item label="Appointment"><DateText value={data.appointmentAt} withTime /></Descriptions.Item>}
              <Descriptions.Item label="Invoice">{data.invoiceNo ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Boxes">{data.boxCount}</Descriptions.Item>
              <Descriptions.Item label="Load type">{data.packagingType ?? 'CARTON'}{data.palletCount ? ` · ${data.palletCount} pallets` : ''}</Descriptions.Item>
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
      <Row gutter={16}>
        <Col xs={24} lg={8}><Card title="Timeline" size="small"><Timeline items={(data.timeline ?? []).map((item) => ({ children: <><Typography.Text strong>{item.label}</Typography.Text><br /><DateText value={item.at} withTime /></> }))} /></Card></Col>
        <Col xs={24} lg={8}><Card title="Documents" size="small"><List dataSource={data.documents ?? []} locale={{ emptyText: 'Generated after submission.' }} renderItem={(document) => <List.Item><Typography.Text>{document.fileName}</Typography.Text><Tag color="green">{document.status}</Tag></List.Item>} /></Card></Col>
        <Col xs={24} lg={8}><Card title="Disputes" size="small"><List dataSource={data.disputes ?? []} locale={{ emptyText: 'No receiving disputes.' }} renderItem={(dispute) => <List.Item><List.Item.Meta title={<Tag color="orange">{dispute.status}</Tag>} description={dispute.reason} /></List.Item>} /></Card></Col>
      </Row>
      <Modal title="Dispute receiving discrepancy" open={disputeOpen} onCancel={() => setDisputeOpen(false)} onOk={() => disputeForm.submit()} confirmLoading={disputeMut.isPending}>
        <Form form={disputeForm} layout="vertical" initialValues={{ type: 'SHORTAGE' }} onFinish={(values) => disputeMut.mutate(values)}>
          <Form.Item name="type" label="Discrepancy type"><Select options={[{ value: 'SHORTAGE', label: 'Shortage' }, { value: 'DAMAGE', label: 'Damage' }, { value: 'UNEXPECTED_SKU', label: 'Unexpected SKU' }]} /></Form.Item>
          <Form.Item noStyle shouldUpdate={(previous, current) => previous.type !== current.type}>{({ getFieldValue }) => getFieldValue('type') === 'UNEXPECTED_SKU' && <Form.Item name="unexpectedSku" label="Unexpected SKU" rules={[{ required: true }]}><Input /></Form.Item>}</Form.Item>
          <Form.Item name="reason" label="What is wrong?" rules={[{ required: true }]}><Input.TextArea rows={4} placeholder="Describe the affected cartons and reference supporting evidence." /></Form.Item>
        </Form>
      </Modal>
    </Flex>
  );
}
