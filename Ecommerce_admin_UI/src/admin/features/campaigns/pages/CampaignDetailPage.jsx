/* eslint-disable max-lines -- detail view keeps the approval queue and its columns in one screen */
import { ArrowLeftOutlined, CheckOutlined } from '@ant-design/icons';
import { App, Button, Col, Flex, Row, Space, Tag, Typography } from 'antd';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { queryClient } from '@core/api/queryClient';
import DataTable from '@ui/components/DataTable/DataTable';
import DateText from '@ui/components/DateText';
import FilterBar from '@ui/components/FilterBar';
import MoneyText from '@ui/components/MoneyText';
import PageHeader from '@ui/components/PageHeader';
import PageState from '@ui/components/PageState';
import { PAGE_STATES } from '@ui/components/pageStates';
import StatCard from '@ui/components/StatCard';
import StatusTag from '@ui/components/StatusTag';
import useUrlTableState from '@ui/hooks/useUrlTableState';
import { campaignHelpers, campaignKeys, campaignsApi } from '../api/campaigns.api';
import CampaignFormModal from '../components/CampaignFormModal';
import SubmissionReviewDrawer from '../components/SubmissionReviewDrawer';

const SUB_TABS = [
  { key: 'all', label: 'All' },
  { key: 'PENDING', label: 'To approve' },
  { key: 'APPROVED', label: 'Live' },
  { key: 'NEEDS_CHANGES', label: 'Changes requested' },
  { key: 'REJECTED', label: 'Rejected' },
];

/** Status transitions the admin can trigger from the header. */
const NEXT_STATUS = {
  DRAFT: [{ to: 'OPEN', label: 'Open for seller entries' }],
  OPEN: [{ to: 'SCHEDULED', label: 'Close entries & schedule' }, { to: 'CANCELLED', label: 'Cancel campaign', danger: true }],
  SCHEDULED: [{ to: 'ACTIVE', label: 'Go live now' }, { to: 'CANCELLED', label: 'Cancel campaign', danger: true }],
  ACTIVE: [{ to: 'PAUSED', label: 'Pause' }, { to: 'ENDED', label: 'End campaign' }],
  PAUSED: [{ to: 'ACTIVE', label: 'Resume' }, { to: 'ENDED', label: 'End campaign' }],
};

export default function CampaignDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const state = useUrlTableState({ defaultSort: '-submittedAt', defaultTab: 'PENDING' });
  const [editing, setEditing] = useState(false);
  const [reviewing, setReviewing] = useState(null);

  const campaignQuery = useQuery({
    queryKey: campaignKeys.detail(id),
    queryFn: () => campaignsApi.get(id),
  });
  const campaign = campaignQuery.data?.data;

  const subParams = {
    ...state.queryParams,
    ...(state.tab && state.tab !== 'all' ? { status: state.tab } : {}),
  };
  const subsQuery = useQuery({
    queryKey: campaignKeys.submissions(id, subParams),
    queryFn: () => campaignsApi.submissions(id, subParams),
  });
  const rows = subsQuery.data?.data ?? [];
  const meta = subsQuery.data?.meta ?? null;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'campaigns'] });

  const setStatus = useMutation({
    mutationFn: (status) => campaignsApi.setStatus(id, status),
    onSuccess: () => { invalidate(); message.success('Campaign updated'); },
    onError: (e) => message.error(e.message),
  });

  const update = useMutation({
    mutationFn: (payload) => campaignsApi.updateCampaign(id, payload),
    onSuccess: () => { invalidate(); setEditing(false); message.success('Changes saved'); },
    onError: (e) => message.error(e.message),
  });

  const decide = useMutation({
    mutationFn: ({ submissionId, decision, reason }) =>
      campaignsApi.decideSubmission(submissionId, decision, reason),
    onSuccess: (_d, vars) => {
      invalidate();
      setReviewing(null);
      message.success(
        vars.decision === 'approve' ? 'Approved — now live for customers'
          : vars.decision === 'reject' ? 'Entry rejected'
            : 'Sent back to the seller',
      );
    },
    onError: (e) => message.error(e.message),
  });

  const bulkApprove = useMutation({
    mutationFn: async (ids) => {
      for (const subId of ids) await campaignsApi.decideSubmission(subId, 'approve');
    },
    onSuccess: (_d, ids) => { invalidate(); message.success(`${ids.length} entries approved`); },
    onError: (e) => message.error(e.message),
  });

  if (campaignQuery.isLoading || campaignQuery.error || !campaign) {
    return (
      <PageState
        state={campaignQuery.isLoading ? PAGE_STATES.INITIAL_LOADING : PAGE_STATES.FAILURE}
        error={campaignQuery.error}
        onRetry={campaignQuery.refetch}
      />
    );
  }

  const transitions = NEXT_STATUS[campaign.status] ?? [];

  const columns = [
    {
      key: 'productTitle', title: 'Product', dataIndex: 'productTitle', alwaysVisible: true,
      render: (v, row) => (
        <Flex vertical gap={2}>
          <Typography.Text strong style={{ fontSize: 13 }}>{v}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>{row.brand}</Typography.Text>
        </Flex>
      ),
    },
    { key: 'sellerName', title: 'Seller', dataIndex: 'sellerName', priority: 2 },
    {
      key: 'dealPricePaise', title: 'Campaign price', dataIndex: 'dealPricePaise', align: 'right', priority: 1,
      render: (v, row) => (
        <Flex vertical align="flex-end" gap={0}>
          <MoneyText paise={v} strong />
          <Typography.Text type="secondary" style={{ fontSize: 10, textDecoration: 'line-through' }}>
            <MoneyText paise={row.mrpPaise} />
          </Typography.Text>
        </Flex>
      ),
    },
    {
      key: 'discountPct', title: 'Discount', dataIndex: 'discountPct', align: 'center', priority: 1,
      render: (v) => (
        <Tag color={v < campaign.minDiscountPct ? 'red' : 'green'} style={{ marginInlineEnd: 0 }}>{v}%</Tag>
      ),
    },
    { key: 'stockCommitted', title: 'Stock', dataIndex: 'stockCommitted', align: 'center', priority: 3 },
    {
      key: 'status', title: 'Status', dataIndex: 'status', priority: 1,
      render: (v) => <StatusTag domain="campaignSubmission" code={v} />,
    },
    {
      key: 'submittedAt', title: 'Submitted', dataIndex: 'submittedAt', priority: 3,
      render: (v) => <DateText value={v} />,
    },
    {
      key: 'actions', title: '', align: 'right', priority: 1,
      render: (_v, row) => (
        <Button size="small" type="link" onClick={(e) => { e.stopPropagation(); setReviewing(row); }}>
          Review
        </Button>
      ),
    },
  ];

  return (
    <Flex vertical gap={16}>
      <PageHeader
        title={campaign.name}
        onBack={<Button icon={<ArrowLeftOutlined />} type="text" onClick={() => navigate('/campaigns')} aria-label="Back" />}
        breadcrumbs={[{ label: 'Marketing' }, { label: 'Campaigns', to: '/campaigns' }, { label: campaign.name }]}
        tags={<StatusTag domain="promoCampaign" code={campaign.status} />}
        subtitle={campaign.tagline || undefined}
        meta={[
          <Typography.Text key="type" type="secondary">{campaignHelpers.typeLabel(campaign.type)}</Typography.Text>,
          <Typography.Text key="sec" type="secondary">{campaignHelpers.sectionLabel(campaign.customerSection)}</Typography.Text>,
          <Typography.Text key="disc" type="secondary">Min {campaign.minDiscountPct}% off</Typography.Text>,
        ]}
        actions={
          <Space wrap>
            <Button onClick={() => setEditing(true)}>Edit</Button>
            {transitions.map((t) => (
              <Button
                key={t.to}
                danger={t.danger}
                type={t.to === 'ACTIVE' || t.to === 'OPEN' ? 'primary' : 'default'}
                loading={setStatus.isPending && setStatus.variables === t.to}
                onClick={() => setStatus.mutate(t.to)}
              >
                {t.label}
              </Button>
            ))}
          </Space>
        }
      />

      <Row gutter={[12, 12]}>
        <Col xs={12} md={6}>
          <StatCard label="Awaiting approval" value={campaign.pendingCount} deltaPct={null}
            extra={campaign.pendingCount > 0 ? <Tag color="gold" style={{ marginTop: 6 }}>Review</Tag> : null} />
        </Col>
        <Col xs={12} md={6}><StatCard label="Live products" value={campaign.approvedCount} deltaPct={null} /></Col>
        <Col xs={12} md={6}><StatCard label="Rejected" value={campaign.rejectedCount} deltaPct={null} /></Col>
        <Col xs={12} md={6}><StatCard label="Sellers joined" value={campaign.sellersJoined} deltaPct={null} /></Col>
      </Row>

      <Row gutter={[12, 12]}>
        <Col xs={24} md={8}>
          <StatCard
            label="Runs"
            value={0}
            deltaPct={null}
            format="number"
            extra={
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                <DateText value={campaign.startsAt} variant="date" /> → <DateText value={campaign.endsAt} variant="date" />
              </Typography.Text>
            }
          />
        </Col>
      </Row>

      <div>
        <Typography.Title level={5} style={{ marginBottom: 12 }}>Product entries</Typography.Title>
        <FilterBar
          schema={[]}
          tableState={state}
          searchPlaceholder="Search product, brand or seller"
        />
        <DataTable
          tableId="campaign-submissions"
          columns={columns}
          rows={rows}
          meta={meta}
          loading={subsQuery.isLoading || subsQuery.isFetching}
          error={subsQuery.error}
          onRetry={subsQuery.refetch}
          tableState={state}
          tabs={SUB_TABS}
          onRowClick={(row) => setReviewing(row)}
          selection={{ getCheckboxProps: (row) => ({ disabled: row.status !== 'PENDING' }) }}
          bulkActions={[
            {
              key: 'approve',
              label: 'Approve selected',
              icon: <CheckOutlined />,
              type: 'primary',
              onClick: ({ selectedKeys }) => bulkApprove.mutate(selectedKeys),
            },
          ]}
          emptyProps={{ title: 'No entries in this view', description: 'Seller product nominations appear here for approval.' }}
          mobileCard={(row) => (
            <Flex vertical gap={6} onClick={() => setReviewing(row)}>
              <Flex justify="space-between" gap={8}>
                <Typography.Text strong>{row.productTitle}</Typography.Text>
                <StatusTag domain="campaignSubmission" code={row.status} />
              </Flex>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>{row.sellerName}</Typography.Text>
              <Space size={8}>
                <MoneyText paise={row.dealPricePaise} strong />
                <Tag color={row.discountPct < campaign.minDiscountPct ? 'red' : 'green'}>{row.discountPct}%</Tag>
              </Space>
            </Flex>
          )}
        />
      </div>

      <SubmissionReviewDrawer
        open={Boolean(reviewing)}
        submission={reviewing}
        campaign={campaign}
        onClose={() => setReviewing(null)}
        loading={decide.isPending}
        onDecide={(submission, decision, reason) =>
          decide.mutate({ submissionId: submission.id, decision, reason })}
      />

      <CampaignFormModal
        open={editing}
        initial={campaign}
        onClose={() => setEditing(false)}
        onSubmit={(payload) => update.mutate(payload)}
        loading={update.isPending}
      />
    </Flex>
  );
}
