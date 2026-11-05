import { DeleteOutlined, SaveOutlined } from '@ant-design/icons';
import { App, Button, Dropdown, Input, Modal, Space } from 'antd';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { foundationKeys, savedViewsApi } from '@core/api/foundationApi';

export default function SavedViewsMenu({ tableId, tableState }) {
  const { message } = App.useApp();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const query = useQuery({ queryKey: foundationKeys.savedViews(tableId), queryFn: () => savedViewsApi.list(tableId) });
  const refresh = () => client.invalidateQueries({ queryKey: foundationKeys.savedViews(tableId) });
  const create = useMutation({ mutationFn: () => savedViewsApi.create({ tableId, name, state: { q: tableState.q, filters: tableState.filters, sort: tableState.sort, pageSize: tableState.pageSize } }), onSuccess: () => { refresh(); setOpen(false); setName(''); message.success('View saved.'); } });
  const remove = useMutation({ mutationFn: savedViewsApi.remove, onSuccess: refresh });
  const items = [
    ...(query.data ?? []).map((view) => ({ key: view.id, label: <Space><span style={{ flex: 1 }}>{view.name}</span><Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label={`Delete ${view.name}`} onClick={(event) => { event.stopPropagation(); remove.mutate(view.id); }} /></Space> })),
    { type: 'divider' }, { key: '__save', label: 'Save current view', icon: <SaveOutlined /> },
  ];
  const menu = {
    items,
    onClick: ({ key }) => {
      if (key === '__save') setOpen(true);
      else {
        const view = query.data?.find((item) => item.id === key);
        if (view) tableState.write({ ...view.state, page: 1 });
      }
    },
  };
  return (
    <>
      <Dropdown menu={menu}><Button>Views</Button></Dropdown>
      <Modal
        title="Save current view"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => create.mutate()}
        okButtonProps={{ disabled: !name.trim(), loading: create.isPending }}
      >
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Overdue self-ship orders" maxLength={80} autoFocus />
      </Modal>
    </>
  );
}
