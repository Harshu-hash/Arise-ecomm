import { PlusOutlined, WalletOutlined } from '@ant-design/icons';
import { App, Button, Flex, Modal, Space, Tag, Typography, InputNumber } from 'antd';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { statusOptions } from '@ui/constants/statusMaps';
import DataTable from '@ui/components/DataTable/DataTable';
import FilterBar from '@ui/components/FilterBar';
import MoneyText from '@ui/components/MoneyText';
import PageHeader from '@ui/components/PageHeader';
import StatusTag from '@ui/components/StatusTag';
import useListQuery from '@ui/hooks/useListQuery';
import useUrlTableState from '@ui/hooks/useUrlTableState';
import { adsApi, adsKeys } from '../api/ads.api';

const columns = [
  { key: 'name', title: 'Campaign', dataIndex: 'name', priority: 1, render: (name, r) => (
    <div><Typography.Text strong>{name}</Typography.Text><div><Typography.Text type="secondary" style={{ fontSize: 12 }}>{r.productCount} product{r.productCount === 1 ? '' : 's'} · {r.biddingType === 'AUTOMATIC' ? 'Automatic' : 'Manual CPC'}</Typography.Text></div></div>
  ) },
  { key: 'status', title: 'Status', dataIndex: 'status', width: 150, render: (s, r) => (
    <Flex vertical gap={2}><StatusTag domain="adCampaign" code={s} />{s === 'PAUSED' && r.pauseReason && <Typography.Text type="secondary" style={{ fontSize: 11 }}>{r.pauseReason.replaceAll('_', ' ')}</Typography.Text>}</Flex>
  ) },
  { key: 'dailyBudgetPaise', title: 'Daily budget', dataIndex: 'dailyBudgetPaise', align: 'right', width: 120, render: (p) => <MoneyText paise={p} /> },
  { key: 'spendPaise', title: 'Spend', dataIndex: 'spendPaise', align: 'right', width: 110, sorter: true, render: (p) => <MoneyText paise={p} /> },
  { key: 'ctrPct', title: 'CTR', dataIndex: 'ctrPct', align: 'right', width: 80, render: (v) => `${v}%` },
  { key: 'roas', title: 'ROAS', dataIndex: 'roas', align: 'right', width: 80, sorter: true, render: (v) => <Typography.Text strong type={v >= 1 ? 'success' : v > 0 ? 'danger' : undefined}>{v}x</Typography.Text> },
];

export default function CampaignsPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const state = useUrlTableState({ defaultSort: '-createdAt' });
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [amount, setAmount] = useState(500);

  const { rows, meta, loading, error, refetch, fetching } = useListQuery({
    queryKey: adsKeys.list(state.queryParams),
    url: '/ads/campaigns',
    params: state.queryParams,
  });
  const { data: wallet } = useQuery({ queryKey: adsKeys.wallet, queryFn: adsApi.wallet });

  const rechargeMut = useMutation({
    mutationFn: () => adsApi.recharge(amount),
    onSuccess: () => { message.success('Wallet recharged.'); setRechargeOpen(false); queryClient.invalidateQueries({ queryKey: adsKeys.wallet }); },
    onError: (e) => message.error(e?.message ?? 'Could not recharge.'),
  });

  return (
    <Flex vertical gap={12}>
      <PageHeader
        title="Advertising"
        breadcrumbs={[{ label: 'Growth & Ads' }, { label: 'Campaigns' }]}
        subtitle="Sponsored Products — promote your listings in search and on product pages."
        tags={wallet?.fundingMode === 'PREPAID' && (
          <Tag color={wallet.lowBalance ? 'red' : 'default'}>
            Wallet: <MoneyText paise={wallet.balancePaise} compact />
          </Tag>
        )}
        actions={
          <Space>
            {wallet?.fundingMode === 'PREPAID' && (
              <Button icon={<WalletOutlined />} onClick={() => setRechargeOpen(true)}>Recharge wallet</Button>
            )}
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/ads/new')}>Create campaign</Button>
          </Space>
        }
      />

      <FilterBar schema={[{ key: 'status', label: 'Status', kind: 'multiSelect', options: statusOptions('adCampaign'), width: 200 }]} tableState={state} searchPlaceholder="Search campaign name" />

      <DataTable
        tableId="seller-ad-campaigns"
        columns={columns}
        rows={rows}
        meta={meta}
        loading={loading || fetching}
        error={error}
        onRetry={refetch}
        tableState={state}
        onRowClick={(row) => navigate(`/ads/${row.id}`)}
        emptyProps={{ title: 'No campaigns yet', description: 'Create one to start promoting your listings.' }}
        mobileCard={(row) => (
          <Flex vertical gap={6}>
            <Flex justify="space-between" align="flex-start" gap={8}>
              <Typography.Text strong>{row.name}</Typography.Text>
              <StatusTag domain="adCampaign" code={row.status} />
            </Flex>
            <Space size={8} wrap><MoneyText paise={row.spendPaise} /><Tag>{row.ctrPct}% CTR</Tag><Tag>{row.roas}x ROAS</Tag></Space>
          </Flex>
        )}
      />

      <Modal title="Recharge advertising wallet" open={rechargeOpen} onCancel={() => setRechargeOpen(false)} onOk={() => rechargeMut.mutate()} okText="Recharge" confirmLoading={rechargeMut.isPending}>
        <Typography.Paragraph type="secondary">Current balance: <MoneyText paise={wallet?.balancePaise} /></Typography.Paragraph>
        <InputNumber style={{ width: '100%' }} min={1} prefix="₹" value={amount} onChange={setAmount} />
      </Modal>
    </Flex>
  );
}
