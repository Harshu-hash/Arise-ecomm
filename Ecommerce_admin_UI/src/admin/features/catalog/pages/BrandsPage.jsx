import { App, Button, Flex, Form, Input, Modal, Select, Space, Switch, Tag, Typography } from 'antd';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { queryClient } from '@core/api/queryClient';
import { Can } from '@core/rbac/Can';
import ConfirmActionModal from '@ui/components/ConfirmActionModal';
import DataTable from '@ui/components/DataTable/DataTable';
import FilterBar from '@ui/components/FilterBar';
import PageHeader from '@ui/components/PageHeader';
import useListQuery from '@ui/hooks/useListQuery';
import useUrlTableState from '@ui/hooks/useUrlTableState';
import { catalogApi, catalogKeys } from '../api/catalog.api';

const STATUS_COLOR = { VERIFIED: 'green', PENDING: 'gold', REJECTED: 'red', BLOCKED: 'red' };

export default function BrandsPage() {
  const { message } = App.useApp();
  const state = useUrlTableState({ defaultSort: 'name', defaultPageSize: 50 });
  const [editing, setEditing] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const { rows, meta, loading, error, refetch, fetching } = useListQuery({
    queryKey: catalogKeys.brands({ ...state.queryParams, tab: state.tab }),
    url: '/brands',
    params: { ...state.queryParams, ...(state.tab ? { status: state.tab } : {}) },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['catalog'] });

  const save = useMutation({
    mutationFn: (values) =>
      editing ? catalogApi.updateBrand(editing.id, values) : catalogApi.createBrand(values),
    onSuccess: () => {
      invalidate();
      setModalOpen(false);
      setEditing(null);
      message.success(editing ? 'Brand saved' : 'Brand created');
    },
    onError: (e) => message.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id) => catalogApi.deleteBrand(id),
    onSuccess: () => {
      invalidate();
      setDeleting(null);
      message.success('Brand deleted');
    },
    onError: (e) => {
      message.error(e.message);
      setDeleting(null);
    },
  });

  const columns = [
    {
      key: 'name', title: 'Brand', dataIndex: 'name', sorter: true, alwaysVisible: true,
      render: (name, row) => (
        <div>
          <Space size={6}>
            <Typography.Text strong style={{ fontSize: 13 }}>{name}</Typography.Text>
            {row.gated && <Tag color="gold" style={{ marginInlineEnd: 0 }}>Gated</Tag>}
          </Space>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>{row.rootCategory}</Typography.Text>
          </div>
        </div>
      ),
    },
    {
      key: 'status', title: 'Status', dataIndex: 'status', sorter: true, priority: 1,
      render: (v) => <Tag color={STATUS_COLOR[v]} style={{ marginInlineEnd: 0 }}>{v.toLowerCase()}</Tag>,
    },
    {
      key: 'ownerType', title: 'Owner', dataIndex: 'ownerType', priority: 3,
      render: (v) => v.replace(/_/g, ' ').toLowerCase(),
    },
    {
      key: 'productCount', title: 'Products', dataIndex: 'productCount', sorter: true, align: 'right', priority: 1,
      render: (v) => <span className="tabular">{v}</span>,
    },
    {
      key: 'authorisedSellerCount', title: 'Authorised sellers', dataIndex: 'authorisedSellerCount', sorter: true, align: 'right', priority: 2,
      render: (v) => <span className="tabular">{v}</span>,
    },
    {
      key: 'pendingRequests', title: 'Pending claims', dataIndex: 'pendingRequests', align: 'right', priority: 1,
      render: (v) =>
        v ? (
          <Link to={`/sellers/brand-approvals?q=`}>
            <Tag color="gold" style={{ marginInlineEnd: 0 }}>{v}</Tag>
          </Link>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
    {
      key: 'actions', title: '', align: 'right', priority: 1,
      render: (_v, row) => (
        <Space size={4}>
          <Can perm="catalog.brand.edit">
            <Button size="small" type="text" onClick={() => { setEditing(row); setModalOpen(true); }}>
              Edit
            </Button>
          </Can>
          <Can perm="catalog.brand.delete">
            <Button size="small" type="text" danger onClick={() => setDeleting(row)}>
              Delete
            </Button>
          </Can>
        </Space>
      ),
    },
  ];

  return (
    <Flex vertical gap={12}>
      <PageHeader
        title="Brands"
        breadcrumbs={[{ label: 'Catalog' }, { label: 'Brands' }]}
        subtitle="Gated brands can only be listed by sellers with an approved authorisation."
        actions={
          <Can perm="catalog.brand.create">
            <Button type="primary" onClick={() => { setEditing(null); setModalOpen(true); }}>
              New brand
            </Button>
          </Can>
        }
      />

      <FilterBar
        schema={[
          { key: 'gated', label: 'Gated only', kind: 'boolean' },
          { key: 'rootCategory', label: 'Category', kind: 'text', width: 170 },
        ]}
        tableState={state}
        searchPlaceholder="Search brand"
      />

      <DataTable
        tableId="brands"
        columns={columns}
        rows={rows}
        meta={meta}
        loading={loading || fetching}
        error={error}
        onRetry={refetch}
        tableState={state}
        tabs={[
          { key: 'all', label: 'All' },
          { key: 'VERIFIED', label: 'Verified' },
          { key: 'PENDING', label: 'Pending verification' },
        ]}
        emptyProps={{ title: 'No brands match' }}
        mobileCard={(row) => (
          <Flex vertical gap={4}>
            <Flex justify="space-between" gap={8}>
              <Typography.Text strong>{row.name}</Typography.Text>
              <Tag color={STATUS_COLOR[row.status]} style={{ marginInlineEnd: 0 }}>{row.status.toLowerCase()}</Tag>
            </Flex>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {row.productCount} products · {row.authorisedSellerCount} sellers
            </Typography.Text>
          </Flex>
        )}
      />

      <BrandFormModal
        open={modalOpen}
        editing={editing}
        onCancel={() => { setModalOpen(false); setEditing(null); }}
        onSubmit={(v) => save.mutate(v)}
        loading={save.isPending}
      />

      <ConfirmActionModal
        open={Boolean(deleting)}
        onCancel={() => setDeleting(null)}
        onConfirm={() => remove.mutate(deleting.id)}
        loading={remove.isPending}
        danger
        title="Delete this brand"
        description={deleting ? `"${deleting.name}" will be removed. This only works if no products carry it.` : null}
        reasonRequired={false}
        showNote={false}
        confirmLabel="Delete"
      />
    </Flex>
  );
}

function BrandFormModal({ open, editing, onCancel, onSubmit, loading }) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (open) {
      form.resetFields();
      if (editing) form.setFieldsValue(editing);
    }
  }, [open, editing, form]);

  const submit = async () => {
    const values = await form.validateFields();
    onSubmit(values);
  };

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      onOk={submit}
      confirmLoading={loading}
      title={editing ? `Edit "${editing.name}"` : 'New brand'}
      okText={editing ? 'Save' : 'Create'}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Give it a name.' }]}>
          <Input placeholder="e.g. Allen Solly" />
        </Form.Item>
        <Form.Item name="rootCategory" label="Root category (optional)">
          <Input placeholder="e.g. Fashion" />
        </Form.Item>
        <Form.Item name="status" label="Status" initialValue="VERIFIED">
          <Select options={['VERIFIED', 'PENDING', 'BLOCKED'].map((s) => ({ value: s, label: s.toLowerCase() }))} />
        </Form.Item>
        <Space>
          <Form.Item name="gated" label="Gated" valuePropName="checked" extra="Needs seller authorisation to list">
            <Switch />
          </Form.Item>
        </Space>
      </Form>
    </Modal>
  );
}
