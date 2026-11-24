import { App, Button, Flex, Input, Modal, Segmented, Table, Tag, Typography } from 'antd';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@core/api/axiosInstance';
import { queryClient } from '@core/api/queryClient';
import { useSessionStore } from '@core/auth/sessionStore';
import DateText from '@ui/components/DateText';
import MoneyText from '@ui/components/MoneyText';
import PageHeader from '@ui/components/PageHeader';
import useRealtime from '@ui/hooks/useRealtime';

const KEY = ['approvals'];
const COLORS = { PENDING: 'gold', APPROVED: 'green', REJECTED: 'red', FAILED: 'volcano' };

/**
 * Money actions another admin could not do alone because they were over their own limit (a wallet adjustment or a refund
 * retry). A different admin who may do that action approves it, which runs it, or rejects it with a reason.
 */
export default function ApprovalsPage() {
  const { message } = App.useApp();
  const me = useSessionStore((s) => s.user?.id);
  const [status, setStatus] = useState('PENDING');
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');

  const refresh = () => queryClient.invalidateQueries({ queryKey: KEY });
  useRealtime('admin', { 'approval:changed': refresh, 'session:ready': refresh });

  const list = useQuery({ queryKey: [...KEY, status], queryFn: () => api.get('/approvals', status === 'ALL' ? {} : { status }) });
  const rows = list.data?.data ?? [];

  const decide = useMutation({
    mutationFn: ({ id, reject }) => api.post(`/approvals/${id}/${reject ? 'reject' : 'approve'}`, reject ? { reason } : {}),
    onSuccess: (res) => {
      refresh();
      setRejecting(null);
      setReason('');
      if (res?.data?.status === 'FAILED') message.warning(`Approved, but it could not be done: ${res.data.reason}`);
      else message.success(res?.data?.status === 'REJECTED' ? 'Request rejected' : 'Approved and done');
    },
    onError: (e) => message.error(e.message),
  });

  const columns = [
    { title: 'Request', dataIndex: 'summary', render: (v, row) => <Flex vertical><Typography.Text>{v}</Typography.Text><Typography.Text type="secondary" style={{ fontSize: 12 }}>Raised by {row.requestedByName ?? 'an admin'}</Typography.Text></Flex> },
    { title: 'Amount', dataIndex: 'amountPaise', align: 'right', render: (v) => (v == null ? '—' : <MoneyText paise={v} />) },
    { title: 'Raised', dataIndex: 'createdAt', render: (v) => <DateText value={v} variant="datetime" /> },
    { title: 'Status', dataIndex: 'status', render: (v, row) => <Flex vertical><Tag color={COLORS[v]} style={{ width: 'fit-content' }}>{v}</Tag>{row.reason && <Typography.Text type="secondary" style={{ fontSize: 12 }}>{row.reason}</Typography.Text>}</Flex> },
    {
      title: '',
      align: 'right',
      render: (_v, row) => row.status === 'PENDING' && (
        row.requestedBy === me
          ? <Typography.Text type="secondary">Waiting for another admin</Typography.Text>
          : (
            <Flex gap={8} justify="end">
              <Button size="small" type="primary" loading={decide.isPending} onClick={() => decide.mutate({ id: row.id })}>Approve</Button>
              <Button size="small" danger onClick={() => setRejecting(row)}>Reject</Button>
            </Flex>
          )
      ),
    },
  ];

  return (
    <Flex vertical gap={12}>
      <PageHeader title="Approvals" breadcrumbs={[{ label: 'System' }, { label: 'Approvals' }]} subtitle="Wallet adjustments and refund retries that were over an admin's own limit. You cannot decide your own requests." />
      <Segmented value={status} onChange={setStatus} options={[{ label: 'Pending', value: 'PENDING' }, { label: 'Approved', value: 'APPROVED' }, { label: 'Rejected', value: 'REJECTED' }, { label: 'Failed', value: 'FAILED' }, { label: 'All', value: 'ALL' }]} />
      <Table rowKey="id" size="small" loading={list.isLoading} columns={columns} dataSource={rows} pagination={false} locale={{ emptyText: 'Nothing here' }} />
      <Modal
        title="Reject this request"
        open={Boolean(rejecting)}
        okText="Reject"
        okButtonProps={{ danger: true, disabled: reason.trim().length < 3, loading: decide.isPending }}
        onCancel={() => setRejecting(null)}
        onOk={() => decide.mutate({ id: rejecting.id, reject: true })}
      >
        <Typography.Paragraph>{rejecting?.summary}</Typography.Paragraph>
        <Input.TextArea rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this rejected?" />
      </Modal>
    </Flex>
  );
}
