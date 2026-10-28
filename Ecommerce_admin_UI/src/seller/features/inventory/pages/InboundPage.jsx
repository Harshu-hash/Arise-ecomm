import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, Card, Checkbox, Flex, Form, Input, InputNumber, Modal, Select, Space, Typography } from 'antd';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import DataTable from '@ui/components/DataTable/DataTable';
import DateText from '@ui/components/DateText';
import PageHeader from '@ui/components/PageHeader';
import StatusTag from '@ui/components/StatusTag';
import useListQuery from '@ui/hooks/useListQuery';
import useUrlTableState from '@ui/hooks/useUrlTableState';
import { inventoryApi, inventoryKeys } from '../api/inventory.api';

const columns = [
  { key: 'id', title: 'Consignment', dataIndex: 'id', render: (v, r) => (
    <div><Typography.Text strong>{v}</Typography.Text><div><Typography.Text type="secondary" style={{ fontSize: 12 }}>{r.warehouseName}</Typography.Text></div></div>
  ) },
  { key: 'declaredUnits', title: 'Declared', dataIndex: 'declaredUnits', align: 'right', width: 100 },
  { key: 'receivedUnits', title: 'Received', dataIndex: 'receivedUnits', align: 'right', width: 100 },
  { key: 'status', title: 'Status', dataIndex: 'status', width: 150, render: (s) => <StatusTag domain="inbound" code={s} /> },
  { key: 'createdAt', title: 'Created', dataIndex: 'createdAt', width: 130, render: (v) => <DateText value={v} /> },
];

export default function InboundPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const state = useUrlTableState({ defaultSort: '-createdAt' });

  const { rows, meta, loading, error, refetch, fetching } = useListQuery({
    queryKey: inventoryKeys.inboundList(state.queryParams),
    url: '/inbound',
    params: state.queryParams,
  });
  const { data: warehouses = [] } = useQuery({ queryKey: inventoryKeys.warehouses, queryFn: inventoryApi.warehouses });
  const { data: listings = [] } = useQuery({ queryKey: ['seller', 'inbound', 'sku-source'], queryFn: inventoryApi.myListings, enabled: open });

  const skuOptions = Array.from(new Map(listings.map((l) => [l.variantId, l])).values())
    .map((l) => ({ value: l.variantId, label: `${l.productTitle}${l.sku ? ` (${l.sku})` : ''}` }));

  const submit = async (values) => {
    setSaving(true);
    try {
      const created = await inventoryApi.createInbound({
        warehouseId: values.warehouseId,
        invoiceNo: values.invoiceNo,
        boxCount: values.boxCount,
        lines: (values.lines ?? []).map((l) => ({ variantId: l.variantId, qty: l.qty })),
      });
      if (values.submitNow) await inventoryApi.submitInbound(created.id);
      message.success(values.submitNow ? 'Inbound submitted to the warehouse.' : 'Draft inbound created.');
      setOpen(false);
      form.resetFields();
      navigate(`/inventory/inbound/${created.id}`);
    } catch (e) {
      message.error(e?.message ?? 'Could not create the inbound.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Flex vertical gap={12}>
      <PageHeader
        title="FBA Inbound"
        breadcrumbs={[{ label: 'Inventory', to: '/inventory' }, { label: 'FBA Inbound' }]}
        subtitle="Send stock to an Arise fulfilment centre. Once received, it becomes sellable."
        onBack={() => navigate('/inventory')}
        actions={<Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>Create inbound</Button>}
      />

      <Card styles={{ body: { padding: 0 } }}>
        <DataTable
          tableId="seller-inbound"
          columns={columns}
          rows={rows}
          meta={meta}
          loading={loading || fetching}
          error={error}
          onRetry={refetch}
          tableState={state}
          onRowClick={(row) => navigate(`/inventory/inbound/${row.id}`)}
          emptyProps={{ title: 'No inbound consignments', description: 'Create one to send stock to Arise.' }}
        />
      </Card>

      <Modal title="Create an inbound consignment" open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} okText="Create" confirmLoading={saving} width={640}>
        <Form form={form} layout="vertical" onFinish={submit} initialValues={{ submitNow: true, lines: [{}] }}>
          <Form.Item name="warehouseId" label="Destination warehouse" rules={[{ required: true, message: 'Pick a warehouse.' }]}>
            <Select
              placeholder="Choose an Arise fulfilment centre"
              options={warehouses.map((w) => ({ value: w.id, label: `${w.name} — ${w.city}`, disabled: w.inboundPaused }))}
            />
          </Form.Item>

          <Typography.Text strong>SKUs to send</Typography.Text>
          <Form.List name="lines">
            {(fields, { add, remove }) => (
              <div style={{ marginTop: 8 }}>
                {fields.map((field) => (
                  <Space key={field.key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                    <Form.Item {...field} name={[field.name, 'variantId']} rules={[{ required: true, message: 'Pick a SKU' }]} style={{ marginBottom: 0, minWidth: 320 }}>
                      <Select showSearch optionFilterProp="label" placeholder="Select a product" options={skuOptions} style={{ width: 320 }} />
                    </Form.Item>
                    <Form.Item {...field} name={[field.name, 'qty']} rules={[{ required: true, message: 'Qty' }]} style={{ marginBottom: 0 }}>
                      <InputNumber min={1} placeholder="Qty" />
                    </Form.Item>
                    {fields.length > 1 && <MinusCircleOutlined onClick={() => remove(field.name)} />}
                  </Space>
                ))}
                <Button type="dashed" onClick={() => add()} icon={<PlusOutlined />} block>Add SKU</Button>
              </div>
            )}
          </Form.List>

          <Space size={16} style={{ marginTop: 16, display: 'flex' }}>
            <Form.Item name="invoiceNo" label="Invoice no." style={{ flex: 1 }}>
              <Input placeholder="Optional" />
            </Form.Item>
            <Form.Item name="boxCount" label="Boxes" style={{ width: 120 }}>
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
          </Space>
          <Form.Item name="submitNow" valuePropName="checked" style={{ marginBottom: 0 }}>
            <Checkbox>Submit to the warehouse now (otherwise saved as a draft)</Checkbox>
          </Form.Item>
        </Form>
      </Modal>
    </Flex>
  );
}
