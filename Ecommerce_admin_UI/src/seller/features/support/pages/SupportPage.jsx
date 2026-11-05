import { PlusOutlined } from '@ant-design/icons';
import { Alert, App, Button, Card, Collapse, Flex, Form, Input, Modal, Select, Space, Tag, Typography } from 'antd';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import DataTable from '@ui/components/DataTable/DataTable';
import DateText from '@ui/components/DateText';
import DocumentUpload from '@ui/components/DocumentUpload';
import PageHeader from '@ui/components/PageHeader';
import StatusTag from '@ui/components/StatusTag';
import useListQuery from '@ui/hooks/useListQuery';
import useUrlTableState from '@ui/hooks/useUrlTableState';
import { supportApi, supportKeys } from '../api/support.api';

const SUBJECTS = ['Delivery Issue', 'Payment Issue', 'Product Quality', 'Refund Query', 'Account Issue'];

export default function SupportPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [helpTerm, setHelpTerm] = useState('');
  const [attachments, setAttachments] = useState([]);
  const state = useUrlTableState({ defaultSort: '-createdAt' });

  const { rows, meta, loading, error, refetch, fetching } = useListQuery({
    queryKey: supportKeys.list(state.queryParams),
    url: '/support/tickets',
    params: state.queryParams,
  });
  const helpQuery = useQuery({ queryKey: supportKeys.help(helpTerm), queryFn: () => supportApi.help(helpTerm) });
  const contextQuery = useQuery({ queryKey: supportKeys.contextOptions, queryFn: supportApi.contextOptions });
  const incidentQuery = useQuery({ queryKey: supportKeys.incidents, queryFn: supportApi.incidents });

  const submit = async (values) => {
    setSaving(true);
    try {
      const context = values.context ? JSON.parse(values.context) : {};
      const ticket = await supportApi.create({ ...values, context: undefined, ...context, attachments: attachments.map((item) => item.mediaId) });
      message.success('Ticket raised.');
      setOpen(false);
      form.resetFields();
      setAttachments([]);
      navigate(`/support/${ticket.id}`);
    } catch (e) {
      message.error(e?.message ?? 'Could not raise the ticket.');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      key: 'subject', title: 'Subject', dataIndex: 'subject', priority: 1,
      render: (v, r) => <div><Typography.Text strong>{v}</Typography.Text><div><Typography.Text type="secondary" style={{ fontSize: 12 }}>{r.id}{r.orderId ? ` · ${r.orderId}` : ''}</Typography.Text></div></div>,
    },
    { key: 'priority', title: 'Priority', dataIndex: 'priority', width: 100, priority: 2, render: (p) => <Tag color={p === 'HIGH' ? 'red' : p === 'MEDIUM' ? 'gold' : 'default'}>{p}</Tag> },
    { key: 'createdAt', title: 'Raised', dataIndex: 'createdAt', width: 130, priority: 2, sorter: true, render: (v) => <DateText value={v} /> },
    { key: 'status', title: 'Status', dataIndex: 'status', width: 160, priority: 1, render: (s) => <StatusTag domain="ticket" code={s} /> },
  ];

  return (
    <Flex vertical gap={12}>
      <PageHeader
        title="Help & Support"
        breadcrumbs={[{ label: 'Support' }]}
        subtitle="Raise a ticket with the Arise seller support team."
        actions={<Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>Raise a ticket</Button>}
      />

      {(incidentQuery.data ?? []).map((incident) => <Alert key={incident.id} type={incident.status === 'OPERATIONAL' ? 'success' : incident.severity} showIcon message={incident.title} description={incident.body} />)}

      <Card title="Search seller help" size="small">
        <Input.Search allowClear placeholder="Search published help articles" value={helpTerm} onChange={(e) => setHelpTerm(e.target.value)} />
        <Collapse style={{ marginTop: 12 }} items={(helpQuery.data ?? []).slice(0, 8).map((article) => ({ key: article.id, label: article.question, children: <><Typography.Paragraph>{article.answer}</Typography.Paragraph><Tag>{article.category}</Tag></> }))} />
      </Card>

      <DataTable
        tableId="seller-tickets"
        columns={columns}
        rows={rows}
        meta={meta}
        loading={loading || fetching}
        error={error}
        onRetry={refetch}
        tableState={state}
        onRowClick={(row) => navigate(`/support/${row.id}`)}
        emptyProps={{ title: 'No tickets yet', description: 'Raise a ticket if you need help from the Arise support team.' }}
        mobileCard={(row) => (
          <Flex vertical gap={6}>
            <Flex justify="space-between" align="flex-start" gap={8}>
              <div><Typography.Text strong>{row.subject}</Typography.Text><div><Typography.Text type="secondary" style={{ fontSize: 12 }}>{row.id}</Typography.Text></div></div>
              <StatusTag domain="ticket" code={row.status} />
            </Flex>
            <Space size={8} wrap>
              <Tag>{row.priority}</Tag>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}><DateText value={row.createdAt} /></Typography.Text>
            </Space>
          </Flex>
        )}
      />

      <Modal title="Raise a ticket" open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} okText="Submit" confirmLoading={saving}>
        <Form form={form} layout="vertical" onFinish={submit}>
          <Form.Item name="subject" label="What's this about?" rules={[{ required: true, message: 'Choose a subject.' }]}>
            <Select options={SUBJECTS.map((s) => ({ value: s, label: s }))} placeholder="Select a category" />
          </Form.Item>
          <Form.Item name="context" label="Link a record">
            <Select showSearch allowClear optionFilterProp="label" placeholder="Order, listing, payout or return" options={(contextQuery.data ?? []).map((item) => ({ value: JSON.stringify({ contextType: item.type, contextId: item.id }), label: item.label }))} />
          </Form.Item>
          <Form.Item label="Attachments"><DocumentUpload value={attachments} onChange={setAttachments} maxCount={5} label="Ticket attachments" /></Form.Item>
          <Form.Item name="text" label="Describe the issue" rules={[{ required: true, message: 'Describe the issue.' }]}>
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>
    </Flex>
  );
}
