import { InboxOutlined } from '@ant-design/icons';
import { Alert, App, Button, Col, Flex, Form, Input, InputNumber, Modal, Row, Select, Space, Tag, Typography } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from '@ui/components/DataTable/DataTable';
import FilterBar from '@ui/components/FilterBar';
import PageHeader from '@ui/components/PageHeader';
import StatCard from '@ui/components/StatCard';
import useListQuery from '@ui/hooks/useListQuery';
import useUrlTableState from '@ui/hooks/useUrlTableState';
import { inventoryApi, inventoryKeys } from '../api/inventory.api';

export default function InventoryPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [removal, setRemoval] = useState(null);
  const [stockRow, setStockRow] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkJob, setBulkJob] = useState(null);
  const [insight, setInsight] = useState(null);
  const [insightRows, setInsightRows] = useState([]);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [stockForm] = Form.useForm();
  const state = useUrlTableState({ defaultSort: '-sellable' });

  const { rows, meta, loading, error, refetch, fetching } = useListQuery({
    queryKey: inventoryKeys.list(state.queryParams),
    url: '/inventory',
    params: state.queryParams,
  });
  const counts = meta?.counts ?? {};

  const openRemoval = (row) => { setRemoval(row); form.setFieldsValue({ qty: Math.max(1, Math.floor(row.sellable / 2)), type: 'RETURN_TO_SELLER' }); };
  const submitRemoval = async (values) => {
    setSaving(true);
    try {
      await inventoryApi.createRemoval(removal.id, values);
      message.success('Removal order requested.');
      setRemoval(null);
      refetch();
    } catch (e) {
      message.error(e?.message ?? 'Could not request removal.');
    } finally {
      setSaving(false);
    }
  };
  const submitStock = async (values) => {
    setSaving(true);
    try {
      await inventoryApi.updateStock(stockRow.id, { sellable: values.sellable, version: stockRow.version, note: values.note });
      message.success('Self-ship stock updated. Customer availability is current.');
      setStockRow(null);
      refetch();
    } catch (e) { message.error(e?.message ?? 'Could not update stock.'); } finally { setSaving(false); }
  };
  const bulkChanges = () => bulkText.split(/\r?\n/).map((line) => {
    const [sku, value] = line.split(',').map((part) => part.trim());
    const row = rows.find((item) => item.sku === sku && item.fulfillmentType === 'SELLER');
    return row && Number.isInteger(Number(value)) ? { inventoryId: row.id, sellable: Number(value), version: row.version } : null;
  }).filter(Boolean);
  const submitBulk = async () => {
    const changes = bulkChanges();
    if (!changes.length) return message.error('Enter at least one visible self-ship SKU and quantity.');
    setSaving(true);
    try { const job = await inventoryApi.bulkStock(changes); setBulkJob(job); message.success('Bulk update completed.'); refetch(); } catch (e) { message.error(e?.message ?? 'Bulk update failed.'); } finally { setSaving(false); }
  };
  const retryBulk = async () => {
    const failedIds = new Set(bulkJob.results.filter((item) => item.status === 'FAILED').map((item) => item.inventoryId));
    const changes = bulkChanges().filter((item) => failedIds.has(item.inventoryId)).map((item) => ({ ...item, version: rows.find((row) => row.id === item.inventoryId)?.version ?? item.version }));
    setSaving(true);
    try { const job = await inventoryApi.retryBulkStock(bulkJob.id, changes); setBulkJob(job); message.success('Failed rows retried.'); refetch(); } catch (e) { message.error(e?.message ?? 'Retry failed.'); } finally { setSaving(false); }
  };
  const openInsight = async (kind) => {
    setInsight(kind); setInsightRows([]);
    try { setInsightRows(kind === 'replenishment' ? await inventoryApi.recommendations() : await inventoryApi.removals()); } catch (e) { message.error(e?.message ?? 'Could not load inventory insights.'); }
  };

  const columns = [
    { key: 'sku', title: 'SKU', dataIndex: 'sku', priority: 1, render: (sku, r) => (
      <div><Typography.Text strong>{r.productTitle}</Typography.Text><div><Typography.Text type="secondary" style={{ fontSize: 12 }}>{sku} · {r.variantLabel ?? ''}</Typography.Text></div></div>
    ) },
    { key: 'warehouseCode', title: 'Warehouse', dataIndex: 'warehouseCode', width: 110 },
    { key: 'fulfillmentType', title: 'Fulfilment', dataIndex: 'fulfillmentType', width: 100, render: (v) => <Tag color={v === 'SELLER' ? 'blue' : 'purple'}>{v === 'SELLER' ? 'Self-ship' : 'FBA'}</Tag> },
    { key: 'sellable', title: 'Sellable', dataIndex: 'sellable', align: 'right', width: 90, sorter: true },
    { key: 'reserved', title: 'Reserved', dataIndex: 'reserved', align: 'right', width: 90 },
    { key: 'available', title: 'Available', dataIndex: 'available', align: 'right', width: 100, sorter: true, render: (v, r) => (
      <Typography.Text type={r.lowStock ? 'danger' : undefined} strong>{v}</Typography.Text>
    ) },
    { key: 'daysOfCover', title: 'Days cover', dataIndex: 'daysOfCover', align: 'right', width: 110, sorter: true, render: (v) => v ?? '—' },
    { key: 'flags', title: '', width: 150, render: (_, r) => (
      <Flex gap={4} wrap>
        {r.lowStock && <Tag color="red" style={{ margin: 0 }}>Low</Tag>}
        {r.aged && <Tag color="orange" style={{ margin: 0 }}>Aged</Tag>}
      </Flex>
    ) },
    { key: 'action', title: '', width: 230, render: (_, r) => (
      <Flex gap={6}><Button size="small" onClick={() => navigate(`/inventory/ledger/${r.id}`)}>Ledger</Button>{r.fulfillmentType === 'SELLER' ? <Button size="small" type="primary" onClick={() => { setStockRow(r); stockForm.setFieldsValue({ sellable: r.sellable }); }}>Update stock</Button> : <Button size="small" onClick={() => openRemoval(r)} disabled={r.sellable === 0}>Remove</Button>}</Flex>
    ) },
  ];

  return (
    <Flex vertical gap={12}>
      <PageHeader
        title="Inventory"
        breadcrumbs={[{ label: 'Inventory' }]}
        subtitle="Self-ship and Fulfilled-by-Arise stock, reservations, ageing and replenishment cover."
        actions={<Space wrap><Button onClick={() => openInsight('replenishment')}>Replenishment</Button><Button onClick={() => openInsight('removals')}>Removal tracking</Button><Button onClick={() => { setBulkOpen(true); setBulkJob(null); }}>Bulk stock update</Button><Button type="primary" icon={<InboxOutlined />} onClick={() => navigate('/inventory/inbound')}>Send inventory (FBA)</Button></Space>}
      />

      <Row gutter={[12, 12]}>
        <Col xs={12} md={6}><StatCard label="SKUs" value={counts.skus} loading={loading} /></Col>
        <Col xs={12} md={6}><StatCard label="Units sellable" value={counts.unitsSellable} loading={loading} /></Col>
        <Col xs={12} md={6}><StatCard label="Low stock" value={counts.lowStock} loading={loading} /></Col>
        <Col xs={12} md={6}><StatCard label="Aged (180d+)" value={counts.aged} loading={loading} /></Col>
      </Row>

      <FilterBar
        schema={[{ key: 'fulfillmentType', label: 'Fulfilment', kind: 'select', options: [{ value: 'SELLER', label: 'Self-ship' }, { value: 'ARISE', label: 'FBA' }] }, { key: 'lowStock', label: 'Low stock', kind: 'boolean' }, { key: 'aged', label: 'Aged only', kind: 'boolean' }]}
        tableState={state}
        searchPlaceholder="Search SKU or product"
      />

      <DataTable
        tableId="seller-inventory"
        columns={columns}
        rows={rows}
        meta={meta}
        loading={loading || fetching}
        error={error}
        onRetry={refetch}
        tableState={state}
        emptyProps={{ title: 'No inventory', description: 'Create a self-ship listing or send stock to an Arise warehouse.' }}
      />

      <Modal title={`Remove stock — ${removal?.sku ?? ''}`} open={Boolean(removal)} onCancel={() => setRemoval(null)} onOk={() => form.submit()} okText="Request removal" confirmLoading={saving}>
        <Typography.Paragraph type="secondary">Remove units from the warehouse — returned to you or disposed. A per-unit fee applies.</Typography.Paragraph>
        <Form form={form} layout="vertical" onFinish={submitRemoval}>
          <Form.Item name="qty" label="Quantity" rules={[{ required: true, message: 'Enter a quantity.' }]}>
            <InputNumber style={{ width: '100%' }} min={1} max={removal?.sellable} />
          </Form.Item>
          <Form.Item name="type" label="Type">
            <Select options={[{ value: 'RETURN_TO_SELLER', label: 'Return to me' }, { value: 'DISPOSE', label: 'Dispose' }]} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={`Update self-ship stock — ${stockRow?.sku ?? ''}`} open={Boolean(stockRow)} onCancel={() => setStockRow(null)} onOk={() => stockForm.submit()} okText="Update stock" confirmLoading={saving}>
        <Typography.Paragraph type="secondary">Reserved units cannot be removed. Version checks protect concurrent bulk and single-row edits.</Typography.Paragraph>
        <Form form={stockForm} layout="vertical" onFinish={submitStock}>
          <Form.Item name="sellable" label="Physical stock" rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} min={stockRow?.reserved ?? 0} precision={0} /></Form.Item>
          <Form.Item name="note" label="Adjustment note"><Select options={[{ value: 'Cycle count', label: 'Cycle count' }, { value: 'New stock received', label: 'New stock received' }, { value: 'Damage correction', label: 'Damage correction' }]} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="Bulk self-ship stock update" open={bulkOpen} onCancel={() => setBulkOpen(false)} onOk={submitBulk} okText="Run update" confirmLoading={saving} footer={(_, { CancelBtn, OkBtn }) => <><CancelBtn />{bulkJob?.results?.some((item) => item.status === 'FAILED') && <Button onClick={retryBulk} loading={saving}>Retry failed only</Button>}<OkBtn /></>}>
        <Typography.Paragraph type="secondary">One visible self-ship SKU per line: <Typography.Text code>SKU, quantity</Typography.Text>. Each row is version checked and failures do not roll back successful rows.</Typography.Paragraph>
        <Input.TextArea rows={8} value={bulkText} onChange={(event) => setBulkText(event.target.value)} placeholder={'SKU-001, 25\nSKU-002, 0'} />
        {bulkJob && <Alert style={{ marginTop: 12 }} type={bulkJob.status === 'COMPLETED' ? 'success' : 'warning'} showIcon message={`${bulkJob.results.filter((item) => item.status === 'SUCCEEDED').length} succeeded · ${bulkJob.results.filter((item) => item.status === 'FAILED').length} failed`} description={bulkJob.results.filter((item) => item.status === 'FAILED').map((item) => item.message).join(' · ') || 'All stock rows were updated.'} />}
      </Modal>

      <Modal width={760} title={insight === 'replenishment' ? 'Replenishment recommendations' : 'Removal-order tracking'} open={Boolean(insight)} onCancel={() => setInsight(null)} footer={<Button onClick={() => setInsight(null)}>Close</Button>}>
        {insight === 'replenishment' ? <DataTable tableId="seller-replenishment" rows={insightRows} columns={[
          { key: 'sku', title: 'SKU', dataIndex: 'sku' }, { key: 'warehouse', title: 'Warehouse', dataIndex: 'warehouseCode' }, { key: 'available', title: 'Available', dataIndex: 'available' }, { key: 'days', title: 'Days cover', dataIndex: 'daysOfCover' }, { key: 'recommended', title: 'Recommended', dataIndex: 'recommendedQty' },
        ]} emptyProps={{ title: 'Stock cover is healthy' }} /> : <DataTable tableId="seller-removals" rows={insightRows} columns={[
          { key: 'id', title: 'Order', dataIndex: 'id' }, { key: 'sku', title: 'SKU', dataIndex: 'sku' }, { key: 'qty', title: 'Qty', dataIndex: 'qty' }, { key: 'status', title: 'Status', dataIndex: 'status', render: (value) => <Tag>{value}</Tag> }, { key: 'awb', title: 'AWB', dataIndex: 'awb' },
        ]} emptyProps={{ title: 'No removal orders' }} />}
      </Modal>
    </Flex>
  );
}
