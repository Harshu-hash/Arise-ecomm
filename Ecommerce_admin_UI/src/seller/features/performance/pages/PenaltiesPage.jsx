import { App, Alert, Col, Flex, Input, Modal, Row, Space, Tag, Typography } from 'antd';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import DataTable from '@ui/components/DataTable/DataTable';
import DateText from '@ui/components/DateText';
import MoneyText from '@ui/components/MoneyText';
import PageHeader from '@ui/components/PageHeader';
import StatCard from '@ui/components/StatCard';
import useListQuery from '@ui/hooks/useListQuery';
import useUrlTableState from '@ui/hooks/useUrlTableState';
import { performanceApi, performanceKeys } from '../api/performance.api';

const STATUS_COLOR = { APPLIED: 'red', DISPUTED: 'blue', WAIVED: 'green', RECOVERED: 'default' };

export default function PenaltiesPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [target, setTarget] = useState(null);
  const [reason, setReason] = useState('');
  const state = useUrlTableState({ defaultSort: '-appliedAt' });

  const { rows, meta, loading, error, refetch, fetching } = useListQuery({
    queryKey: performanceKeys.penalties(state.queryParams),
    url: '/penalties',
    params: state.queryParams,
  });

  const disputeMut = useMutation({
    mutationFn: () => performanceApi.disputePenalty(target.id, reason),
    onSuccess: () => { message.success('Dispute submitted — our team will review it.'); setTarget(null); setReason(''); queryClient.invalidateQueries({ queryKey: ['seller', 'penalties'] }); },
    onError: (e) => message.error(e?.message ?? 'Could not submit the dispute.'),
  });

  const columns = [
    {
      key: 'violationLabel', title: 'Violation', dataIndex: 'violationLabel', priority: 1,
      render: (v, r) => (
        <div>
          <Typography.Text strong>{v}</Typography.Text>
          <div><Typography.Text type="secondary" style={{ fontSize: 12 }}>{r.orderId}</Typography.Text></div>
        </div>
      ),
    },
    { key: 'amountPaise', title: 'Amount', dataIndex: 'amountPaise', align: 'right', width: 120, priority: 1, sorter: true, render: (p) => <MoneyText paise={p} strong /> },
    { key: 'appliedAt', title: 'Applied', dataIndex: 'appliedAt', width: 130, priority: 2, sorter: true, render: (v) => <DateText value={v} /> },
    {
      key: 'status', title: 'Status', dataIndex: 'status', width: 180, priority: 1,
      render: (s, r) => (
        <Flex vertical gap={2}>
          <Tag color={STATUS_COLOR[s] ?? 'default'} style={{ margin: 0 }}>{s}</Tag>
          {r.disputeReason && s === 'DISPUTED' && <Typography.Text type="secondary" style={{ fontSize: 11 }}>{r.disputeReason}</Typography.Text>}
        </Flex>
      ),
    },
    {
      key: 'action', title: '', width: 90, priority: 1,
      render: (_v, r) => r.canDispute && (
        <Typography.Link onClick={(e) => { e.stopPropagation(); setTarget(r); }}>Dispute</Typography.Link>
      ),
    },
  ];

  return (
    <Flex vertical gap={12}>
      <PageHeader title="Penalties" breadcrumbs={[{ label: 'Performance' }, { label: 'Penalties' }]} subtitle="Violations charged against your account. You can dispute one if you believe it's wrong." />

      {meta?.totals?.appliedPaise > 0 && (
        <Row gutter={12}>
          <Col xs={12} md={6}><StatCard label="Active penalties" valuePaise={meta.totals.appliedPaise} format="money" /></Col>
        </Row>
      )}

      <DataTable
        tableId="seller-penalties"
        columns={columns}
        rows={rows}
        meta={meta}
        loading={loading || fetching}
        error={error}
        onRetry={refetch}
        tableState={state}
        emptyProps={{ title: 'No penalties on your account', description: 'Violations charged against your account will appear here.' }}
        mobileCard={(row) => (
          <Flex vertical gap={6}>
            <Flex justify="space-between" align="flex-start" gap={8}>
              <div><Typography.Text strong>{row.violationLabel}</Typography.Text><div><Typography.Text type="secondary" style={{ fontSize: 12 }}>{row.orderId}</Typography.Text></div></div>
              <Tag color={STATUS_COLOR[row.status] ?? 'default'}>{row.status}</Tag>
            </Flex>
            <Space size={8} wrap>
              <MoneyText paise={row.amountPaise} strong />
              {row.canDispute && <Typography.Link onClick={() => setTarget(row)}>Dispute</Typography.Link>}
            </Space>
          </Flex>
        )}
      />

      <Modal title={`Dispute: ${target?.violationLabel ?? ''}`} open={Boolean(target)} onCancel={() => { setTarget(null); setReason(''); }} onOk={() => disputeMut.mutate()} okText="Submit dispute" confirmLoading={disputeMut.isPending} okButtonProps={{ disabled: !reason.trim() }}>
        <Alert type="info" showIcon style={{ marginBottom: 12 }} message={<>Order <Typography.Text strong>{target?.orderId}</Typography.Text> · <MoneyText paise={target?.amountPaise} /></>} />
        <Typography.Paragraph type="secondary" style={{ marginBottom: 6 }}>{target?.evidence}</Typography.Paragraph>
        <Input.TextArea rows={4} placeholder="Explain why this penalty should be removed" value={reason} onChange={(e) => setReason(e.target.value)} />
      </Modal>
    </Flex>
  );
}
