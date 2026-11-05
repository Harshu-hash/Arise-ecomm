/* eslint-disable max-lines */
import { DownloadOutlined, InboxOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  App,
  Alert,
  Button,
  Card,
  Flex,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
} from 'antd';
import { useEffect, useState } from 'react';
import Papa from 'papaparse';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@ui/components/PageHeader';
import { listingsApi } from '../api/listings.api';

const OPERATIONS = [
  ['CREATE_PRODUCTS', 'Create new products'],
  ['ATTACH_OFFERS', 'Attach offers to catalogue products'],
  ['UPDATE_PRICE', 'Update prices'],
  ['UPDATE_STOCK', 'Update stock'],
  ['UPDATE_CONTENT', 'Update product content'],
];

export default function BulkUploadPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [operation, setOperation] = useState('UPDATE_PRICE');
  const [rows, setRows] = useState([]);
  const [preflight, setPreflight] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [busy, setBusy] = useState(false);

  const loadJobs = async () => setJobs(await listingsApi.bulkJobs());
  useEffect(() => {
    loadJobs().catch(() => undefined);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const downloadTemplate = async () => {
    try {
      const template = await listingsApi.bulkTemplates(null, operation);
      const csv = Papa.unparse({
        fields: template.columns,
        data: [Object.fromEntries(template.columns.map((column) => [column, '']))],
      });
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${operation.toLowerCase()}-template.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      message.error(error?.message ?? 'Could not download the template.');
    }
  };

  const parseFile = (file) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data }) => {
        setRows(data);
        setPreflight(null);
        message.success(`Parsed ${data.length} rows.`);
      },
      error: () => message.error('Could not read that CSV file.'),
    });
    return false;
  };

  const validate = async () => {
    setBusy(true);
    try {
      setPreflight(await listingsApi.bulkPreflight({ operation, rows }));
    } catch (error) {
      message.error(error?.message ?? 'Preflight failed.');
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    setBusy(true);
    try {
      const job = await listingsApi.createBulkJob({ operation, rows });
      message.success(`Bulk job ${job.id} completed.`);
      setRows([]);
      setPreflight(null);
      await loadJobs();
    } catch (error) {
      message.error(error?.message ?? 'Could not start the bulk job.');
    } finally {
      setBusy(false);
    }
  };

  const retry = async (job) => {
    setBusy(true);
    try {
      await listingsApi.retryBulkJob(job.id, rows.length ? rows : undefined);
      message.success('Failed rows retried.');
      await loadJobs();
    } catch (error) {
      message.error(error?.message ?? 'Retry failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Flex vertical gap={16}>
      <PageHeader
        title="Bulk catalogue jobs"
        breadcrumbs={[{ label: 'Listings', to: '/listings' }, { label: 'Bulk jobs' }]}
        onBack={() => navigate('/listings')}
        subtitle="Preflight every row before committing catalogue, offer, price, stock, or content changes."
        actions={
          <Button icon={<DownloadOutlined />} onClick={downloadTemplate}>
            Download template
          </Button>
        }
      />
      <Card>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Select
            value={operation}
            style={{ width: 360, maxWidth: '100%' }}
            onChange={(value) => {
              setOperation(value);
              setRows([]);
              setPreflight(null);
            }}
            options={OPERATIONS.map(([value, label]) => ({ value, label }))}
          />
          <Upload.Dragger
            accept=".csv"
            multiple={false}
            beforeUpload={parseFile}
            showUploadList={false}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">Drop the completed CSV here</p>
            <p className="ant-upload-hint">
              Nothing is changed until preflight is reviewed and committed.
            </p>
          </Upload.Dragger>
          {rows.length > 0 && (
            <Button type="primary" loading={busy} onClick={validate}>
              Run preflight for {rows.length} rows
            </Button>
          )}
        </Space>
      </Card>

      {preflight && (
        <Card
          title="Preflight results"
          extra={
            <Button type="primary" loading={busy} disabled={!preflight.validRows} onClick={commit}>
              Commit {preflight.validRows} valid rows
            </Button>
          }
        >
          <Alert
            type={preflight.invalidRows ? 'warning' : 'success'}
            showIcon
            message={`${preflight.validRows} valid · ${preflight.invalidRows} invalid · ${preflight.warningRows} with warnings`}
            style={{ marginBottom: 12 }}
          />
          <Table
            rowKey="line"
            size="small"
            dataSource={preflight.rows}
            pagination={{ pageSize: 10 }}
            columns={[
              { title: 'Line', dataIndex: 'line', width: 70 },
              {
                title: 'Status',
                dataIndex: 'valid',
                width: 100,
                render: (valid) => (
                  <Tag color={valid ? 'green' : 'red'}>{valid ? 'VALID' : 'ERROR'}</Tag>
                ),
              },
              {
                title: 'Errors',
                dataIndex: 'errors',
                render: (items) => items?.join(' · ') || '—',
              },
              {
                title: 'Warnings',
                dataIndex: 'warnings',
                render: (items) => items?.join(' · ') || '—',
              },
            ]}
          />
        </Card>
      )}

      <Card
        title="Job history"
        extra={
          <Button
            icon={<ReloadOutlined />}
            onClick={() => loadJobs().catch(() => message.error('Could not refresh jobs.'))}
          >
            Refresh
          </Button>
        }
      >
        <Table
          rowKey="id"
          size="small"
          dataSource={jobs}
          pagination={{ pageSize: 10 }}
          columns={[
            {
              title: 'Job',
              dataIndex: 'label',
              render: (label, job) => (
                <>
                  <Typography.Text strong>{label}</Typography.Text>
                  <br />
                  <Typography.Text type="secondary">{job.id}</Typography.Text>
                </>
              ),
            },
            {
              title: 'Status',
              dataIndex: 'status',
              render: (status) => (
                <Tag color={status === 'COMPLETED' ? 'green' : 'orange'}>{status}</Tag>
              ),
            },
            { title: 'Rows', render: (_, job) => `${job.processedRows}/${job.totalRows}` },
            { title: 'Failed', dataIndex: 'failRows' },
            {
              title: 'Result',
              render: (_, job) =>
                job.resultUrl ? (
                  <Typography.Link href={job.resultUrl}>Error file</Typography.Link>
                ) : (
                  '—'
                ),
            },
            {
              title: '',
              render: (_, job) =>
                job.failRows > 0 ? (
                  <Button size="small" loading={busy} onClick={() => retry(job)}>
                    Retry failed
                  </Button>
                ) : null,
            },
          ]}
        />
      </Card>
    </Flex>
  );
}
