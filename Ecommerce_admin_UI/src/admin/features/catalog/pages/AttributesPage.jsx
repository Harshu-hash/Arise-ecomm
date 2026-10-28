import { App, Button, Flex, Space, Tag, Typography } from 'antd';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { queryClient } from '@core/api/queryClient';
import { Can } from '@core/rbac/Can';
import ConfirmActionModal from '@ui/components/ConfirmActionModal';
import DataTable from '@ui/components/DataTable/DataTable';
import FilterBar from '@ui/components/FilterBar';
import PageHeader from '@ui/components/PageHeader';
import useListQuery from '@ui/hooks/useListQuery';
import useUrlTableState from '@ui/hooks/useUrlTableState';
import { catalogApi, catalogKeys } from '../api/catalog.api';
import { makeAttributeColumns } from '../components/attributeColumns';
import AttributeFormModal from '../components/AttributeFormModal';
import AttributeSetFormModal from '../components/AttributeSetFormModal';
import AttributeSetsTable from '../components/AttributeSetsTable';

const TYPES = ['TEXT', 'NUMBER', 'SINGLE_SELECT', 'MULTI_SELECT', 'BOOLEAN', 'COLOUR', 'SIZE', 'DATE'];

export default function AttributesPage() {
  const { message } = App.useApp();
  const state = useUrlTableState({ defaultSort: 'name', defaultPageSize: 50 });
  const [editingAttribute, setEditingAttribute] = useState(null);
  const [attributeModalOpen, setAttributeModalOpen] = useState(false);
  const [deletingAttribute, setDeletingAttribute] = useState(null);

  const [editingSet, setEditingSet] = useState(null);
  const [setModalOpen, setSetModalOpen] = useState(false);
  const [deletingSet, setDeletingSet] = useState(null);

  const { rows, meta, loading, error, refetch, fetching } = useListQuery({
    queryKey: catalogKeys.attributes(state.queryParams),
    url: '/attributes',
    params: state.queryParams,
  });

  const sets = useQuery({
    queryKey: catalogKeys.attributeSets,
    queryFn: () => catalogApi.attributeSets(),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['catalog'] });
    queryClient.invalidateQueries({ queryKey: ['audit'] });
  };

  const saveAttribute = useMutation({
    mutationFn: (values) =>
      editingAttribute
        ? catalogApi.updateAttribute(editingAttribute.id, values)
        : catalogApi.createAttribute(values),
    onSuccess: () => {
      invalidate();
      setAttributeModalOpen(false);
      setEditingAttribute(null);
      message.success(editingAttribute ? 'Attribute saved' : 'Attribute created');
    },
    onError: (e) => message.error(e.message),
  });

  const deleteAttribute = useMutation({
    mutationFn: (id) => catalogApi.deleteAttribute(id),
    onSuccess: () => {
      invalidate();
      setDeletingAttribute(null);
      message.success('Attribute deleted');
    },
    onError: (e) => {
      message.error(e.message);
      setDeletingAttribute(null);
    },
  });

  const saveSet = useMutation({
    mutationFn: (values) =>
      editingSet ? catalogApi.updateAttributeSet(editingSet.id, values) : catalogApi.createAttributeSet(values),
    onSuccess: () => {
      invalidate();
      setSetModalOpen(false);
      setEditingSet(null);
      message.success(editingSet ? 'Set saved' : 'Set created');
    },
    onError: (e) => message.error(e.message),
  });

  const deleteSet = useMutation({
    mutationFn: (id) => catalogApi.deleteAttributeSet(id),
    onSuccess: () => {
      invalidate();
      setDeletingSet(null);
      message.success('Set deleted');
    },
    onError: (e) => {
      message.error(e.message);
      setDeletingSet(null);
    },
  });

  const columns = makeAttributeColumns({
    onEdit: (row) => { setEditingAttribute(row); setAttributeModalOpen(true); },
    onDelete: (row) => setDeletingAttribute(row),
  });

  return (
    <Flex vertical gap={12}>
      <PageHeader
        title="Attributes"
        breadcrumbs={[{ label: 'Catalog' }, { label: 'Attributes' }]}
        subtitle="The structured fields listings are built from. Variant-defining attributes create SKUs; filterable ones become app filters."
        actions={
          <Can perm="catalog.attribute.create">
            <Button
              type="primary"
              onClick={() => {
                setEditingAttribute(null);
                setAttributeModalOpen(true);
              }}
            >
              New attribute
            </Button>
          </Can>
        }
      />

      <FilterBar
        schema={[
          { key: 'type', label: 'Type', kind: 'multiSelect', width: 200, options: TYPES.map((t) => ({ value: t, label: t.replace(/_/g, ' ').toLowerCase() })) },
          { key: 'variantDefining', label: 'Variant-defining', kind: 'boolean' },
          { key: 'filterable', label: 'Filterable', kind: 'boolean' },
        ]}
        tableState={state}
        searchPlaceholder="Search attribute or code"
      />

      <DataTable
        tableId="attributes"
        columns={columns}
        rows={rows}
        meta={meta}
        loading={loading || fetching}
        error={error}
        onRetry={refetch}
        tableState={state}
        emptyProps={{ title: 'No attributes match' }}
        mobileCard={(row) => (
          <Flex vertical gap={4}>
            <Typography.Text strong>{row.name}</Typography.Text>
            <Space size={4} wrap>
              <Tag style={{ marginInlineEnd: 0 }}>{row.type.toLowerCase()}</Tag>
              {row.variantDefining && <Tag color="blue" style={{ marginInlineEnd: 0 }}>variant</Tag>}
            </Space>
          </Flex>
        )}
      />

      <AttributeSetsTable
        sets={sets.data ?? []}
        loading={sets.isLoading}
        onNew={() => { setEditingSet(null); setSetModalOpen(true); }}
        onEdit={(row) => { setEditingSet(row); setSetModalOpen(true); }}
        onDelete={(row) => setDeletingSet(row)}
      />

      <AttributeFormModal
        open={attributeModalOpen}
        editing={editingAttribute}
        onCancel={() => { setAttributeModalOpen(false); setEditingAttribute(null); }}
        onSubmit={(v) => saveAttribute.mutate(v)}
        loading={saveAttribute.isPending}
      />

      <AttributeSetFormModal
        open={setModalOpen}
        editing={editingSet}
        attributes={rows}
        onCancel={() => { setSetModalOpen(false); setEditingSet(null); }}
        onSubmit={(v) => saveSet.mutate(v)}
        loading={saveSet.isPending}
      />

      <ConfirmActionModal
        open={Boolean(deletingAttribute)}
        onCancel={() => setDeletingAttribute(null)}
        onConfirm={() => deleteAttribute.mutate(deletingAttribute.id)}
        loading={deleteAttribute.isPending}
        danger
        title="Delete this attribute"
        description={deletingAttribute ? `"${deletingAttribute.name}" will be removed. This only works if it is unused.` : null}
        reasonRequired={false}
        showNote={false}
        confirmLabel="Delete"
      />

      <ConfirmActionModal
        open={Boolean(deletingSet)}
        onCancel={() => setDeletingSet(null)}
        onConfirm={() => deleteSet.mutate(deletingSet.id)}
        loading={deleteSet.isPending}
        danger
        title="Delete this attribute set"
        description={deletingSet ? `"${deletingSet.name}" will be removed. Categories using it must be reassigned first.` : null}
        reasonRequired={false}
        showNote={false}
        confirmLabel="Delete"
      />
    </Flex>
  );
}
