import { PlusOutlined } from '@ant-design/icons';
import { App, Button, Flex, Space, Tag, Typography } from 'antd';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError } from '@core/api/errors';
import { qk, queryClient } from '@core/api/queryClient';
import ConfirmActionModal from '@ui/components/ConfirmActionModal';
import DataTable from '@ui/components/DataTable/DataTable';
import DateText from '@ui/components/DateText';
import FilterBar from '@ui/components/FilterBar';
import PageHeader from '@ui/components/PageHeader';
import useListQuery from '@ui/hooks/useListQuery';
import useUrlTableState from '@ui/hooks/useUrlTableState';
import { rolesApi } from '@admin/features/adminUsers/api/adminUsers.api';
import RoleEditorDrawer from '../components/RoleEditorDrawer';

/**
 * Roles & permissions (plan §12). Lists every role with its reach and who holds
 * it; the editor drawer is where a role is actually built from the permission
 * catalog. Create/edit/delete are four-eyed, so they return approval requests.
 */
export default function RolesListPage() {
  const { message } = App.useApp();
  const state = useUrlTableState({ defaultSort: 'name' });
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const { rows, meta, loading, error, refetch, fetching } = useListQuery({
    queryKey: qk.roles.list(state.queryParams),
    url: '/roles',
    params: state.queryParams,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: qk.roles.all });

  const clone = useMutation({
    mutationFn: (role) => rolesApi.clone(role.id, {}),
    onSuccess: (res) => { refresh(); setEditing(res.data); message.success('Cloned as an editable copy — adjust and save.'); },
    onError: (e) => message.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (role) => rolesApi.remove(role.id),
    onSuccess: () => { refresh(); setDeleting(null); message.success('Role deleted'); },
    onError: (e) => {
      if (e instanceof ApiError && e.needsApproval) {
        queryClient.invalidateQueries({ queryKey: qk.approvals.all });
        setDeleting(null);
        message.success('Deletion sent for approval.');
        return;
      }
      message.error(e.message);
    },
  });

  const columns = [
    {
      key: 'name', title: 'Role', dataIndex: 'name', sorter: true, alwaysVisible: true,
      render: (name, row) => (
        <Flex vertical gap={0}>
          <Space size={6}>
            <Typography.Text strong style={{ fontSize: 13 }}>{name}</Typography.Text>
            {row.system && <Tag style={{ marginInlineEnd: 0 }}>System</Tag>}
          </Space>
          <Typography.Text type="secondary" style={{ fontSize: 12 }} ellipsis>{row.description}</Typography.Text>
        </Flex>
      ),
    },
    {
      key: 'permissionCount', title: 'Permissions', dataIndex: 'permissionCount', sorter: true, align: 'right', priority: 1,
      render: (v) => (v === 'ALL' ? <Tag color="purple" style={{ marginInlineEnd: 0 }}>All</Tag> : <span className="tabular">{v}</span>),
    },
    {
      key: 'scopedBy', title: 'Scoped by', dataIndex: 'scopedBy', priority: 2,
      render: (dims) => (dims?.length
        ? <Space size={[4, 4]} wrap>{dims.map((d) => <Tag key={d} style={{ marginInlineEnd: 0 }}>{d}</Tag>)}</Space>
        : <Typography.Text type="secondary" style={{ fontSize: 12 }}>Platform-wide</Typography.Text>),
    },
    {
      key: 'userCount', title: 'Admins', dataIndex: 'userCount', sorter: true, align: 'right', priority: 1,
      render: (v) => <span className="tabular">{v}</span>,
    },
    {
      key: 'updatedAt', title: 'Updated', dataIndex: 'updatedAt', sorter: true, priority: 3,
      render: (v) => <DateText value={v} variant="date" />,
    },
    {
      key: 'actions', title: '', align: 'right', priority: 1,
      render: (_v, row) => (
        <Space size={4} onClick={(e) => e.stopPropagation()}>
          <Button size="small" onClick={() => setEditing(row)}>{row.system ? 'View' : 'Edit'}</Button>
          <Button size="small" type="text" loading={clone.isPending} onClick={() => clone.mutate(row)}>Clone</Button>
          {!row.system && (
            <Button size="small" type="text" danger disabled={row.userCount > 0} onClick={() => setDeleting(row)}>
              Delete
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Flex vertical gap={12}>
      <PageHeader
        title="Roles & permissions"
        breadcrumbs={[{ label: 'Administration' }, { label: 'Roles' }]}
        subtitle="Define what each kind of admin can reach. A role is a named set of permissions from the catalog; assign it to admins on the Staff page."
        actions={<Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>Create role</Button>}
      />

      <FilterBar
        schema={[
          { key: 'system', label: 'Type', kind: 'select', width: 150, options: [{ value: 'true', label: 'System' }, { value: 'false', label: 'Custom' }] },
          { key: 'hasUsers', label: 'Assigned', kind: 'select', width: 160, options: [{ value: 'true', label: 'Has admins' }, { value: 'false', label: 'Unassigned' }] },
        ]}
        tableState={state}
        searchPlaceholder="Search role name or description"
      />

      <DataTable
        tableId="roles"
        columns={columns}
        rows={rows}
        meta={meta}
        loading={loading || fetching}
        error={error}
        onRetry={refetch}
        tableState={state}
        onRowClick={(row) => setEditing(row)}
        emptyProps={{ title: 'No roles match', actionLabel: 'Create role', onAction: () => setCreating(true) }}
        mobileCard={(row) => (
          <Flex vertical gap={4}>
            <Flex justify="space-between" gap={8}>
              <Typography.Text strong>{row.name}</Typography.Text>
              {row.system ? <Tag style={{ marginInlineEnd: 0 }}>System</Tag> : <Tag color="blue" style={{ marginInlineEnd: 0 }}>Custom</Tag>}
            </Flex>
            <Typography.Text type="secondary" style={{ fontSize: 12 }} ellipsis>{row.description}</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {row.permissionCount === 'ALL' ? 'All permissions' : `${row.permissionCount} permissions`} · {row.userCount} admins
            </Typography.Text>
          </Flex>
        )}
      />

      <RoleEditorDrawer
        open={Boolean(editing) || creating}
        role={editing}
        onClose={() => { setEditing(null); setCreating(false); }}
      />

      <ConfirmActionModal
        open={Boolean(deleting)}
        onCancel={() => setDeleting(null)}
        onConfirm={() => remove.mutate(deleting)}
        loading={remove.isPending}
        danger
        title="Delete this role"
        description={deleting?.name}
        impact="This cannot be undone. Roles assigned to any admin cannot be deleted — reassign those admins first."
        reasonRequired={false}
        showNote={false}
      />
    </Flex>
  );
}
