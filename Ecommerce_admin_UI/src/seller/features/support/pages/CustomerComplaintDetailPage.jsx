import { App, Avatar, Button, Card, Descriptions, Flex, Form, Input, List, Modal, Space, Tag, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import DateText from '@ui/components/DateText';
import ErrorState from '@ui/components/ErrorState';
import FullPageSpinner from '@ui/components/FullPageSpinner';
import PageHeader from '@ui/components/PageHeader';
import StatusTag from '@ui/components/StatusTag';
import { supportApi, supportKeys } from '../api/support.api';

export default function CustomerComplaintDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const [replyForm] = Form.useForm();
  const [resolving, setResolving] = useState(false);
  const query = useQuery({ queryKey: supportKeys.customerComplaint(id), queryFn: () => supportApi.customerComplaint(id) });
  const refresh = () => { queryClient.invalidateQueries({ queryKey: supportKeys.customerComplaint(id) }); queryClient.invalidateQueries({ queryKey: ['seller', 'support', 'customer-complaints'] }); };
  const replyMutation = useMutation({ mutationFn: ({ text }) => supportApi.replyToCustomer(id, text), onSuccess: () => { replyForm.resetFields(); refresh(); message.success('Reply sent.'); }, onError: (error) => message.error(error?.message) });
  const resolveMutation = useMutation({ mutationFn: ({ resolution }) => supportApi.resolveCustomerComplaint(id, resolution), onSuccess: () => { setResolving(false); form.resetFields(); refresh(); message.success('Complaint marked resolved.'); }, onError: (error) => message.error(error?.message) });
  if (query.isLoading) return <FullPageSpinner label="Loading customer complaint…" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />;
  const complaint = query.data;
  const closed = ['RESOLVED', 'CLOSED'].includes(complaint.status);
  return (
    <Flex vertical gap={16}>
      <PageHeader title={complaint.subject} breadcrumbs={[{ label: 'Support' }, { label: 'Customer complaints', to: '/support/customer-complaints' }, { label: complaint.id }]} onBack={() => navigate('/support/customer-complaints')} tags={<StatusTag domain="ticket" code={complaint.status} />} actions={!closed && <Button type="primary" onClick={() => setResolving(true)}>Resolve complaint</Button>} />
      <Card size="small"><Descriptions column={{ xs: 1, md: 3 }} items={[
        { key: 'customer', label: 'Customer', children: complaint.customerName },
        { key: 'order', label: 'Order', children: <Typography.Text className="mono">{complaint.orderId}</Typography.Text> },
        { key: 'priority', label: 'Priority', children: <Tag>{complaint.priority}</Tag> },
        { key: 'products', label: 'Your products', span: 3, children: complaint.products.join(', ') },
      ]} /></Card>
      <Card title="Conversation">
        <List dataSource={complaint.events} locale={{ emptyText: 'No public messages yet.' }} renderItem={(event) => <List.Item><List.Item.Meta avatar={<Avatar>{event.authorName?.[0]}</Avatar>} title={<Space wrap><Typography.Text strong>{event.authorName}</Typography.Text><Tag>{event.authorType}</Tag><Typography.Text type="secondary"><DateText value={event.createdAt} withTime /></Typography.Text></Space>} description={event.body} /></List.Item>} />
        {!closed && <Form form={replyForm} onFinish={(values) => replyMutation.mutate(values)}><Space.Compact style={{ width: '100%', marginTop: 12 }}><Form.Item name="text" noStyle rules={[{ required: true, whitespace: true, message: 'Write a reply.' }]}><Input.TextArea rows={3} placeholder="Reply to the customer about this complaint" /></Form.Item><Button htmlType="submit" type="primary" style={{ height: 'auto' }} loading={replyMutation.isPending}>Send</Button></Space.Compact></Form>}
      </Card>
      <Modal title="Resolve customer complaint" open={resolving} onCancel={() => setResolving(false)} onOk={() => form.submit()} okText="Mark resolved" confirmLoading={resolveMutation.isPending}><Form form={form} layout="vertical" onFinish={(values) => resolveMutation.mutate(values)}><Form.Item name="resolution" label="Resolution shared with customer" rules={[{ required: true, whitespace: true, message: 'Describe how the complaint was resolved.' }]}><Input.TextArea rows={4} placeholder="Explain the action taken and any next steps." /></Form.Item></Form></Modal>
    </Flex>
  );
}
