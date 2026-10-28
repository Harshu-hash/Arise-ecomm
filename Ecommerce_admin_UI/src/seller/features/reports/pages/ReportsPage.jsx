import { DownloadOutlined, FileExcelOutlined } from '@ant-design/icons';
import { App, Button, Card, Col, Flex, List, Row, Typography } from 'antd';
import * as XLSX from 'xlsx';
import { useState } from 'react';
import { api } from '@core/api/axiosInstance';
import { paiseToRupees } from '@core/utils/money';
import PageHeader from '@ui/components/PageHeader';

/**
 * A small, real report library: each card pulls the seller's own data over
 * the same endpoints the rest of the panel uses and exports it as a CSV —
 * no fake "report job" queue, because there is nothing asynchronous about it
 * at this data volume.
 */
function downloadCsv(filename, rows) {
  if (!rows.length) return false;
  const sheet = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(sheet);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

const REPORTS = [
  {
    key: 'orders',
    title: 'Orders report',
    description: 'Every order with status, value and dispatch SLA.',
    run: async () => {
      const res = await api.get('/orders', { pageSize: 1000 });
      return res.data.map((o) => ({
        Order: o.orderId, Status: o.status, Items: o.itemCount, 'Value (₹)': paiseToRupees(o.totalPaise),
        Prepaid: o.prepaid ? 'Yes' : 'No', 'Placed at': o.placedAt,
      }));
    },
  },
  {
    key: 'transactions',
    title: 'Transactions & settlements',
    description: 'Every delivered order with its settlement status and net payout.',
    run: async () => {
      const res = await api.get('/finance/transactions', { pageSize: 2000 });
      return res.data.map((t) => ({
        Order: t.orderId, Product: t.productTitle, 'Sale (₹)': paiseToRupees(t.salePaise),
        'Fees (₹)': paiseToRupees(t.feesBeforeTaxPaise), 'Net (₹)': paiseToRupees(t.netPaise), Status: t.status, 'Delivered at': t.deliveredAt,
      }));
    },
  },
  {
    key: 'inventory',
    title: 'Inventory snapshot',
    description: 'Sellable, reserved and available stock across your FBA warehouses.',
    run: async () => {
      const res = await api.get('/inventory', { pageSize: 1000 });
      return res.data.map((i) => ({
        SKU: i.sku, Product: i.productTitle, Warehouse: i.warehouseCode,
        Sellable: i.sellable, Reserved: i.reserved, Available: i.available, 'Days of cover': i.daysOfCover ?? '',
      }));
    },
  },
  {
    key: 'ads',
    title: 'Advertising performance',
    description: 'Spend, clicks, CTR and ROAS per campaign.',
    run: async () => {
      const res = await api.get('/ads/campaigns', { pageSize: 500 });
      return res.data.map((c) => ({
        Campaign: c.name, Status: c.status, 'Spend (₹)': paiseToRupees(c.spendPaise),
        Clicks: c.clicks, 'CTR (%)': c.ctrPct, ROAS: c.roas,
      }));
    },
  },
];

export default function ReportsPage() {
  const { message } = App.useApp();
  const [running, setRunning] = useState(null);

  const run = async (report) => {
    setRunning(report.key);
    try {
      const rows = await report.run();
      const ok = downloadCsv(`arise-${report.key}-${new Date().toISOString().slice(0, 10)}.csv`, rows);
      if (ok) message.success(`${report.title} downloaded.`);
      else message.info('Nothing to export yet.');
    } catch (e) {
      message.error(e?.message ?? 'Could not generate the report.');
    } finally {
      setRunning(null);
    }
  };

  return (
    <Flex vertical gap={16}>
      <PageHeader title="Reports" breadcrumbs={[{ label: 'Reports' }]} subtitle="Download your data as a CSV, ready for Excel or Google Sheets." />
      <Row gutter={[16, 16]}>
        {REPORTS.map((r) => (
          <Col xs={24} sm={12} lg={6} key={r.key}>
            <Card size="small">
              <Flex vertical gap={10} style={{ height: '100%' }}>
                <FileExcelOutlined style={{ fontSize: 22, color: 'var(--ant-color-success)' }} />
                <div>
                  <Typography.Text strong>{r.title}</Typography.Text>
                  <div><Typography.Text type="secondary" style={{ fontSize: 12 }}>{r.description}</Typography.Text></div>
                </div>
                <Button icon={<DownloadOutlined />} loading={running === r.key} onClick={() => run(r)} block>
                  Download CSV
                </Button>
              </Flex>
            </Card>
          </Col>
        ))}
      </Row>

      <Card title="Need something scheduled?" size="small">
        <List
          size="small"
          dataSource={[
            'Weekly settlement report — every Monday, by email',
            'Monthly GST sales register — 1st of the month',
          ]}
          renderItem={(item) => <List.Item>{item}</List.Item>}
        />
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>Scheduled, emailed reports are coming soon.</Typography.Text>
      </Card>
    </Flex>
  );
}
