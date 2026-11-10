import { PlusOutlined } from '@ant-design/icons';
import { App, Button, Card, Checkbox, Col, Flex, Form, Input, List, Modal, Popconfirm, Row, Tag, Typography } from 'antd';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ErrorState from '@ui/components/ErrorState';
import FullPageSpinner from '@ui/components/FullPageSpinner';
import PageHeader from '@ui/components/PageHeader';
import { settingsApi, settingsKeys } from '../api/settings.api';

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export default function WarehousesPage() {
  const { message } = App.useApp();
  const client = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const query = useQuery({ queryKey: settingsKeys.warehouses, queryFn: settingsApi.warehouses });
  const refresh = () => client.invalidateQueries({ queryKey: settingsKeys.warehouses });
  const save = useMutation({
    mutationFn: (values) => editing?.id ? settingsApi.updateWarehouse(editing.id, { ...values, version: editing.version }) : settingsApi.createWarehouse(values),
    onSuccess: () => { message.success(editing?.id ? 'Warehouse updated.' : 'Warehouse created.'); setEditing(null); form.resetFields(); refresh(); },
    onError: (error) => message.error(error?.message ?? 'Could not save warehouse.'),
  });
  const deactivate = useMutation({ mutationFn: settingsApi.deactivateWarehouse, onSuccess: () => { message.success('Warehouse deactivated.'); refresh(); }, onError: (error) => message.error(error?.message ?? 'Warehouse still has dependencies.') });
  const open = (row = {}) => {
    setEditing(row);
    form.setFieldsValue({ pickupCapable: true, operatingHours: Object.fromEntries(DAYS.map((day) => [day, day === 'sun' ? 'CLOSED' : '09:00-18:00'])), ...row });
  };
  if (query.isLoading) return <FullPageSpinner label="Loading warehouses…" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />;
  return <Flex vertical gap={16}>
    <PageHeader title="Warehouses" breadcrumbs={[{ label: 'Settings' }, { label: 'Warehouses' }]} subtitle="Pickup capability, serviceability, hours and holidays for your self-ship locations." actions={<Button type="primary" icon={<PlusOutlined />} onClick={() => open()}>Add warehouse</Button>} />
    <List grid={{ gutter: 16, xs: 1, lg: 2 }} dataSource={query.data} locale={{ emptyText: 'No warehouses yet.' }} renderItem={(row) => <List.Item>
      <Card title={<Flex gap={8} wrap><span>{row.label}</span>{row.isPrimary && <Tag color="blue">Primary</Tag>}<Tag color={row.status === 'INACTIVE' ? 'default' : 'green'}>{row.status ?? 'ACTIVE'}</Tag></Flex>} extra={<Button size="small" onClick={() => open(row)}>Edit</Button>}>
        <Typography.Paragraph>{row.line1}, {row.city}, {row.state} {row.pincode}</Typography.Paragraph>
        <Flex gap={8} wrap><Tag color={row.pickupCapable ? 'green' : 'default'}>{row.pickupCapable ? 'Pickup enabled' : 'Pickup disabled'}</Tag><Tag color={row.serviceability?.serviceable === false ? 'red' : 'cyan'}>PIN serviceable</Tag></Flex>
        <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>{row.contactName} · {row.contactPhone}<br />{row.holidays?.length ?? 0} holidays configured · {row.dependencies?.inventory?.length ?? 0} active stock rows</Typography.Paragraph>
        {row.status !== 'INACTIVE' && <Popconfirm title="Deactivate warehouse?" description="This is allowed only after stock and open orders are cleared." onConfirm={() => deactivate.mutate(row.id)}><Button danger size="small" disabled={row.isPrimary}>Deactivate</Button></Popconfirm>}
      </Card>
    </List.Item>} />
    <Modal width={760} title={editing?.id ? 'Edit warehouse' : 'Add warehouse'} open={Boolean(editing)} onCancel={() => setEditing(null)} onOk={() => form.submit()} confirmLoading={save.isPending}>
      <Form form={form} layout="vertical" onFinish={(values) => save.mutate(values)}>
        <Row gutter={12}><Col span={12}><Form.Item name="label" label="Warehouse name" rules={[{ required: true }]}><Input /></Form.Item></Col><Col span={12}><Form.Item name="contactName" label="Contact name" rules={[{ required: true }]}><Input /></Form.Item></Col></Row>
        <Form.Item name="line1" label="Address" rules={[{ required: true }]}><Input /></Form.Item>
        <Row gutter={12}><Col span={9}><Form.Item name="city" label="City" rules={[{ required: true }]}><Input /></Form.Item></Col><Col span={9}><Form.Item name="state" label="State" rules={[{ required: true }]}><Input /></Form.Item></Col><Col span={6}><Form.Item name="pincode" label="PIN" rules={[{ required: true }]}><Input maxLength={6} /></Form.Item></Col></Row>
        <Row gutter={12}><Col span={12}><Form.Item name="contactPhone" label="Contact phone" rules={[{ required: true }]}><Input /></Form.Item></Col><Col span={6}><Form.Item name="pickupCapable" valuePropName="checked"><Checkbox>Pickup capable</Checkbox></Form.Item></Col><Col span={6}><Form.Item name="isPrimary" valuePropName="checked"><Checkbox>Primary</Checkbox></Form.Item></Col></Row>
        <Typography.Title level={5}>Operating hours</Typography.Title>
        <Row gutter={8}>{DAYS.map((day) => <Col span={8} key={day}><Form.Item name={['operatingHours', day]} label={day.toUpperCase()}><Input placeholder="09:00-18:00 or CLOSED" /></Form.Item></Col>)}</Row>
        <Form.Item name="holidays" label="Holiday dates" normalize={(value) => value.split(',').map((item) => item.trim()).filter(Boolean)} getValueProps={(value) => ({ value: Array.isArray(value) ? value.join(', ') : value })}><Input placeholder="2026-12-25, 2027-01-01" /></Form.Item>
      </Form>
    </Modal>
  </Flex>;
}
