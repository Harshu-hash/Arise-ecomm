import { BellOutlined, ClockCircleOutlined, SendOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Checkbox, Col, DatePicker, Descriptions, Divider, Flex, Form, Image, Input, Radio, Row, Select, Space, Statistic, Switch, Table, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import DateText from '@ui/components/DateText';
import PageHeader from '@ui/components/PageHeader';
import { notificationKeys, notificationsApi } from '../api/notifications.api';

const AUDIENCES = [
  { label: 'Customers', value: 'CUSTOMERS', count: 48210 },
  { label: 'Sellers', value: 'SELLERS', count: 3180 },
  { label: 'Admin staff', value: 'ADMINS', count: 46 },
];
const PLATFORMS = [{ label: 'Android', value: 'ANDROID' }, { label: 'iOS', value: 'IOS' }, { label: 'Web', value: 'WEB' }];

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
  const estimatedRecipients = useMemo(() => (values.audiences ?? []).reduce((sum, key) => sum + (AUDIENCES.find((item) => item.value === key)?.count ?? 0), 0), [values.audiences]);
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
    estimatedRecipients,
  });

  return (
    <Flex vertical gap={16}>
      <PageHeader title="Firebase push broadcasts" breadcrumbs={[{ label: 'Marketing' }, { label: 'Push Notifications' }]} subtitle="Compose, target, preview and schedule Firebase Cloud Messaging broadcasts for every Arise user type." />
      <Alert showIcon type="info" message="UI preview mode" description="This screen records mock broadcasts only. No Firebase project or production device token is contacted." />
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
              <Alert style={{ marginBottom: 16 }} type="warning" showIcon message={`Estimated audience: ${estimatedRecipients.toLocaleString('en-IN')} users`} description="Actual delivery depends on notification permission, active Firebase tokens and platform eligibility." />
              <Flex justify="flex-end"><Button htmlType="submit" type="primary" size="large" icon={scheduleMode === 'LATER' ? <ClockCircleOutlined /> : <SendOutlined />} loading={send.isPending}>{scheduleMode === 'LATER' ? 'Schedule broadcast' : 'Send broadcast'}</Button></Flex>
            </Form>
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <PhonePreview values={values} />
          <Card title="Delivery summary" size="small" style={{ marginTop: 16 }}>
            <Statistic title="Estimated recipients" value={estimatedRecipients} />
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
          { title: 'Reach', dataIndex: 'estimatedRecipients', render: (value) => Number(value ?? 0).toLocaleString('en-IN') },
          { title: 'Status', dataIndex: 'status', render: (value) => <Tag color={value === 'SENT' ? 'green' : 'blue'}>{value}</Tag> },
          { title: 'Created', dataIndex: 'createdAt', render: (value) => <DateText value={value} withTime /> },
        ]} />
      </Card>
    </Flex>
  );
}
