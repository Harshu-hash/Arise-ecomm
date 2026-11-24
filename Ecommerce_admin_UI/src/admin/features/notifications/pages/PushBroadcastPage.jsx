import { BellOutlined, ClockCircleOutlined, SendOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Checkbox, Col, DatePicker, Descriptions, Divider, Flex, Form, Image, Input, Radio, Row, Select, Space, Statistic, Switch, Table, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import DateText from '@ui/components/DateText';
import PageHeader from '@ui/components/PageHeader';
import { notificationKeys, notificationsApi } from '../api/notifications.api';

// Customers and sellers get the message in their notification list; customers with the app on a chosen phone type also get a push.
const AUDIENCES = [{ label: 'Customers', value: 'CUSTOMERS' }, { label: 'Sellers', value: 'SELLERS' }];
const PLATFORMS = [{ label: 'Android', value: 'ANDROID' }, { label: 'iOS', value: 'IOS' }];
const STATUS_COLOR = { SENT: 'green', SCHEDULED: 'blue', SENDING: 'processing', FAILED: 'red', CANCELLED: 'default', EXPIRED: 'orange' };

function PhonePreview({ values }) {
  return (
    <Card title="Live preview" size="small">
      <div style={{ maxWidth: 330, margin: '0 auto', border: '8px solid #1f2937', borderRadius: 28, background: '#eef2f7', padding: '52px 12px 170px' }}>
        <Card size="small" styles={{ body: { padding: 12 } }}>
          <Flex gap={10} align="flex-start">
            <div style={{ width: 36, height: 36, borderRadius: 9, background: '#1677ff', color: 'white', display: 'grid', placeItems: 'center' }}><BellOutlined /></div>
            <Flex vertical style={{ minWidth: 0, flex: 1 }}>
              <Flex justify="space-between" gap={8}><Typography.Text strong ellipsis>{values.title || 'Notification title'}</Typography.Text><Typography.Text type="secondary" style={{ fontSize: 11 }}>now</Typography.Text></Flex>
              <Typography.Text style={{ fontSize: 12 }}>{values.message || 'Your push message will appear here.'}</Typography.Text>
            </Flex>
          </Flex>
          {values.imageUrl && <Image preview={false} fallback="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" src={values.imageUrl} style={{ width: '100%', maxHeight: 120, objectFit: 'cover', marginTop: 10, borderRadius: 6 }} />}
        </Card>
      </div>
    </Card>
  );
}

export default function PushBroadcastPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const [scheduleMode, setScheduleMode] = useState('NOW');
  const values = Form.useWatch([], form) ?? {};
  const history = useQuery({ queryKey: notificationKeys.broadcasts, queryFn: notificationsApi.broadcasts });
  const platforms = values.platforms?.length ? values.platforms : ['ANDROID', 'IOS'];
  const audience = useQuery({ queryKey: notificationKeys.audience(platforms), queryFn: () => notificationsApi.audience(platforms) });
  const estimatedRecipients = useMemo(() => {
    const counts = audience.data;
    if (!counts) return 0;
    const picked = values.audiences ?? [];
    return (picked.includes('CUSTOMERS') ? counts.customers : 0) + (picked.includes('SELLERS') ? counts.sellers : 0);
  }, [audience.data, values.audiences]);
  const cancel = useMutation({
    mutationFn: notificationsApi.cancelBroadcast,
    onSuccess: () => {
      message.success('Broadcast cancelled.');
      queryClient.invalidateQueries({ queryKey: notificationKeys.broadcasts });
    },
    onError: (error) => message.error(error?.message ?? 'Could not cancel the broadcast.'),
  });
  const send = useMutation({
    mutationFn: (payload) => notificationsApi.sendBroadcast(payload),
    onSuccess: (broadcast) => {
      message.success(broadcast.status === 'SCHEDULED' ? 'Push notification scheduled.' : 'Push notification sent.');
      queryClient.invalidateQueries({ queryKey: notificationKeys.broadcasts });
      form.resetFields();
      setScheduleMode('NOW');
    },
    onError: (error) => message.error(error?.message ?? 'Could not save the broadcast.'),
  });

  const submit = (formValues) => send.mutate({
    ...formValues,
    scheduleAt: scheduleMode === 'LATER' ? formValues.scheduleAt?.toISOString() : null,
    expiresAt: formValues.expiresAt?.toISOString() ?? null,
  });

  return (
    <Flex vertical gap={16}>
      <PageHeader title="Firebase push broadcasts" breadcrumbs={[{ label: 'Marketing' }, { label: 'Push Notifications' }]} subtitle="Compose, target, preview and schedule Firebase Cloud Messaging broadcasts for every Arise user type." />
      {audience.data && !audience.data.pushConfigured && <Alert showIcon type="warning" message="Firebase is not set up on the server" description="Messages will reach the notification lists of customers and sellers, but no phone push is sent until FCM_SERVICE_ACCOUNT_JSON is configured." />}
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}>
          <Card title="Create broadcast">
            <Form form={form} layout="vertical" initialValues={{ audiences: ['CUSTOMERS'], platforms: ['ANDROID', 'IOS'], priority: 'NORMAL', sound: true }} onFinish={submit}>
              <Row gutter={12}>
                <Col xs={24} md={12}><Form.Item name="title" label="Notification title" rules={[{ required: true }, { max: 65 }]}><Input showCount maxLength={65} placeholder="Festive offers are live" /></Form.Item></Col>
                <Col xs={24} md={12}><Form.Item name="campaignName" label="Internal campaign name" rules={[{ required: true }]}><Input placeholder="Diwali sale launch" /></Form.Item></Col>
              </Row>
              <Form.Item name="message" label="Message" rules={[{ required: true }, { max: 240 }]}><Input.TextArea rows={4} showCount maxLength={240} placeholder="Tell users why they should open the app." /></Form.Item>
              <Row gutter={12}>
                <Col xs={24} md={12}><Form.Item name="imageUrl" label="Rich image URL" rules={[{ type: 'url', warningOnly: true }]}><Input placeholder="https://…/campaign.jpg" /></Form.Item></Col>
                <Col xs={24} md={12}><Form.Item name="deepLink" label="Open destination"><Input placeholder="arise://offers/diwali" /></Form.Item></Col>
              </Row>
              <Divider orientation="left">Audience and delivery</Divider>
              <Form.Item name="audiences" label="User types" rules={[{ required: true, message: 'Select at least one audience.' }]}><Checkbox.Group options={AUDIENCES.map(({ label, value }) => ({ label, value }))} /></Form.Item>
              <Form.Item name="platforms" label="Platforms" rules={[{ required: true, message: 'Select at least one platform.' }]}><Checkbox.Group options={PLATFORMS} /></Form.Item>
              <Row gutter={12}>
                <Col xs={24} md={8}><Form.Item name="priority" label="FCM priority"><Select options={[{ value: 'NORMAL', label: 'Normal' }, { value: 'HIGH', label: 'High' }]} /></Form.Item></Col>
                <Col xs={12} md={8}><Form.Item name="sound" label="Notification sound" valuePropName="checked"><Switch checkedChildren="On" unCheckedChildren="Off" /></Form.Item></Col>
                <Col xs={12} md={8}><Form.Item name="collapseKey" label="Collapse key"><Input placeholder="sale_update" /></Form.Item></Col>
              </Row>
              <Divider orientation="left">Timing</Divider>
              <Radio.Group value={scheduleMode} onChange={(event) => setScheduleMode(event.target.value)} style={{ marginBottom: 16 }} options={[{ value: 'NOW', label: 'Send now' }, { value: 'LATER', label: 'Schedule' }]} />
              <Row gutter={12}>
                {scheduleMode === 'LATER' && <Col xs={24} md={12}><Form.Item name="scheduleAt" label="Send date and time" rules={[{ required: true }]}><DatePicker showTime style={{ width: '100%' }} disabledDate={(date) => date && date < dayjs().startOf('day')} /></Form.Item></Col>}
                <Col xs={24} md={12}><Form.Item name="expiresAt" label="Optional expiry"><DatePicker showTime style={{ width: '100%' }} disabledDate={(date) => date && date < dayjs().startOf('day')} /></Form.Item></Col>
              </Row>
              <Alert style={{ marginBottom: 16 }} type="warning" showIcon message={`Notification list: ${estimatedRecipients.toLocaleString('en-IN')} people`} description={`${(audience.data?.customersWithPush ?? 0).toLocaleString('en-IN')} customers also have the app on the chosen platforms and can get a phone push (unless they turned offers off). Sellers see it in their panel bell.`} />
              <Flex justify="flex-end"><Button htmlType="submit" type="primary" size="large" icon={scheduleMode === 'LATER' ? <ClockCircleOutlined /> : <SendOutlined />} loading={send.isPending}>{scheduleMode === 'LATER' ? 'Schedule broadcast' : 'Send broadcast'}</Button></Flex>
            </Form>
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <PhonePreview values={values} />
          <Card title="Delivery summary" size="small" style={{ marginTop: 16 }}>
            <Statistic title="Notification list reach" value={estimatedRecipients} loading={audience.isLoading} />
            <Descriptions size="small" column={1} style={{ marginTop: 12 }} items={[
              { key: 'audience', label: 'Audience', children: (values.audiences ?? []).join(', ') || 'Not selected' },
              { key: 'platforms', label: 'Platforms', children: (values.platforms ?? []).join(', ') || 'Not selected' },
              { key: 'destination', label: 'Destination', children: values.deepLink || 'App home' },
            ]} />
          </Card>
        </Col>
      </Row>
      <Card title="Broadcast history">
        <Table rowKey="id" loading={history.isLoading} dataSource={history.data ?? []} pagination={{ pageSize: 8 }} columns={[
          { title: 'Campaign', dataIndex: 'campaignName', render: (value, row) => <div><Typography.Text strong>{value}</Typography.Text><div><Typography.Text type="secondary">{row.title}</Typography.Text></div></div> },
          { title: 'Audience', dataIndex: 'audiences', render: (items = []) => <Space size={[0, 4]} wrap>{items.map((item) => <Tag key={item}>{item}</Tag>)}</Space> },
          { title: 'Reach', dataIndex: 'inboxCount', render: (value, row) => <div>{Number(value ?? 0).toLocaleString('en-IN')}<div><Typography.Text type="secondary">{`${Number(row.pushSent ?? 0).toLocaleString('en-IN')} pushed${row.pushFailed ? `, ${row.pushFailed} failed` : ''}`}</Typography.Text></div></div> },
          { title: 'Status', dataIndex: 'status', render: (value, row) => <div><Tag color={STATUS_COLOR[value]}>{value}</Tag>{value === 'SCHEDULED' && row.scheduleAt && <div><DateText value={row.scheduleAt} withTime /></div>}{row.failureReason && <div><Typography.Text type="danger">{row.failureReason}</Typography.Text></div>}</div> },
          { title: 'Created', dataIndex: 'createdAt', render: (value) => <DateText value={value} withTime /> },
          { title: '', key: 'actions', render: (_, row) => row.status === 'SCHEDULED' && <Button size="small" danger loading={cancel.isPending && cancel.variables === row.id} onClick={() => cancel.mutate(row.id)}>Cancel</Button> },
        ]} />
      </Card>
    </Flex>
  );
}
