import { ArrowLeftOutlined, PlusOutlined } from '@ant-design/icons';
import { Alert, App, Button, Card, Col, Descriptions, Flex, Row, Space, Tag, Typography } from 'antd';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { queryClient } from '@core/api/queryClient';
import { fromNow } from '@core/utils/date';
import ConfirmActionModal from '@ui/components/ConfirmActionModal';
import DataTable from '@ui/components/DataTable/DataTable';
import DateText from '@ui/components/DateText';
import MoneyText from '@ui/components/MoneyText';
import PageHeader from '@ui/components/PageHeader';
import PageState from '@ui/components/PageState';
import { PAGE_STATES } from '@ui/components/pageStates';
import StatusTag from '@ui/components/StatusTag';
import useUrlTableState from '@ui/hooks/useUrlTableState';
import {
  CAMPAIGN_TYPE_LABELS,
  CUSTOMER_SECTION_LABELS,
  sellerCampaignKeys,
  sellerCampaignsApi,
} from '../api/campaigns.api';
import SubmitProductsModal from '../components/SubmitProductsModal';

export default function CampaignDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const state = useUrlTableState({ defaultSort: '-submittedAt' });
  const [adding, setAdding] = useState(false);
  const [withdrawing, setWithdrawing] = useState(null);

  const campaignQuery = useQuery({
    queryKey: sellerCampaignKeys.detail(id),
    queryFn: () => sellerCampaignsApi.get(id),
  });
  const campaign = campaignQuery.data?.data;

  const subsQuery = useQuery({
    queryKey: sellerCampaignKeys.submissions(id, state.queryParams),
    queryFn: () => sellerCampaignsApi.mySubmissions(id, state.queryParams),
  });
  const rows = subsQuery.data?.data ?? [];
  const meta = subsQuery.data?.meta ?? null;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['seller', 'campaigns'] });

  const submit = useMutation({
    mutationFn: (entries) => sellerCampaignsApi.submitProducts(id, entries),
    onSuccess: ({ data }) => {
      invalidate();
      setAdding(false);
      message.success(`${data.length} product${data.length > 1 ? 's' : ''} submitted for approval`);
    },
    onError: (e) => message.error(e.message),
  });

  const withdraw = useMutation({
    mutationFn: (submissionId) => sellerCampaignsApi.withdraw(submissionId),
    onSuccess: () => { invalidate(); setWithdrawing(null); message.success('Entry withdrawn'); },
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

  const deadlinePassed = new Date(campaign.submissionDeadline) < new Date();
  const canAdd = campaign.status === 'OPEN' && !deadlinePassed;
  const needsAttention = rows.filter((r) => r.status === 'NEEDS_CHANGES');

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
    {
      key: 'dealPricePaise', title: 'Deal price', dataIndex: 'dealPricePaise', align: 'right', priority: 1,
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
      key: 'discountPct', title: 'Discount', dataIndex: 'discountPct', align: 'center', priority: 2,
      render: (v) => <Tag style={{ marginInlineEnd: 0 }}>{v}%</Tag>,
    },
    { key: 'stockCommitted', title: 'Stock', dataIndex: 'stockCommitted', align: 'center', priority: 3 },
    {
      key: 'status', title: 'Status', dataIndex: 'status', priority: 1,
      render: (v, row) => <StatusTag domain="campaignSubmission" code={v} tooltip={row.feedback || undefined} />,
    },
    {
      key: 'submittedAt', title: 'Submitted', dataIndex: 'submittedAt', priority: 3,
      render: (v) => <DateText value={v} />,
    },
    {
      key: 'actions', title: '', align: 'right', priority: 1,
      render: (_v, row) =>
        row.status === 'PENDING' || row.status === 'NEEDS_CHANGES' ? (
          <Button size="small" type="text" danger onClick={() => setWithdrawing(row)}>
            Withdraw
          </Button>
        ) : null,
    },
  ];

  return (
    <Flex vertical gap={16}>
      <PageHeader
        title={campaign.name}
        onBack={<Button icon={<ArrowLeftOutlined />} type="text" onClick={() => navigate('/campaigns')} aria-label="Back" />}
        breadcrumbs={[{ label: 'Campaigns', to: '/campaigns' }, { label: campaign.name }]}
        tags={<StatusTag domain="promoCampaign" code={campaign.status} />}
        subtitle={campaign.tagline || undefined}
        actions={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={!canAdd}
            onClick={() => setAdding(true)}
          >
            Add products
          </Button>
        }
      />

      {!canAdd && (
        <Alert
          type={deadlinePassed ? 'warning' : 'info'}
          showIcon
          message={
            deadlinePassed
              ? 'Entries are closed for this campaign.'
              : 'This campaign is not open for new entries yet.'
          }
        />
      )}

      {needsAttention.length > 0 && (
        <Alert
          type="warning"
          showIcon
          message={`${needsAttention.length} of your entries need changes`}
          description="Open an entry's status for the reviewer's note. Withdraw and resubmit with the fix."
        />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} md={14}>
          <Card title="Campaign details" size="small">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Type">{CAMPAIGN_TYPE_LABELS[campaign.type]}</Descriptions.Item>
              <Descriptions.Item label="Shows in app">{CUSTOMER_SECTION_LABELS[campaign.customerSection]}</Descriptions.Item>
              <Descriptions.Item label="Minimum discount">{campaign.minDiscountPct}% off MRP</Descriptions.Item>
              <Descriptions.Item label="Max units / customer">{campaign.maxUnitsPerCustomer}</Descriptions.Item>
              <Descriptions.Item label="Live window">
                <DateText value={campaign.startsAt} variant="date" /> – <DateText value={campaign.endsAt} variant="date" />
              </Descriptions.Item>
              <Descriptions.Item label="Entry deadline">
                <Space>
                  <DateText value={campaign.submissionDeadline} variant="datetime" />
                  <Tag color={deadlinePassed ? 'red' : 'gold'} style={{ marginInlineEnd: 0 }}>
                    {deadlinePassed ? 'Closed' : fromNow(campaign.submissionDeadline)}
                  </Tag>
                </Space>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col xs={24} md={10}>
          <Card title="Your participation" size="small">
            <Flex gap={24} wrap>
              <Flex vertical>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>Products entered</Typography.Text>
                <Typography.Title level={3} style={{ margin: 0 }}>{campaign.myProducts}</Typography.Title>
              </Flex>
              <Flex vertical>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>Live for customers</Typography.Text>
                <Typography.Title level={3} style={{ margin: 0, color: 'var(--ant-color-success)' }}>
                  {campaign.myLiveProducts}
                </Typography.Title>
              </Flex>
            </Flex>
          </Card>
        </Col>
      </Row>

      <div>
        <Typography.Title level={5} style={{ marginBottom: 12 }}>Your entries</Typography.Title>
        <DataTable
          tableId="seller-campaign-submissions"
          columns={columns}
          rows={rows}
          meta={meta}
          loading={subsQuery.isLoading || subsQuery.isFetching}
          error={subsQuery.error}
          onRetry={subsQuery.refetch}
          tableState={state}
          emptyProps={{
            title: 'You have not added any products yet',
            description: canAdd ? 'Add products to take part in this campaign.' : 'Entries are closed.',
            actionLabel: canAdd ? 'Add products' : undefined,
            onAction: canAdd ? () => setAdding(true) : undefined,
          }}
          mobileCard={(row) => (
            <Flex vertical gap={6}>
              <Flex justify="space-between" gap={8}>
                <Typography.Text strong>{row.productTitle}</Typography.Text>
                <StatusTag domain="campaignSubmission" code={row.status} />
              </Flex>
              <Space size={8}>
                <MoneyText paise={row.dealPricePaise} strong />
                <Tag>{row.discountPct}% off</Tag>
              </Space>
              {row.feedback && <Typography.Text type="secondary" style={{ fontSize: 12 }}>{row.feedback}</Typography.Text>}
            </Flex>
          )}
        />
      </div>

      <SubmitProductsModal
        open={adding}
        campaign={campaign}
        onClose={() => setAdding(false)}
        onSubmit={(entries) => submit.mutate(entries)}
        loading={submit.isPending}
      />

      <ConfirmActionModal
        open={Boolean(withdrawing)}
        onCancel={() => setWithdrawing(null)}
        onConfirm={() => withdraw.mutate(withdrawing.id)}
        loading={withdraw.isPending}
        danger
        title="Withdraw this entry"
        description={withdrawing?.productTitle}
        impact="It will be removed from this campaign. You can add it again before the deadline."
        reasonRequired={false}
        showNote={false}
        confirmLabel="Withdraw"
      />
    </Flex>
  );
}
