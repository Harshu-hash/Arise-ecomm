import { EditOutlined, HistoryOutlined } from '@ant-design/icons';
import { Alert, App, Button, Card, Col, Drawer, Flex, Form, Input, InputNumber, Modal, Row, Table, Tag, Typography } from 'antd';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { queryClient } from '@core/api/queryClient';
import DataTable from '@ui/components/DataTable/DataTable';
import DateText from '@ui/components/DateText';
import FilterBar from '@ui/components/FilterBar';
import PageHeader from '@ui/components/PageHeader';
import StatCard from '@ui/components/StatCard';
import useListQuery from '@ui/hooks/useListQuery';
import useUrlTableState from '@ui/hooks/useUrlTableState';
import { inventoryApi, inventoryKeys } from '../api/inventory.api';

export default function StockManagementPage() {
  const state = useUrlTableState({ defaultSort: '-sellable' });
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const { rows, meta, loading, error, refetch, fetching } = useListQuery({ queryKey: inventoryKeys.list(state.queryParams), url: '/inventory', params: state.queryParams });
  const recommendations = useQuery({ queryKey: inventoryKeys.recommendations, queryFn: inventoryApi.recommendations });
  const recommendationById = new Map((recommendations.data ?? []).map((row) => [row.id, row]));
  const counts = meta?.counts ?? {};
  const columns = [
    { key: 'productTitle', title: 'Product', dataIndex: 'productTitle', alwaysVisible: true, render: (value, row) => <Flex vertical><Typography.Text strong>{value}</Typography.Text><Typography.Text type="secondary">{[row.sku, row.variantLabel].filter(Boolean).join(' · ')}</Typography.Text></Flex> },
    { key: 'location', title: 'Location', render: (_value, row) => <Flex vertical><Typography.Text>{row.warehouseCode}</Typography.Text><Typography.Text type="secondary">{row.fulfillmentType === 'SELLER' ? 'Self-ship' : 'Fulfilled by Arise'}</Typography.Text></Flex> },
    { key: 'sellable', title: 'Sellable', dataIndex: 'sellable', align: 'right', sorter: true, render: (value) => <Typography.Text className="tabular" strong>{value.toLocaleString('en-IN')}</Typography.Text> },
    { key: 'reserved', title: 'Reserved', dataIndex: 'reserved', align: 'right', render: (value) => <span className="tabular">{value.toLocaleString('en-IN')}</span> },
    { key: 'available', title: 'Available', dataIndex: 'available', align: 'right', render: (value) => <span className="tabular">{value.toLocaleString('en-IN')}</span> },
    { key: 'daysOfCover', title: 'Days cover', dataIndex: 'daysOfCover', align: 'right', sorter: true, render: (value) => value ?? '—' },
    { key: 'status', title: 'Stock status', render: (_value, row) => <StockStatus row={row} /> },
    { key: 'actions', title: '', align: 'right', render: (_value, row) => row.fulfillmentType === 'SELLER' ? <Button size="small" icon={<EditOutlined />} onClick={(event) => { event.stopPropagation(); setEditing(row); }}>Update</Button> : <Button size="small" icon={<HistoryOutlined />} onClick={(event) => { event.stopPropagation(); setSelected(row); }}>Movements</Button> },
  ];

  return <Flex vertical gap={12}>
    <PageHeader title="Stock management" breadcrumbs={[{ label: 'Products' }, { label: 'Stock management' }]} subtitle="Manage self-ship quantities and monitor Arise-fulfilled stock, reservations, ageing and days of cover." />
    <Row gutter={[12, 12]}>
      <Col xs={12} md={6}><StatCard label="SKUs" value={counts.skus} loading={loading} /></Col>
      <Col xs={12} md={6}><StatCard label="Sellable units" value={counts.unitsSellable} loading={loading} /></Col>
      <Col xs={12} md={6}><StatCard label="Low stock" value={counts.lowStock} loading={loading} /></Col>
      <Col xs={12} md={6}><StatCard label="Aged stock" value={counts.aged} loading={loading} /></Col>
    </Row>
    <FilterBar schema={[
      { key: 'fulfillmentType', label: 'Fulfilment', kind: 'select', options: [{ value: 'SELLER', label: 'Self-ship' }, { value: 'ARISE', label: 'Fulfilled by Arise' }] },
      { key: 'lowStock', label: 'Low stock only', kind: 'boolean' },
      { key: 'aged', label: 'Aged stock only', kind: 'boolean' },
    ]} tableState={state} searchPlaceholder="Search product or SKU" />
    <DataTable tableId="seller-stock" columns={columns} rows={rows} meta={meta} loading={loading || fetching} error={error} onRetry={refetch} tableState={state} onRowClick={setSelected} emptyProps={{ title: 'No stock matches this view' }} />
    <StockDrawer row={selected} recommendation={selected ? recommendationById.get(selected.id) : null} onClose={() => setSelected(null)} onEdit={() => { setEditing(selected); setSelected(null); }} />
    <EditStockModal row={editing} onClose={() => setEditing(null)} />
  </Flex>;
}

function StockStatus({ row }) {
  if (row.available <= 0) return <Tag color="red">Out of stock</Tag>;
  if (row.lowStock) return <Tag color="gold">Low stock</Tag>;
  return <Tag color="green">In stock</Tag>;
}

function StockDrawer({ row, recommendation, onClose, onEdit }) {
  const ledger = useQuery({ queryKey: inventoryKeys.ledger(row?.id), queryFn: () => inventoryApi.ledger(row.id), enabled: Boolean(row) });
  return <Drawer title={row?.productTitle} open={Boolean(row)} onClose={onClose} width="min(760px, 100vw)" extra={row?.fulfillmentType === 'SELLER' ? <Button type="primary" icon={<EditOutlined />} onClick={onEdit}>Update stock</Button> : null}>
    {row && <Flex vertical gap={16}>
      {recommendation && <Alert type="warning" showIcon message={`Restock ${recommendation.recommendedQty} units`} description={`This targets ${recommendation.targetDaysCover} days of cover based on current sales velocity.`} />}
      <Row gutter={[12, 12]}><Col xs={12} md={6}><Bucket label="Sellable" value={row.sellable} /></Col><Col xs={12} md={6}><Bucket label="Reserved" value={row.reserved} /></Col><Col xs={12} md={6}><Bucket label="Available" value={row.available} /></Col><Col xs={12} md={6}><Bucket label="Unsellable" value={row.unsellable ?? row.damaged ?? 0} /></Col></Row>
      <Card size="small" title="Stock details"><Line label="SKU" value={row.sku} /><Line label="Location" value={row.warehouseCode} /><Line label="Fulfilment" value={row.fulfillmentType === 'SELLER' ? 'Self-ship' : 'Fulfilled by Arise'} /><Line label="Days of cover" value={row.daysOfCover ?? '—'} /><Line label="Oldest unit age" value={`${row.oldestUnitDays ?? 0} days`} /></Card>
      <Card size="small" title="Movement history" styles={{ body: { padding: 0 } }}><Table size="small" loading={ledger.isLoading} rowKey="id" dataSource={ledger.data?.entries ?? []} pagination={{ pageSize: 8, hideOnSinglePage: true }} columns={[
        { title: 'When', dataIndex: 'at', render: (value) => <DateText value={value} /> },
        { title: 'Movement', dataIndex: 'type', render: (value) => value.replaceAll('_', ' ').toLowerCase() },
        { title: 'Qty', dataIndex: 'qty', align: 'right', render: (value) => <Typography.Text type={value < 0 ? 'danger' : 'success'}>{value > 0 ? '+' : ''}{value}</Typography.Text> },
        { title: 'Balance', dataIndex: 'balanceAfter', align: 'right' },
        { title: 'Note', dataIndex: 'note', ellipsis: true },
      ]} /></Card>
    </Flex>}
  </Drawer>;
}

function EditStockModal({ row, onClose }) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const mutation = useMutation({ mutationFn: (values) => inventoryApi.updateStock(row.id, { sellable: values.sellable, note: values.note, version: row.version }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['seller', 'inventory'] }); message.success('Stock updated'); onClose(); }, onError: (error) => message.error(error.message) });
  return <Modal title={`Update stock · ${row?.sku ?? ''}`} open={Boolean(row)} onCancel={onClose} onOk={() => form.submit()} confirmLoading={mutation.isPending} okText="Update stock" destroyOnHidden afterOpenChange={(open) => open && form.setFieldsValue({ sellable: row.sellable, note: '' })}>
    {row && <Form form={form} layout="vertical" onFinish={mutation.mutate}><Alert type="info" showIcon message={`${row.reserved} units are reserved`} description="Sellable stock cannot be reduced below the reserved quantity." style={{ marginBottom: 16 }} /><Form.Item name="sellable" label="Sellable quantity" rules={[{ required: true }, { type: 'number', min: row.reserved, message: `Enter at least ${row.reserved}.` }]}><InputNumber min={row.reserved} precision={0} style={{ width: '100%' }} /></Form.Item><Form.Item name="note" label="Reason or reference" rules={[{ required: true, message: 'Add a note for the stock ledger.' }]}><Input.TextArea rows={3} maxLength={200} /></Form.Item></Form>}
  </Modal>;
}

function Bucket({ label, value }) { return <Card size="small"><Typography.Text type="secondary">{label}</Typography.Text><Typography.Title level={4} style={{ margin: 0 }}>{Number(value ?? 0).toLocaleString('en-IN')}</Typography.Title></Card>; }
function Line({ label, value }) { return <Flex wrap justify="space-between" gap={16} style={{ marginBottom: 8 }}><Typography.Text type="secondary">{label}</Typography.Text><Typography.Text>{value}</Typography.Text></Flex>; }
