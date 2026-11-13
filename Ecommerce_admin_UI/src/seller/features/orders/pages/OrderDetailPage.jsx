import { EnvironmentOutlined } from '@ant-design/icons';
/* eslint-disable max-lines */
import {
  App,
  Alert,
  Avatar,
  Button,
  Card,
  Col,
  Descriptions,
  Flex,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Row,
  Space,
  Steps,
  Table,
  Tag,
  Timeline,
  Typography,
} from 'antd';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import DateText from '@ui/components/DateText';
import ErrorState from '@ui/components/ErrorState';
import FullPageSpinner from '@ui/components/FullPageSpinner';
import MoneyText from '@ui/components/MoneyText';
import PageHeader from '@ui/components/PageHeader';
import StatusTag from '@ui/components/StatusTag';
import { ACTION_LABELS, orderKeys, ordersApi } from '../api/orders.api';

const FLOW_STEPS = [
  { key: 'confirm', title: 'Confirm', status: 'PLACED' },
  { key: 'pack', title: 'Invoice & pack', status: 'ACCEPTED' },
  { key: 'manifest', title: 'Label & manifest', status: 'PACKED' },
  { key: 'dispatch', title: 'Dispatch', status: 'MANIFESTED' },
  { key: 'shipped', title: 'Shipped', status: 'SHIPPED' },
];

function stepIndex(status) {
  const map = {
    PLACED: 0,
    ACCEPTED: 1,
    PACKED: 2,
    MANIFESTED: 3,
    SHIPPED: 4,
    IN_TRANSIT: 4,
    OUT_FOR_DELIVERY: 4,
    UNDELIVERED: 4,
    DELIVERED: 5,
  };
  return map[status] ?? 0;
}

export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [packageOpen, setPackageOpen] = useState(false);
  const [scanValue, setScanValue] = useState('');
  const [scanPurpose, setScanPurpose] = useState('PACK');
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [packageForm] = Form.useForm();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: () => ordersApi.detail(id),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: orderKeys.detail(id) });
    queryClient.invalidateQueries({ queryKey: ['seller', 'orders', 'list'] });
  };

  const actionMut = useMutation({
    mutationFn: (action) => ordersApi.action(id, action),
    onSuccess: (_d, action) => {
      message.success(`${ACTION_LABELS[action]} done.`);
      invalidate();
    },
    onError: (e) => message.error(e?.message ?? 'Could not update the order.'),
  });

  const cancelMut = useMutation({
    mutationFn: () => ordersApi.cancel(id, cancelReason),
    onSuccess: () => {
      message.success('Order cancelled.');
      setCancelOpen(false);
      invalidate();
    },
    onError: (e) => message.error(e?.message ?? 'Could not cancel the order.'),
  });
  const packageMut = useMutation({
    mutationFn: (values) =>
      ordersApi.createPackages(id, [
        {
          itemIds: data.items
            .filter((item) => !['CANCELLED', 'PAYMENT_FAILED'].includes(item.status))
            .map((item) => item.id),
          weightG: values.weightG,
          dimsCm: { l: values.l, w: values.w, h: values.h },
        },
      ]),
    onSuccess: () => {
      message.success('Package data recorded.');
      setPackageOpen(false);
      invalidate();
    },
    onError: (e) => message.error(e?.message ?? 'Could not save package data.'),
  });
  const scanMut = useMutation({
    mutationFn: () => ordersApi.scan(id, scanValue, scanPurpose),
    onSuccess: () => {
      message.success(`${scanPurpose === 'PACK' ? 'Item' : 'Shipment'} scan accepted.`);
      setScanValue('');
      invalidate();
    },
    onError: (e) => message.error(e?.message ?? 'Scan did not match.'),
  });
  const documentMut = useMutation({
    mutationFn: (type) => ordersApi.generateDocument(id, type),
    onSuccess: () => {
      message.success('Versioned document generated.');
      invalidate();
    },
    onError: (e) => message.error(e?.message ?? 'Document is not ready yet.'),
  });
  const splitMut = useMutation({
    mutationFn: () => ordersApi.split(id, selectedItemIds),
    onSuccess: (split) => {
      message.success(`Split fulfilment ${split.id} created.`);
      setSelectedItemIds([]);
      invalidate();
    },
    onError: (e) => message.error(e?.message ?? 'Could not split this fulfilment.'),
  });
  const download = async (document) => {
    try {
      const blob = await ordersApi.downloadDocument(document.downloadUrl);
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = document.fileName;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      message.error(e?.message ?? 'Download failed.');
    }
  };

  if (isLoading) return <FullPageSpinner label="Loading order…" />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;

  const isArise = data.fulfillmentType === 'ARISE';
  const isCancelled = data.stage === 'CANCELLED';
  const current = stepIndex(data.status);

  return (
    <Flex vertical gap={16}>
      <PageHeader
        title={data.orderId}
        breadcrumbs={[{ label: 'Orders', to: '/orders' }, { label: data.orderId }]}
        onBack={() => navigate('/orders')}
        tags={
          <Space>
            <StatusTag domain="orderItem" code={data.status} />
            <Tag color={data.prepaid ? 'green' : 'orange'}>{data.prepaid ? 'Prepaid' : 'COD'}</Tag>
            {isArise && <Tag color="geekblue">Fulfilled by Arise</Tag>}
          </Space>
        }
        actions={
          !isArise && !isCancelled && data.stage !== 'SHIPPED' && data.stage !== 'DELIVERED' ? (
            <Space>
              <>
                <Button danger onClick={() => setCancelOpen(true)}>
                  Cancel order
                </Button>
              </>
              {data.nextAction && (
                <>
                  <Button
                    type="primary"
                    loading={actionMut.isPending}
                    onClick={() => actionMut.mutate(data.nextAction)}
                  >
                    {ACTION_LABELS[data.nextAction]}
                  </Button>
                </>
              )}
            </Space>
          ) : null
        }
      />

      {isCancelled ? (
        <Alert type="error" showIcon message="This order was cancelled." />
      ) : isArise ? (
        <Alert
          type="info"
          showIcon
          message="Fulfilled by Arise"
          description="Arise picks, packs and ships this order from its warehouse. No action needed from you."
        />
      ) : (
        <Card size="small">
          <Steps
            size="small"
            responsive
            current={current}
            items={FLOW_STEPS.map((s, i) => ({
              title: s.title,
              status: i < current ? 'finish' : i === current ? 'process' : 'wait',
            }))}
          />
          {data.slaBreached && (data.stage === 'NEW' || data.stage === 'PROCESSING') && (
            <Alert
              type="warning"
              showIcon
              style={{ marginTop: 12 }}
              message="Dispatch SLA breached"
              description="This order is past its dispatch-by time. Ship it as soon as possible to protect your account health."
            />
          )}
        </Card>
      )}

      <Row gutter={16}>
        <Col xs={24} lg={16}>
          <Card title={`Items (${data.items.length})`} style={{ marginBottom: 16 }}>
            <Table
              rowKey="id"
              scroll={{ x: 'max-content' }}
              pagination={false}
              dataSource={data.items}
              rowSelection={
                ['PLACED', 'ACCEPTED'].includes(data.status)
                  ? { selectedRowKeys: selectedItemIds, onChange: setSelectedItemIds }
                  : undefined
              }
              columns={[
                {
                  title: 'Product',
                  dataIndex: 'name',
                  render: (name, it) => (
                    <Flex gap={10} align="center">
                      <Avatar shape="square" src={it.image} style={{ background: '#f0f0f0' }}>
                        {name?.[0]}
                      </Avatar>
                      <div>
                        <Typography.Text>{name}</Typography.Text>
                        <div>
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            {it.variantLabel}
                          </Typography.Text>
                        </div>
                      </div>
                    </Flex>
                  ),
                },
                { title: 'Qty', dataIndex: 'qty', width: 60, align: 'center' },
                {
                  title: 'Price',
                  dataIndex: 'linePaise',
                  width: 110,
                  align: 'right',
                  render: (p) => <MoneyText paise={p} />,
                },
                {
                  title: 'Status',
                  dataIndex: 'status',
                  width: 130,
                  render: (s) => <StatusTag domain="orderItem" code={s} showIcon={false} />,
                },
              ]}
            />
            {!isArise && ['ACCEPTED', 'PACKED'].includes(data.status) && (
              <Space style={{ marginTop: 12 }}>
                <Button
                  onClick={() => {
                    packageForm.setFieldsValue({
                      weightG: data.packages?.[0]?.weightG ?? 500,
                      l: data.packages?.[0]?.dimsCm?.l ?? 20,
                      w: data.packages?.[0]?.dimsCm?.w ?? 15,
                      h: data.packages?.[0]?.dimsCm?.h ?? 5,
                    });
                    setPackageOpen(true);
                  }}
                >
                  Record package
                </Button>
                {data.items.length > 1 && ['PLACED', 'ACCEPTED'].includes(data.status) && (
                  <Button
                    disabled={
                      !selectedItemIds.length || selectedItemIds.length === data.items.length
                    }
                    loading={splitMut.isPending}
                    onClick={() => splitMut.mutate()}
                  >
                    Split selected items
                  </Button>
                )}
              </Space>
            )}
          </Card>

          {!isArise && ['ACCEPTED', 'PACKED', 'MANIFESTED'].includes(data.status) && (
            <Card title="Barcode scan" style={{ marginBottom: 16 }}>
              <Space.Compact block>
                <Button
                  onClick={() => setScanPurpose('PACK')}
                  type={scanPurpose === 'PACK' ? 'primary' : 'default'}
                >
                  Scan item
                </Button>
                <Button
                  onClick={() => setScanPurpose('HANDOVER')}
                  type={scanPurpose === 'HANDOVER' ? 'primary' : 'default'}
                >
                  Scan handover
                </Button>
                <Input
                  value={scanValue}
                  onChange={(event) => setScanValue(event.target.value)}
                  onPressEnter={() => scanMut.mutate()}
                  placeholder={
                    scanPurpose === 'PACK' ? 'SKU, EAN or item ID' : 'AWB or shipment ID'
                  }
                />
                <Button loading={scanMut.isPending} onClick={() => scanMut.mutate()}>
                  Scan
                </Button>
              </Space.Compact>
              <List
                size="small"
                dataSource={data.scans ?? []}
                renderItem={(scan) => (
                  <List.Item>
                    <Typography.Text>
                      {scan.purpose} · {scan.barcode}
                    </Typography.Text>
                    <DateText value={scan.scannedAt} withTime />
                  </List.Item>
                )}
              />
            </Card>
          )}

          <Card
            title="Document centre"
            style={{ marginBottom: 16 }}
            extra={
              <Space wrap>
                {[
                  ['PACKING_SLIP', 'Packing slip'],
                  ['TAX_INVOICE', 'Tax invoice'],
                  ['SHIPPING_LABEL', 'Shipping label'],
                  ['MANIFEST', 'Manifest'],
                ].map(([type, label]) => (
                  <Button
                    key={type}
                    size="small"
                    loading={documentMut.isPending}
                    onClick={() => documentMut.mutate(type)}
                  >
                    {label}
                  </Button>
                ))}
              </Space>
            }
          >
            <Table
              size="small"
              pagination={false}
              rowKey="id"
              dataSource={data.documents ?? []}
              columns={[
                { title: 'Document', dataIndex: 'type' },
                { title: 'Version', dataIndex: 'version' },
                {
                  title: 'Generated',
                  dataIndex: 'createdAt',
                  render: (value) => <DateText value={value} withTime />,
                },
                {
                  title: '',
                  render: (_, document) => (
                    <Button size="small" onClick={() => download(document)}>
                      Download
                    </Button>
                  ),
                },
              ]}
            />
          </Card>

          <Card title="Timeline" size="small">
            <Timeline
              items={(data.timeline ?? []).map((e) => ({
                color:
                  e.status === 'CANCELLED' ? 'red' : e.status === 'DELIVERED' ? 'green' : 'blue',
                children: (
                  <Space direction="vertical" size={0}>
                    <Typography.Text>{e.status.replaceAll('_', ' ')}</Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      <DateText value={e.at} withTime /> · {e.actorName ?? e.actorType}
                    </Typography.Text>
                  </Space>
                ),
              }))}
            />
          </Card>
          {data.exceptions?.length > 0 && (
            <Card title="Exceptions" size="small" style={{ marginTop: 16 }}>
              <List
                dataSource={data.exceptions}
                renderItem={(exception) => (
                  <List.Item>
                    <List.Item.Meta
                      title={exception.type?.replaceAll('_', ' ')}
                      description={exception.description ?? exception.reason}
                    />
                    <Tag color="orange">{exception.status}</Tag>
                  </List.Item>
                )}
              />
            </Card>
          )}
        </Col>

        <Col xs={24} lg={8}>
          <Card
            title={
              <Space>
                <EnvironmentOutlined /> Ship to
              </Space>
            }
            size="small"
            style={{ marginBottom: 16 }}
          >
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Name">{data.customerName}</Descriptions.Item>
              <Descriptions.Item label="Phone">{data.customerPhone}</Descriptions.Item>
              <Descriptions.Item label="Address">
                {[data.address?.line, data.address?.cityLine].filter(Boolean).join(', ')}
              </Descriptions.Item>
              <Descriptions.Item label="Pincode">{data.address?.pincode}</Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title="Shipment" size="small" style={{ marginBottom: 16 }}>
            <List
              size="small"
              dataSource={[
                ['Fulfilment', isArise ? 'By Arise' : 'Self-ship'],
                ['Invoice', data.invoiceNo ?? '—'],
                ['Courier', data.courierName ?? '—'],
                ['AWB', data.awb ?? '—'],
                [
                  'Dispatch by',
                  data.dispatchByAt ? <DateText value={data.dispatchByAt} withTime /> : '—',
                ],
              ]}
              renderItem={([label, value]) => (
                <List.Item>
                  <Typography.Text type="secondary">{label}</Typography.Text>
                  <Typography.Text strong>{value}</Typography.Text>
                </List.Item>
              )}
            />
          </Card>

          <Card title="Payment" size="small">
            <Flex justify="space-between" align="center">
              <Typography.Text type="secondary">Your payout value</Typography.Text>
              <MoneyText paise={data.totalPaise} strong />
            </Flex>
            <Flex justify="space-between" align="center" style={{ marginTop: 6 }}>
              <Typography.Text type="secondary">Method</Typography.Text>
              <Tag color={data.prepaid ? 'green' : 'orange'} style={{ margin: 0 }}>
                {data.paymentMethod}
              </Tag>
            </Flex>
          </Card>
        </Col>
      </Row>

      <Modal
        title="Cancel this order?"
        open={cancelOpen}
        onCancel={() => setCancelOpen(false)}
        onOk={() => cancelMut.mutate()}
        okText="Cancel order"
        okButtonProps={{ danger: true }}
        confirmLoading={cancelMut.isPending}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Typography.Text type="secondary">
            Cancelling affects your account health.{' '}
            {data.prepaid ? 'A refund will be initiated to the customer.' : ''}
          </Typography.Text>
          <Input.TextArea
            rows={3}
            placeholder="Reason for cancellation"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
        </Space>
      </Modal>
      <Modal
        title="Record actual package"
        open={packageOpen}
        onCancel={() => setPackageOpen(false)}
        onOk={() => packageForm.submit()}
        confirmLoading={packageMut.isPending}
      >
        <Form form={packageForm} layout="vertical" onFinish={packageMut.mutate}>
          <Form.Item name="weightG" label="Actual weight (g)" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="l" label="Length (cm)" rules={[{ required: true }]}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="w" label="Width (cm)" rules={[{ required: true }]}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="h" label="Height (cm)" rules={[{ required: true }]}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Typography.Text type="secondary">
            This package contains all active items. Split fulfilment first when items need separate
            parcels.
          </Typography.Text>
        </Form>
      </Modal>
    </Flex>
  );
}
