import { App, Alert, Avatar, Button, Card, Col, Flex, InputNumber, List, Modal, Row, Space, Table, Tag, Typography } from 'antd';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { Can } from '@core/rbac/Can';
import { paiseToRupees, rupeesToPaise } from '@core/utils/money';
import DateText from '@ui/components/DateText';
import ErrorState from '@ui/components/ErrorState';
import FullPageSpinner from '@ui/components/FullPageSpinner';
import MoneyText from '@ui/components/MoneyText';
import PageHeader from '@ui/components/PageHeader';
import StatCard from '@ui/components/StatCard';
import StatusTag from '@ui/components/StatusTag';
import { adsApi, adsKeys } from '../api/ads.api';

export default function CampaignDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [dailyBudget, setDailyBudget] = useState(0);

  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: adsKeys.detail(id), queryFn: () => adsApi.detail(id) });
  const invalidate = () => { queryClient.invalidateQueries({ queryKey: adsKeys.detail(id) }); queryClient.invalidateQueries({ queryKey: ['seller', 'ads', 'campaigns'] }); };

  const submitMut = useMutation({ mutationFn: () => adsApi.submit(id), onSuccess: () => { message.success('Submitted for review.'); invalidate(); }, onError: (e) => message.error(e?.message) });
  const pauseMut = useMutation({ mutationFn: () => adsApi.pause(id), onSuccess: () => { message.success('Campaign paused.'); invalidate(); }, onError: (e) => message.error(e?.message) });
  const resumeMut = useMutation({ mutationFn: () => adsApi.resume(id), onSuccess: () => { message.success('Campaign resumed.'); invalidate(); }, onError: (e) => message.error(e?.message) });
  const endMut = useMutation({ mutationFn: () => adsApi.end(id), onSuccess: () => { message.success('Campaign ended.'); invalidate(); }, onError: (e) => message.error(e?.message) });
  const budgetMut = useMutation({
    mutationFn: () => adsApi.updateBudget(id, { dailyBudgetPaise: rupeesToPaise(dailyBudget) }),
    onSuccess: () => { message.success('Budget updated.'); setBudgetOpen(false); invalidate(); },
    onError: (e) => message.error(e?.message ?? 'Could not update the budget.'),
  });

  if (isLoading) return <FullPageSpinner label="Loading campaign…" />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;

  const series = (data.daily ?? []).map((d) => ({ date: d.date.slice(5), spend: d.spendPaise / 100, clicks: d.clicks }));

  return (
    <Flex vertical gap={16}>
      <PageHeader
        title={data.name}
        breadcrumbs={[{ label: 'Growth & Ads', to: '/ads' }, { label: data.name }]}
        onBack={() => navigate('/ads')}
        tags={<StatusTag domain="adCampaign" code={data.status} />}
        actions={
          <Space>
            {data.status === 'DRAFT' && <Can perm="ads.campaign.manage"><Button type="primary" loading={submitMut.isPending} onClick={() => submitMut.mutate()}>Submit for review</Button></Can>}
            {data.status === 'ACTIVE' && <Can perm="ads.campaign.manage"><Button loading={pauseMut.isPending} onClick={() => pauseMut.mutate()}>Pause</Button></Can>}
            {data.status === 'PAUSED' && <Can perm="ads.campaign.manage"><Button type="primary" loading={resumeMut.isPending} onClick={() => resumeMut.mutate()}>Resume</Button></Can>}
            {['ACTIVE', 'PAUSED'].includes(data.status) && <Can perm="ads.campaign.manage"><Button danger loading={endMut.isPending} onClick={() => endMut.mutate()}>End campaign</Button></Can>}
            {['DRAFT', 'ACTIVE', 'PAUSED'].includes(data.status) && (
              <Can perm="ads.campaign.manage">
                <Button onClick={() => { setDailyBudget(paiseToRupees(data.dailyBudgetPaise)); setBudgetOpen(true); }}>Edit budget</Button>
              </Can>
            )}
          </Space>
        }
      />

      {data.status === 'REJECTED' && <Alert type="error" showIcon message="Rejected" description={data.rejectReason} />}
      {data.status === 'PAUSED' && data.pauseReason === 'WALLET_EMPTY' && <Alert type="warning" showIcon message="Paused — wallet empty" description="Recharge your advertising wallet to resume." />}

      <Row gutter={[12, 12]}>
        <Col xs={12} md={6}><StatCard label="Spend" valuePaise={data.spendPaise} format="money" /></Col>
        <Col xs={12} md={6}><StatCard label="Clicks" value={data.clicks} /></Col>
        <Col xs={12} md={6}><StatCard label="CTR" value={data.ctrPct} format="percent" /></Col>
        <Col xs={12} md={6}><StatCard label="ROAS" value={data.roas} extra="x" /></Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} lg={14}>
          <Card title="Spend & clicks (last 14 days)" size="small" style={{ marginBottom: 16 }}>
            {series.length ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={series} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Line type="monotone" dataKey="spend" stroke="#4F46E5" name="Spend (₹)" dot={false} />
                  <Line type="monotone" dataKey="clicks" stroke="#26A541" name="Clicks" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : <Typography.Text type="secondary">No stats yet.</Typography.Text>}
          </Card>

          <Card title={`Promoted products (${data.products.length})`} size="small">
            <Table
              rowKey="id"
              scroll={{ x: 'max-content' }}
              size="small"
              pagination={false}
              dataSource={data.products}
              columns={[
                { title: 'Product', dataIndex: 'title', render: (t, p) => <Space><Avatar shape="square" src={p.image} style={{ background: '#f0f0f0' }}>{t?.[0]}</Avatar><Typography.Text>{t}</Typography.Text></Space> },
                { title: 'Status', dataIndex: 'status', width: 100, render: (s) => <Tag color={s === 'LIVE' ? 'green' : 'default'}>{s}</Tag> },
              ]}
            />
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card title="Budget" size="small" style={{ marginBottom: 16 }}>
            <List
              size="small"
              dataSource={[
                ['Daily budget', <MoneyText key="d" paise={data.dailyBudgetPaise} />],
                ['Total budget', <MoneyText key="t" paise={data.totalBudgetPaise} />],
                ['Bidding', data.biddingType === 'AUTOMATIC' ? 'Automatic' : 'Manual CPC'],
                ['Started', <DateText key="s" value={data.startDate} />],
              ]}
              renderItem={([label, value]) => (
                <List.Item>
                  <Typography.Text type="secondary">{label}</Typography.Text>
                  <Typography.Text strong>{value}</Typography.Text>
                </List.Item>
              )}
            />
          </Card>

          {data.group?.keywords?.length > 0 && (
            <Card title="Keywords" size="small">
              <Space wrap>{data.group.keywords.map((k, i) => <Tag key={i}>{k.term} ({k.matchType})</Tag>)}</Space>
            </Card>
          )}
        </Col>
      </Row>

      <Modal title="Edit daily budget" open={budgetOpen} onCancel={() => setBudgetOpen(false)} onOk={() => budgetMut.mutate()} okText="Update" confirmLoading={budgetMut.isPending}>
        <Typography.Paragraph type="secondary">Current: <MoneyText paise={data.dailyBudgetPaise} /></Typography.Paragraph>
        <InputNumber style={{ width: '100%' }} min={50} prefix="₹" value={dailyBudget} onChange={setDailyBudget} />
      </Modal>
    </Flex>
  );
}
