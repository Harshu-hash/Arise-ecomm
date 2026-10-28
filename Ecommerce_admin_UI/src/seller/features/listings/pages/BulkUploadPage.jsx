import { CheckCircleTwoTone, CloseCircleTwoTone, DownloadOutlined, InboxOutlined } from '@ant-design/icons';
import { App, Alert, Button, Card, Flex, Space, Table, Tag, Typography, Upload } from 'antd';
import { useState } from 'react';
import Papa from 'papaparse';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@ui/components/PageHeader';
import { listingsApi } from '../api/listings.api';

const TEMPLATE_COLUMNS = [
  'title', 'category', 'brand', 'mrp', 'price', 'stock', 'sku', 'images', 'description',
  'weightG', 'dimsL', 'dimsW', 'dimsH', 'returnWindowDays', 'returnType', 'colour', 'size',
];
const SAMPLE_ROWS = [
  ['Nova Cotton T-Shirt', 'T-Shirts', 'Nova', '999', '499', '30', 'NOVA-TEE-RED-M', 'https://example.com/tee-red.jpg', 'Soft combed cotton', '220', '30', '25', '3', '10', 'RETURN', 'Red', 'M'],
  ['Nova Cotton T-Shirt', 'T-Shirts', 'Nova', '999', '519', '20', 'NOVA-TEE-BLUE-L', 'https://example.com/tee-blue.jpg', 'Soft combed cotton', '230', '30', '25', '3', '10', 'RETURN', 'Blue', 'L'],
];

export default function BulkUploadPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const downloadTemplate = () => {
    const csv = Papa.unparse({ fields: TEMPLATE_COLUMNS, data: SAMPLE_ROWS });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'arise-listings-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseFile = (file) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data }) => {
        setResult(null);
        setRows(data.map((r, i) => ({ key: i, ...r })));
        message.success(`Parsed ${data.length} rows.`);
      },
      error: () => message.error('Could not read that CSV file.'),
    });
    return false; // prevent AntD auto-upload
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await listingsApi.bulk(rows.map(({ key, ...r }) => r)); // eslint-disable-line no-unused-vars
      setResult(res);
      if (res.created) message.success(`${res.created} listing${res.created === 1 ? '' : 's'} submitted for QC.`);
      if (res.failed) message.warning(`${res.failed} row${res.failed === 1 ? '' : 's'} had errors.`);
    } catch (e) {
      message.error(e?.message ?? 'Bulk upload failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const previewColumns = TEMPLATE_COLUMNS.map((c) => ({
    title: c[0].toUpperCase() + c.slice(1),
    dataIndex: c,
    ellipsis: true,
  }));

  return (
    <Flex vertical gap={16}>
      <PageHeader
        title="Bulk upload"
        breadcrumbs={[{ label: 'Listings', to: '/listings' }, { label: 'Bulk upload' }]}
        onBack={() => navigate('/listings')}
        subtitle="Upload a CSV to create many listings at once. Each goes through QC."
        actions={
          <Button icon={<DownloadOutlined />} onClick={downloadTemplate}>
            Download template
          </Button>
        }
      />

      <Alert
        type="info"
        showIcon
        message="Rows with the same title and category become one product"
        description="Give each colour/size combination its own row with the same title — they'll be created as variants of a single listing. Separate multiple image URLs in the images column with a | character."
      />

      <Card>
        <Upload.Dragger accept=".csv" multiple={false} beforeUpload={parseFile} showUploadList={false}>
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="ant-upload-text">Click or drag your CSV here</p>
          <p className="ant-upload-hint">Columns: {TEMPLATE_COLUMNS.join(', ')}</p>
        </Upload.Dragger>
      </Card>

      {rows.length > 0 && !result && (
        <Card
          title={`Preview — ${rows.length} rows`}
          extra={
            <Space>
              <Button onClick={() => setRows([])}>Clear</Button>
              <Button type="primary" loading={submitting} onClick={submit}>
                Submit {rows.length} listings
              </Button>
            </Space>
          }
        >
          <Table size="small" columns={previewColumns} dataSource={rows} pagination={{ pageSize: 10 }} scroll={{ x: 'max-content' }} />
        </Card>
      )}

      {result && (
        <Card title="Upload result">
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Space>
              <Tag color="green">{result.created} created</Tag>
              {result.failed > 0 && <Tag color="red">{result.failed} failed</Tag>}
            </Space>
            <Table
              size="small"
              rowKey="line"
              pagination={{ pageSize: 10 }}
              dataSource={result.results}
              columns={[
                { title: 'Line', dataIndex: 'line', width: 70 },
                { title: 'Title', dataIndex: 'title', ellipsis: true },
                {
                  title: 'Result',
                  dataIndex: 'ok',
                  width: 220,
                  render: (okFlag, row) =>
                    okFlag ? (
                      <Space><CheckCircleTwoTone twoToneColor="#26A541" /> <Typography.Text>Submitted</Typography.Text></Space>
                    ) : (
                      <Space><CloseCircleTwoTone twoToneColor="#FF4D4F" /> <Typography.Text type="danger">{row.errors?.join(', ')}</Typography.Text></Space>
                    ),
                },
              ]}
            />
            {result.created > 0 && (
              <Alert type="success" showIcon message={<>Your new listings are in QC. <Typography.Link onClick={() => navigate('/listings?tab=QC_PENDING')}>View them</Typography.Link></>} />
            )}
          </Space>
        </Card>
      )}
    </Flex>
  );
}
