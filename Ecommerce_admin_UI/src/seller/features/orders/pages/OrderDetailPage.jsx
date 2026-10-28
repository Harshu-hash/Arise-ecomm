import { EnvironmentOutlined } from '@ant-design/icons';
import { App, Alert, Avatar, Button, Card, Col, Descriptions, Flex, Input, List, Modal, Row, Space, Steps, Table, Tag, Timeline, Typography } from 'antd';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { Can } from '@core/rbac/Can';
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
  const map = { PLACED: 0, ACCEPTED: 1, PACKED: 2, MANIFESTED: 3, SHIPPED: 4, IN_TRANSIT: 4, OUT_FOR_DELIVERY: 4, UNDELIVERED: 4, DELIVERED: 5 };
  return map[status] ?? 0;
}

export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

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
    onSuccess: (_d, action) => { message.success(`${ACTION_LABELS[action]} done.`); invalidate(); },
    onError: (e) => message.error(e?.message ?? 'Could not update the order.'),
  });

  const cancelMut = useMutation({
    mutationFn: () => ordersApi.cancel(id, cancelReason),
    onSuccess: () => { message.success('Order cancelled.'); setCancelOpen(false); invalidate(); },
    onError: (e) => message.error(e?.message ?? 'Could not cancel the order.'),
  });

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
              <Can perm="orders.order.cancel">
                <Button danger onClick={() => setCancelOpen(true)}>Cancel order</Button>
              </Can>
              {data.nextAction && (
                <Can perm="orders.order.process">
                  <Button type="primary" loading={actionMut.isPending} onClick={() => actionMut.mutate(data.nextAction)}>
                    {ACTION_LABELS[data.nextAction]}
                  </Button>
                </Can>
              )}
            </Space>
          ) : null
        }
      />

      {isCancelled ? (
        <Alert type="error" showIcon message="This order was cancelled." />
      ) : isArise ? (
        <Alert type="info" showIcon message="Fulfilled by Arise" description="Arise picks, packs and ships this order from its warehouse. No action needed from you." />
      ) : (
        <Card size="small">
          <Steps
            size="small"
            responsive
            current={current}
            items={FLOW_STEPS.map((s, i) => ({ title: s.title, status: i < current ? 'finish' : i === current ? 'process' : 'wait' }))}
          />
          {data.slaBreached && (data.stage === 'NEW' || data.stage === 'PROCESSING') && (
            <Alert type="warning" showIcon style={{ marginTop: 12 }} message="Dispatch SLA breached" description="This order is past its dispatch-by time. Ship it as soon as possible to protect your account health." />
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
              columns={[
                {
                  title: 'Product', dataIndex: 'name',
                  render: (name, it) => (
                    <Flex gap={10} align="center">
                      <Avatar shape="square" src={it.image} style={{ background: '#f0f0f0' }}>{name?.[0]}</Avatar>
                      <div>
                        <Typography.Text>{name}</Typography.Text>
                        <div><Typography.Text type="secondary" style={{ fontSize: 12 }}>{it.variantLabel}</Typography.Text></div>
                      </div>
                    </Flex>
                  ),
                },
                { title: 'Qty', dataIndex: 'qty', width: 60, align: 'center' },
                { title: 'Price', dataIndex: 'linePaise', width: 110, align: 'right', render: (p) => <MoneyText paise={p} /> },
                { title: 'Status', dataIndex: 'status', width: 130, render: (s) => <StatusTag domain="orderItem" code={s} showIcon={false} /> },
              ]}
            />
          </Card>

          <Card title="Timeline" size="small">
            <Timeline
              items={(data.timeline ?? []).map((e) => ({
                color: e.status === 'CANCELLED' ? 'red' : e.status === 'DELIVERED' ? 'green' : 'blue',
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
        </Col>

        <Col xs={24} lg={8}>
          <Card title={<Space><EnvironmentOutlined /> Ship to</Space>} size="small" style={{ marginBottom: 16 }}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Name">{data.customerName}</Descriptions.Item>
              <Descriptions.Item label="Phone">{data.customerPhone}</Descriptions.Item>
              <Descriptions.Item label="Address">{[data.address?.line, data.address?.cityLine].filter(Boolean).join(', ')}</Descriptions.Item>
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
                ['Dispatch by', data.dispatchByAt ? <DateText value={data.dispatchByAt} withTime /> : '—'],
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
              <Tag color={data.prepaid ? 'green' : 'orange'} style={{ margin: 0 }}>{data.paymentMethod}</Tag>
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
            Cancelling affects your account health. {data.prepaid ? 'A refund will be initiated to the customer.' : ''}
          </Typography.Text>
          <Input.TextArea rows={3} placeholder="Reason for cancellation" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
        </Space>
      </Modal>
    </Flex>
  );
}
