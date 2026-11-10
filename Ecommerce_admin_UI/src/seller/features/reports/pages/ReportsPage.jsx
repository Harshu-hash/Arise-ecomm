import { DeleteOutlined, FileExcelOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, Card, Col, Flex, Form, Modal, Popconfirm, Row, Select, Space, Switch, Table, Tag, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import dayjs from 'dayjs';
import DateRangeCompare from '@ui/components/DateRangeCompare';
import DateText from '@ui/components/DateText';
import ErrorState from '@ui/components/ErrorState';
import PageHeader from '@ui/components/PageHeader';
import ExportJobButton from '@ui/components/ExportJobButton';
import { sellerReportKeys, sellerReportsApi } from '../api/reports.api';

const REPORTS = [
  {
    key: 'orders', title: 'Orders report', description: 'Every order with status, value and dispatch SLA.', estimatedRows: 1000,
  },
  {
    key: 'transactions', title: 'Transactions & settlements', description: 'Delivered orders with settlement status and net payout.', estimatedRows: 2000,
  },
  {
    key: 'inventory', title: 'Inventory snapshot', description: 'Sellable, reserved and available stock across FBA warehouses.', estimatedRows: 1000,
  },
  {
    key: 'ads', title: 'Advertising performance', description: 'Spend, clicks, CTR and ROAS per campaign.', estimatedRows: 500,
  },
];

const REPORT_LABELS = Object.fromEntries(REPORTS.map((report) => [report.key, report.title]));

export default function ReportsPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [range, setRange] = useState({ from: dayjs().subtract(29, 'day').toISOString(), to: dayjs().toISOString(), compare: false });
  const [form] = Form.useForm();
  const schedules = useQuery({ queryKey: sellerReportKeys.schedules, queryFn: sellerReportsApi.schedules });
  const templates = useQuery({ queryKey: sellerReportKeys.templates, queryFn: sellerReportsApi.templates });
  const refreshSchedules = () => queryClient.invalidateQueries({ queryKey: sellerReportKeys.schedules });

  const createSchedule = useMutation({
    mutationFn: sellerReportsApi.createSchedule,
    onSuccess: () => { refreshSchedules(); setCreating(false); form.resetFields(); message.success('Report schedule created.'); },
    onError: (error) => message.error(error?.message ?? 'Could not create the schedule.'),
  });
  const toggleSchedule = useMutation({
    mutationFn: ({ id, enabled }) => sellerReportsApi.updateSchedule(id, { enabled }),
    onSuccess: refreshSchedules,
    onError: (error) => message.error(error?.message ?? 'Could not update the schedule.'),
  });
  const deleteSchedule = useMutation({
    mutationFn: sellerReportsApi.deleteSchedule,
    onSuccess: () => { refreshSchedules(); message.success('Schedule deleted.'); },
    onError: (error) => message.error(error?.message ?? 'Could not delete the schedule.'),
  });
  const createTemplate = useMutation({ mutationFn: sellerReportsApi.createTemplate, onSuccess: () => { queryClient.invalidateQueries({ queryKey: sellerReportKeys.templates }); message.success('Reusable report template saved.'); }, onError: (error) => message.error(error?.message ?? 'Could not save template.') });
  const deleteTemplate = useMutation({ mutationFn: sellerReportsApi.deleteTemplate, onSuccess: () => queryClient.invalidateQueries({ queryKey: sellerReportKeys.templates }) });

  return (
    <Flex vertical gap={16}>
      <PageHeader title="Reports" breadcrumbs={[{ label: 'Reports' }]} subtitle="Download data now or schedule delivery by email." />
      <Card size="small"><Flex justify="space-between" align="center" gap={12} wrap="wrap"><DateRangeCompare value={range} onChange={setRange} allowCompare={false} /><Typography.Text type="secondary">Generated files are retained for 30 days; jobs remain visible after reload.</Typography.Text></Flex></Card>
      <Row gutter={[16, 16]}>
        {REPORTS.map((report) => (
          <Col xs={24} sm={12} lg={6} key={report.key}>
            <Card size="small">
              <Flex vertical gap={10}>
                <FileExcelOutlined style={{ fontSize: 22, color: 'var(--ant-color-success)' }} />
                <div><Typography.Text strong>{report.title}</Typography.Text><div><Typography.Text type="secondary" style={{ fontSize: 12 }}>{report.description}</Typography.Text></div></div>
                <Space wrap><ExportJobButton resource={report.key} label="Export" estimatedRows={report.estimatedRows} filters={{ from: range.from, to: range.to }} /><Button size="small" type="link" loading={createTemplate.isPending} onClick={() => createTemplate.mutate({ name: `${report.title} · saved`, reportKey: report.key, filters: { from: range.from, to: range.to }, format: 'CSV' })}>Save template</Button></Space>
              </Flex>
            </Card>
          </Col>
        ))}
      </Row>

      <Card title="Saved templates" size="small" styles={{ body: { padding: 0 } }}>
        <Table rowKey="id" size="small" pagination={false} loading={templates.isLoading} dataSource={templates.data ?? []} locale={{ emptyText: 'No saved report templates.' }} columns={[{ title: 'Template', dataIndex: 'name' }, { title: 'Report', dataIndex: 'reportKey', render: (value) => REPORT_LABELS[value] ?? value }, { title: 'Format', dataIndex: 'format' }, { title: 'Retention', dataIndex: 'retentionDays', render: (value) => `${value} days` }, { title: '', key: 'actions', render: (_value, row) => <Popconfirm title="Delete this template?" onConfirm={() => deleteTemplate.mutate(row.id)}><Button type="text" danger icon={<DeleteOutlined />} /></Popconfirm> }]} />
      </Card>

      <Card title="Scheduled email reports" size="small" extra={<Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>New schedule</Button>} styles={{ body: { padding: 0 } }}>
        {schedules.isError ? <ErrorState error={schedules.error} onRetry={schedules.refetch} title="Could not load report schedules" /> : (
          <Table
            rowKey="id"
            loading={schedules.isLoading}
            dataSource={schedules.data ?? []}
            pagination={false}
            scroll={{ x: 'max-content' }}
            locale={{ emptyText: 'No scheduled reports yet.' }}
            columns={[
              { title: 'Report', dataIndex: 'reportKey', render: (value) => REPORT_LABELS[value] ?? value },
              { title: 'Frequency', dataIndex: 'frequency', render: (value) => <Tag>{value}</Tag> },
              { title: 'Format', dataIndex: 'format' },
              { title: 'Recipients', dataIndex: 'recipients', render: (values) => values.join(', ') },
              { title: 'Next delivery', dataIndex: 'nextRunAt', render: (value) => <DateText value={value} withTime /> },
              { title: 'Enabled', dataIndex: 'enabled', render: (value, row) => <Switch size="small" checked={value} loading={toggleSchedule.isPending} onChange={(enabled) => toggleSchedule.mutate({ id: row.id, enabled })} /> },
              { title: '', key: 'actions', align: 'right', render: (_value, row) => <Popconfirm title="Delete this schedule?" onConfirm={() => deleteSchedule.mutate(row.id)}><Button type="text" danger icon={<DeleteOutlined />} aria-label="Delete schedule" /></Popconfirm> },
            ]}
          />
        )}
      </Card>

      <Modal title="New scheduled report" open={creating} onCancel={() => setCreating(false)} onOk={() => form.validateFields().then((values) => createSchedule.mutate(values))} okText="Create schedule" okButtonProps={{ loading: createSchedule.isPending }} destroyOnHidden>
        <Form form={form} layout="vertical" initialValues={{ frequency: 'WEEKLY', format: 'CSV' }}>
          <Form.Item name="reportKey" label="Report" rules={[{ required: true, message: 'Choose a report.' }]}>
            <Select options={REPORTS.map((report) => ({ value: report.key, label: report.title }))} />
          </Form.Item>
          <Space align="start" style={{ width: '100%' }}>
            <Form.Item name="frequency" label="Frequency" style={{ minWidth: 180 }}><Select options={[{ value: 'DAILY', label: 'Daily' }, { value: 'WEEKLY', label: 'Weekly' }, { value: 'MONTHLY', label: 'Monthly' }]} /></Form.Item>
            <Form.Item name="format" label="Format" style={{ minWidth: 140 }}><Select options={[{ value: 'CSV', label: 'CSV' }, { value: 'XLSX', label: 'Excel (.xlsx)' }]} /></Form.Item>
          </Space>
          <Form.Item name="recipients" label="Recipient emails" rules={[{ required: true, message: 'Add at least one recipient.' }]} extra="Press Enter after each email.">
            <Select mode="tags" tokenSeparators={[',', ' ']} placeholder="finance@yourstore.com" />
          </Form.Item>
        </Form>
      </Modal>
    </Flex>
  );
}
