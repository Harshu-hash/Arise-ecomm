import { PlusOutlined } from '@ant-design/icons';
import { App, Badge, Button, Col, Flex, Row, Tag, Typography } from 'antd';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { queryClient } from '@core/api/queryClient';
import DataTable from '@ui/components/DataTable/DataTable';
import DateText from '@ui/components/DateText';
import FilterBar from '@ui/components/FilterBar';
import PageHeader from '@ui/components/PageHeader';
import StatCard from '@ui/components/StatCard';
import StatusTag from '@ui/components/StatusTag';
import useUrlTableState from '@ui/hooks/useUrlTableState';
import { CAMPAIGN_TYPES, campaignHelpers, campaignKeys, campaignsApi } from '../api/campaigns.api';
import CampaignFormModal from '../components/CampaignFormModal';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'OPEN', label: 'Accepting products' },
  { key: 'ACTIVE', label: 'Live' },
  { key: 'SCHEDULED', label: 'Scheduled' },
  { key: 'DRAFT', label: 'Draft' },
  { key: 'ENDED', label: 'Ended' },
];

export default function CampaignsListPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const state = useUrlTableState({ defaultSort: '-createdAt' });
  const [creating, setCreating] = useState(false);

  const params = {
    ...state.queryParams,
    ...(state.tab && state.tab !== 'all' ? { status: state.tab } : {}),
  };

  const query = useQuery({
    queryKey: campaignKeys.list(params),
    queryFn: () => campaignsApi.list(params),
  });

  const rows = query.data?.data ?? [];
  const meta = query.data?.meta ?? null;
  const facets = meta?.facets?.status ?? {};
  const totalPending = Object.entries(facets).length
    ? rows.reduce((n, r) => n + (r.pendingCount ?? 0), 0)
    : 0;

  const create = useMutation({
    mutationFn: (payload) => campaignsApi.createCampaign(payload),
    onSuccess: ({ data }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'campaigns'] });
      setCreating(false);
      message.success('Campaign created as a draft');
      navigate(`/campaigns/${data.id}`);
    },
    onError: (e) => message.error(e.message),
  });

  const columns = [
    {
      key: 'name', title: 'Campaign', dataIndex: 'name', alwaysVisible: true,
      render: (v, row) => (
        <Flex vertical gap={2}>
          <Typography.Text strong style={{ fontSize: 13 }}>{v}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
            {campaignHelpers.typeLabel(row.type)} · {campaignHelpers.sectionLabel(row.customerSection)}
          </Typography.Text>
        </Flex>
      ),
    },
    {
      key: 'status', title: 'Status', dataIndex: 'status', priority: 1,
      render: (v) => <StatusTag domain="promoCampaign" code={v} />,
    },
    {
      key: 'pendingCount', title: 'To approve', dataIndex: 'pendingCount', align: 'center', priority: 1,
      render: (v) => (v > 0 ? <Badge count={v} overflowCount={999} /> : <Typography.Text type="secondary">—</Typography.Text>),
    },
    {
      key: 'approvedCount', title: 'Live products', dataIndex: 'approvedCount', align: 'center', priority: 2,
      render: (v) => <Typography.Text className="tabular">{v}</Typography.Text>,
    },
    {
      key: 'sellersJoined', title: 'Sellers', dataIndex: 'sellersJoined', align: 'center', priority: 3,
      render: (v) => <Typography.Text className="tabular">{v}</Typography.Text>,
    },
    {
      key: 'window', title: 'Runs', dataIndex: 'startsAt', priority: 2,
      render: (v, row) => (
        <Flex vertical gap={0}>
          <DateText value={v} variant="date" />
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
            to <DateText value={row.endsAt} variant="date" />
          </Typography.Text>
        </Flex>
      ),
    },
    {
      key: 'submissionDeadline', title: 'Entry deadline', dataIndex: 'submissionDeadline', priority: 3,
      render: (v) => <DateText value={v} variant="date" />,
    },
  ];

  return (
    <Flex vertical gap={16}>
      <PageHeader
        title="Campaigns"
        breadcrumbs={[{ label: 'Marketing' }, { label: 'Campaigns' }]}
        subtitle="Run flash deals, offers and sales. Sellers nominate their products; you approve what goes live in the customer app."
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>
            New campaign
          </Button>
        }
      />

      <Row gutter={[12, 12]}>
        <Col xs={12} md={6}>
          <StatCard label="Live campaigns" value={facets.ACTIVE ?? 0} deltaPct={null} />
        </Col>
        <Col xs={12} md={6}>
          <StatCard label="Accepting products" value={facets.OPEN ?? 0} deltaPct={null} />
        </Col>
        <Col xs={12} md={6}>
          <StatCard
            label="Products awaiting approval"
            value={totalPending}
            deltaPct={null}
            extra={totalPending > 0 ? <Tag color="gold" style={{ marginTop: 6 }}>Needs review</Tag> : null}
          />
        </Col>
        <Col xs={12} md={6}>
          <StatCard label="Scheduled" value={facets.SCHEDULED ?? 0} deltaPct={null} />
        </Col>
      </Row>

      <div>
        <FilterBar
          schema={[
            {
              key: 'type', label: 'Type', kind: 'multiSelect', width: 220,
              options: CAMPAIGN_TYPES.map((t) => ({ value: t.value, label: t.label })),
            },
          ]}
          tableState={state}
          searchPlaceholder="Search campaign name"
        />

        <DataTable
          tableId="admin-campaigns"
          columns={columns}
          rows={rows}
          meta={meta}
          loading={query.isLoading || query.isFetching}
          error={query.error}
          onRetry={query.refetch}
          tableState={state}
          tabs={TABS}
          onRowClick={(row) => navigate(`/campaigns/${row.id}`)}
          emptyProps={{
            title: 'No campaigns yet',
            description: 'Create your first flash deal, offer or sale.',
            actionLabel: 'New campaign',
            onAction: () => setCreating(true),
          }}
          mobileCard={(row) => (
            <Flex vertical gap={6}>
              <Flex justify="space-between" gap={8}>
                <Typography.Text strong>{row.name}</Typography.Text>
                <StatusTag domain="promoCampaign" code={row.status} />
              </Flex>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {campaignHelpers.typeLabel(row.type)} · {campaignHelpers.sectionLabel(row.customerSection)}
              </Typography.Text>
              <Flex gap={8} wrap>
                {row.pendingCount > 0 && <Tag color="gold">{row.pendingCount} to approve</Tag>}
                <Tag>{row.approvedCount} live</Tag>
                <Tag>{row.sellersJoined} sellers</Tag>
              </Flex>
            </Flex>
          )}
        />
      </div>

      <CampaignFormModal
        open={creating}
        onClose={() => setCreating(false)}
        onSubmit={(payload) => create.mutate(payload)}
        loading={create.isPending}
      />
    </Flex>
  );
}
