import { App, Button, Card, Col, Flex, Input, Modal, Row, Segmented, Statistic, Table, Tag, Typography } from 'antd';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { queryClient } from '@core/api/queryClient';
import DateText from '@ui/components/DateText';
import ErrorState from '@ui/components/ErrorState';
import MoneyText from '@ui/components/MoneyText';
import PageHeader from '@ui/components/PageHeader';
import { marketingApi, marketingKeys } from '../api/marketing.api';

const STATUS = {
  PENDING: { color: 'default', label: 'Waiting for first order' },
  QUALIFIED: { color: 'gold', label: 'Needs approval' },
  REWARDED: { color: 'green', label: 'Rewarded' },
  REJECTED: { color: 'red', label: 'Rejected' },
};
const FLAGS = { SAME_DEVICE: 'Same phone', SAME_ADDRESS: 'Same address' };
const FILTERS = [{ label: 'All', value: 'ALL' }, ...Object.entries(STATUS).map(([value, { label }]) => ({ label, value }))];

/** Refer & Earn: what the program pays now (edited in Settings), who was invited, and the queue of rewards waiting for approval. */
export default function ReferralPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(1);
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');
  const params = { page, limit: 20, ...(status === 'ALL' ? {} : { status }) };

  const config = useQuery({ queryKey: marketingKeys.referralConfig, queryFn: () => marketingApi.referralConfig() });
  const list = useQuery({ queryKey: marketingKeys.referrals(params), queryFn: () => marketingApi.referrals(params) });

  const decide = useMutation({
    mutationFn: ({ id, decision, reason: why }) => marketingApi.decideReferral(id, decision, why),
    onSuccess: (_, { decision }) => {
      queryClient.invalidateQueries({ queryKey: ['marketing', 'referrals'] });
      setRejecting(null);
      setReason('');
      message.success(decision === 'APPROVE' ? 'Reward paid to both wallets' : 'Referral rejected');
    },
    onError: (e) => message.error(e.message),
  });

  if (config.isError || list.isError) return <ErrorState error={config.error ?? list.error} onRetry={() => { config.refetch(); list.refetch(); }} />;

  const program = config.data?.data;
  const data = list.data?.data;
  const counts = data?.summary.counts ?? {};

  const columns = [
    { title: 'Invited friend', dataIndex: ['referee', 'name'], render: (v, row) => <Flex vertical><Typography.Text>{v}</Typography.Text><Typography.Text type="secondary" style={{ fontSize: 11 }}>{row.code}</Typography.Text></Flex> },
    { title: 'Referred by', dataIndex: ['referrer', 'name'] },
    { title: 'Status', dataIndex: 'status', render: (v, row) => <Flex vertical gap={2}><Tag color={STATUS[v].color} style={{ width: 'fit-content' }}>{STATUS[v].label}</Tag>{row.flags?.length ? <Tag color="volcano" style={{ width: 'fit-content' }}>{row.flags.map((f) => FLAGS[f] ?? f).join(', ')}</Tag> : null}{row.rejectReason ? <Typography.Text type="secondary" style={{ fontSize: 11 }}>{row.rejectReason}</Typography.Text> : null}</Flex> },
    { title: 'Qualifying order', dataIndex: 'orderValuePaise', align: 'right', render: (v) => <MoneyText paise={v} /> },
    { title: 'Reward (referrer / friend)', align: 'right', render: (_, row) => (row.qualifiedAt ? <><MoneyText paise={row.referrerRewardPaise} /> / <MoneyText paise={row.refereeRewardPaise} /></> : '—') },
    { title: 'Invited', dataIndex: 'createdAt', render: (v) => <DateText value={v} /> },
    {
      title: '',
      align: 'right',
      render: (_, row) => row.status === 'QUALIFIED' && (
        <Flex gap={8} justify="flex-end">
          <Button size="small" type="primary" loading={decide.isPending} onClick={() => decide.mutate({ id: row.id, decision: 'APPROVE' })}>Approve</Button>
          <Button size="small" danger onClick={() => setRejecting(row)}>Reject</Button>
        </Flex>
      ),
    },
  ];

  return (
    <Flex vertical gap={16}>
      <PageHeader
        title="Refer & Earn"
        subtitle="Customers invite friends; both earn wallet credit once the friend's first qualifying order is delivered."
        tags={program && <Tag color={program.enabled ? 'green' : 'default'}>{program.enabled ? 'Live' : 'Off'}</Tag>}
        actions={<Button onClick={() => navigate('/admin/settings')}>Edit program in Settings</Button>}
      />

      <Row gutter={[12, 12]}>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Referrer earns" valueRender={() => <MoneyText paise={program?.referrerRewardPaise} />} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Friend earns" valueRender={() => <MoneyText paise={program?.refereeRewardPaise} />} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Needs approval" value={counts.QUALIFIED ?? 0} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Rewards paid so far" valueRender={() => <MoneyText paise={data?.summary.rewardedPaise ?? 0} />} /></Card></Col>
      </Row>
      {program && (
        <Typography.Text type="secondary">
          Minimum order <MoneyText paise={program.minOrderPaise} /> · credit {program.rewardExpiryDays ? `expires after ${program.rewardExpiryDays} days` : 'never expires'} · {program.maxRewardsPerReferrer ? `up to ${program.maxRewardsPerReferrer} rewards per referrer` : 'no limit per referrer'} · {program.autoApprove ? 'rewards are paid automatically' : 'each reward waits for approval'}
        </Typography.Text>
      )}

      <Segmented options={FILTERS} value={status} onChange={(v) => { setStatus(v); setPage(1); }} />
      <Table
        size="small"
        rowKey="id"
        loading={list.isLoading}
        columns={columns}
        dataSource={data?.items ?? []}
        pagination={{ current: page, pageSize: 20, total: data?.total ?? 0, onChange: setPage, showSizeChanger: false }}
        locale={{ emptyText: 'No referrals yet' }}
      />

      <Modal
        title="Reject this referral?"
        open={Boolean(rejecting)}
        okText="Reject"
        okButtonProps={{ danger: true, disabled: !reason.trim(), loading: decide.isPending }}
        onOk={() => decide.mutate({ id: rejecting.id, decision: 'REJECT', reason: reason.trim() })}
        onCancel={() => { setRejecting(null); setReason(''); }}
      >
        <Typography.Paragraph type="secondary">No reward is paid to {rejecting?.referrer.name} or {rejecting?.referee.name}.</Typography.Paragraph>
        <Input.TextArea rows={3} maxLength={300} placeholder="Reason (kept in the audit log)" value={reason} onChange={(e) => setReason(e.target.value)} />
      </Modal>
    </Flex>
  );
}
