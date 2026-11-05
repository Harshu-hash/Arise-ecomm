import { DownloadOutlined, HistoryOutlined } from '@ant-design/icons';
import { App, Button, Dropdown } from 'antd';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { exportJobsApi, foundationKeys } from '@core/api/foundationApi';
import ExportJobDrawer from './ExportJobDrawer';

export default function ExportJobButton({ resource, label = 'Export', filters = {}, selection, estimatedRows, formats = ['CSV', 'XLSX'], disabled }) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const mutation = useMutation({
    mutationFn: (format) => exportJobsApi.create({ resource, label: `${label} (${format})`, format, filters, selection, estimatedRows }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: foundationKeys.jobs }); setDrawerOpen(true); message.success('Export started. You can leave this page safely.'); },
    onError: (error) => message.error(error?.message ?? 'Could not start export.'),
  });
  const menu = { items: [...formats.map((format) => ({ key: format, label: `Export ${format}` })), { type: 'divider' }, { key: 'history', label: 'View export jobs', icon: <HistoryOutlined /> }], onClick: ({ key }) => key === 'history' ? setDrawerOpen(true) : mutation.mutate(key) };
  return <><Dropdown menu={menu} trigger={['click']}><Button icon={<DownloadOutlined />} loading={mutation.isPending} disabled={disabled}>{label}</Button></Dropdown><ExportJobDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} /></>;
}
