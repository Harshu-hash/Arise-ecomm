import { InboxOutlined } from '@ant-design/icons';
import { App, Button, Col, Flex, Form, InputNumber, Modal, Row, Select, Tag, Typography } from 'antd';
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
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
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

  const columns = [
    { key: 'sku', title: 'SKU', dataIndex: 'sku', priority: 1, render: (sku, r) => (
      <div><Typography.Text strong>{r.productTitle}</Typography.Text><div><Typography.Text type="secondary" style={{ fontSize: 12 }}>{sku} · {r.variantLabel ?? ''}</Typography.Text></div></div>
    ) },
    { key: 'warehouseCode', title: 'Warehouse', dataIndex: 'warehouseCode', width: 110 },
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
    { key: 'action', title: '', width: 120, render: (_, r) => (
      <Button size="small" onClick={() => openRemoval(r)} disabled={r.sellable === 0}>Remove stock</Button>
    ) },
  ];

  return (
    <Flex vertical gap={12}>
      <PageHeader
        title="Inventory"
        breadcrumbs={[{ label: 'Inventory' }]}
        subtitle="Your stock held at Arise fulfilment centres."
        actions={<Button type="primary" icon={<InboxOutlined />} onClick={() => navigate('/inventory/inbound')}>Send inventory (FBA)</Button>}
      />

      <Row gutter={[12, 12]}>
        <Col xs={12} md={6}><StatCard label="SKUs" value={counts.skus} loading={loading} /></Col>
        <Col xs={12} md={6}><StatCard label="Units sellable" value={counts.unitsSellable} loading={loading} /></Col>
        <Col xs={12} md={6}><StatCard label="Low stock" value={counts.lowStock} loading={loading} /></Col>
        <Col xs={12} md={6}><StatCard label="Aged (180d+)" value={counts.aged} loading={loading} /></Col>
      </Row>

      <FilterBar
        schema={[{ key: 'lowStock', label: 'Low stock', kind: 'boolean' }, { key: 'aged', label: 'Aged only', kind: 'boolean' }]}
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
        emptyProps={{ title: 'No FBA inventory', description: 'Send stock to an Arise warehouse to sell with Fulfilled-by-Arise.' }}
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
    </Flex>
  );
}
