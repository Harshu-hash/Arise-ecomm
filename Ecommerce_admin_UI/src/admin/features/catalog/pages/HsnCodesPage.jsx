import { Alert, App, Button, DatePicker, Flex, Form, Input, Modal, Select, Space, Tag, Typography } from 'antd';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { queryClient } from '@core/api/queryClient';
import { Can } from '@core/rbac/Can';
import DataTable from '@ui/components/DataTable/DataTable';
import FilterBar from '@ui/components/FilterBar';
import PageHeader from '@ui/components/PageHeader';
import useListQuery from '@ui/hooks/useListQuery';
import useUrlTableState from '@ui/hooks/useUrlTableState';
import { catalogApi, catalogKeys } from '../api/catalog.api';

export default function HsnCodesPage() {
  const { message } = App.useApp();
  const state = useUrlTableState({ defaultSort: 'code', defaultPageSize: 50 });
  const [editing, setEditing] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { rows, meta, loading, error, refetch, fetching } = useListQuery({
    queryKey: catalogKeys.hsn(state.queryParams),
    url: '/hsn-codes',
    params: state.queryParams,
  });

  const save = useMutation({
    mutationFn: (values) =>
      editing ? catalogApi.updateHsnCode(editing.id, values) : catalogApi.createHsnCode(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog'] });
      queryClient.invalidateQueries({ queryKey: ['audit'] });
      setModalOpen(false);
      setEditing(null);
      message.success(editing ? 'HSN code saved' : 'HSN code created');
    },
    onError: (e) => message.error(e.message),
  });

  const columns = [
    {
      key: 'code', title: 'HSN', dataIndex: 'code', sorter: true, alwaysVisible: true,
      render: (v) => <Typography.Text className="mono" strong>{v}</Typography.Text>,
    },
    { key: 'description', title: 'Description', dataIndex: 'description', priority: 1 },
    {
      key: 'gstRate', title: 'GST', dataIndex: 'gstRate', sorter: true, align: 'right', priority: 1,
      render: (v) => <Tag style={{ marginInlineEnd: 0 }}>{v}%</Tag>,
    },
    { key: 'rootName', title: 'Applies to', dataIndex: 'rootName', priority: 2 },
    {
      key: 'categoryCount', title: 'Categories using it', dataIndex: 'categoryCount', sorter: true, align: 'right', priority: 2,
      render: (v) => <span className="tabular">{v}</span>,
    },
    {
      key: 'actions', title: '', align: 'right', priority: 1,
      render: (_v, row) => (
        <Can perm="catalog.hsn.edit">
          <Button size="small" type="text" onClick={() => { setEditing(row); setModalOpen(true); }}>
            Edit
          </Button>
        </Can>
      ),
    },
  ];

  return (
    <Flex vertical gap={12}>
      <PageHeader
        title="HSN & tax codes"
        breadcrumbs={[{ label: 'Catalog' }, { label: 'HSN & tax codes' }]}
        subtitle="HSN drives the GST rate on every invoice, so a wrong code is a tax problem, not a catalog one."
        actions={
          <Can perm="catalog.hsn.create">
            <Button type="primary" onClick={() => { setEditing(null); setModalOpen(true); }}>
              New HSN code
            </Button>
          </Can>
        }
      />

      <Alert
        type="info"
        showIcon
        message="Rate changes are effective-dated and never retroactive"
        description="Set the effective-from date when editing a rate — it applies only to invoices raised on or after that date."
      />

      <FilterBar
        schema={[
          {
            key: 'gstRate', label: 'GST rate', kind: 'multiSelect', width: 170,
            options: [0, 5, 12, 18, 28].map((r) => ({ value: String(r), label: `${r}%` })),
          },
        ]}
        tableState={state}
        searchPlaceholder="Search code or description"
      />

      <DataTable
        tableId="hsnCodes"
        columns={columns}
        rows={rows}
        meta={meta}
        loading={loading || fetching}
        error={error}
        onRetry={refetch}
        tableState={state}
        emptyProps={{ title: 'No HSN codes match' }}
        mobileCard={(row) => (
          <Flex vertical gap={4}>
            <Flex justify="space-between" gap={8}>
              <Typography.Text className="mono" strong>{row.code}</Typography.Text>
              <Tag style={{ marginInlineEnd: 0 }}>{row.gstRate}%</Tag>
            </Flex>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>{row.description}</Typography.Text>
          </Flex>
        )}
      />

      <HsnFormModal
        open={modalOpen}
        editing={editing}
        onCancel={() => { setModalOpen(false); setEditing(null); }}
        onSubmit={(v) => save.mutate(v)}
        loading={save.isPending}
      />
    </Flex>
  );
}

function HsnFormModal({ open, editing, onCancel, onSubmit, loading }) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (open) {
      form.resetFields();
      if (editing) {
        form.setFieldsValue({ ...editing, effectiveFrom: editing.effectiveFrom ? dayjs(editing.effectiveFrom) : null });
      }
    }
  }, [open, editing, form]);

  const submit = async () => {
    const values = await form.validateFields();
    onSubmit({
      ...values,
      effectiveFrom: values.effectiveFrom ? values.effectiveFrom.toISOString() : undefined,
    });
  };

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      onOk={submit}
      confirmLoading={loading}
      title={editing ? `Edit HSN ${editing.code}` : 'New HSN code'}
      okText={editing ? 'Save' : 'Create'}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item name="code" label="HSN code" rules={[{ required: true, message: 'Give the code.' }]}>
          <Input className="mono" placeholder="e.g. 6109" disabled={Boolean(editing)} />
        </Form.Item>
        <Form.Item name="description" label="Description" rules={[{ required: true, message: 'Describe what this code covers.' }]}>
          <Input placeholder="e.g. T-shirts, singlets and other vests, knitted" />
        </Form.Item>
        <Space style={{ width: '100%' }} size={12}>
          <Form.Item name="gstRate" label="GST rate" rules={[{ required: true, message: 'Choose a rate.' }]}>
            <Select options={[0, 5, 12, 18, 28].map((r) => ({ value: r, label: `${r}%` }))} style={{ width: 140 }} />
          </Form.Item>
          <Form.Item name="cess" label="Cess (%)">
            <Input type="number" min={0} style={{ width: 120 }} />
          </Form.Item>
        </Space>
        <Form.Item name="rootName" label="Applies to (optional)">
          <Input placeholder="e.g. Fashion" />
        </Form.Item>
        <Form.Item name="effectiveFrom" label="Effective from" rules={[{ required: true, message: 'Pick a date.' }]}>
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
