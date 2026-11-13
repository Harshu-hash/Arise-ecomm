import { ArrowRightOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { Button, Card, Col, Empty, Flex, Input, Row, Segmented, Skeleton, Space, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fromNow } from '@core/utils/date';
import DateText from '@ui/components/DateText';
import PageHeader from '@ui/components/PageHeader';
import StatusTag from '@ui/components/StatusTag';
import {
  CAMPAIGN_TYPE_LABELS,
  CUSTOMER_SECTION_LABELS,
  sellerCampaignKeys,
  sellerCampaignsApi,
} from '../api/campaigns.api';

const TABS = [
  { value: 'all', label: 'All campaigns' },
  { value: 'open', label: 'Open to join' },
  { value: 'joined', label: 'My campaigns' },
];

export default function CampaignsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');

  const params = { tab, q: q || undefined };
  const query = useQuery({
    queryKey: sellerCampaignKeys.list(params),
    queryFn: () => sellerCampaignsApi.list(params),
  });
  const rows = query.data?.data ?? [];

  return (
    <Flex vertical gap={16}>
      <PageHeader
        title="Campaigns"
        breadcrumbs={[{ label: 'Campaigns' }]}
        subtitle="Join the sales and flash deals Arise is running. Add your products, set a deal price, and once approved they go live in the app."
      />

      <Flex gap={8} wrap justify="space-between" align="center">
        <Segmented value={tab} onChange={setTab} options={TABS} />
        <Input.Search
          allowClear
          placeholder="Search campaigns"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ maxWidth: 280 }}
        />
      </Flex>

      {query.isLoading ? (
        <Row gutter={[16, 16]}>
          {[0, 1, 2].map((i) => (
            <Col xs={24} md={12} xl={8} key={i}>
              <Card><Skeleton active paragraph={{ rows: 3 }} /></Card>
            </Col>
          ))}
        </Row>
      ) : rows.length === 0 ? (
        <Card><Empty description="No campaigns here yet" /></Card>
      ) : (
        <Row gutter={[16, 16]}>
          {rows.map((c) => (
            <Col xs={24} md={12} xl={8} key={c.id}>
              <CampaignCard campaign={c} onOpen={() => navigate(`/campaigns/${c.id}`)} />
            </Col>
          ))}
        </Row>
      )}
    </Flex>
  );
}

function CampaignCard({ campaign, onOpen }) {
  const open = campaign.status === 'OPEN';
  const deadlinePassed = new Date(campaign.submissionDeadline) < new Date();
  const canJoin = open && !deadlinePassed;

  return (
    <Card
      hoverable
      onClick={onOpen}
      style={{ height: '100%' }}
      styles={{ body: { display: 'flex', flexDirection: 'column', gap: 12, height: '100%' } }}
    >
      <Flex justify="space-between" align="flex-start" gap={8}>
        <div style={{ minWidth: 0 }}>
          <Typography.Text strong style={{ fontSize: 16 }}>{campaign.name}</Typography.Text>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {campaign.tagline || CUSTOMER_SECTION_LABELS[campaign.customerSection]}
            </Typography.Text>
          </div>
        </div>
        <StatusTag domain="promoCampaign" code={campaign.status} />
      </Flex>

      <Space size={6} wrap>
        <Tag color="blue" style={{ marginInlineEnd: 0 }}>{CAMPAIGN_TYPE_LABELS[campaign.type]}</Tag>
        <Tag style={{ marginInlineEnd: 0 }}>Min {campaign.minDiscountPct}% off</Tag>
        {campaign.myProducts > 0 && (
          <Tag color="green" style={{ marginInlineEnd: 0 }}>
            {campaign.myProducts} of your products
          </Tag>
        )}
      </Space>

      <Flex vertical gap={4} style={{ fontSize: 12 }}>
        <Flex justify="space-between">
          <Typography.Text type="secondary">Runs</Typography.Text>
          <Typography.Text>
            <DateText value={campaign.startsAt} variant="date" /> – <DateText value={campaign.endsAt} variant="date" />
          </Typography.Text>
        </Flex>
        <Flex justify="space-between">
          <Typography.Text type="secondary"><ClockCircleOutlined /> Entry deadline</Typography.Text>
          <Typography.Text type={deadlinePassed ? 'danger' : 'warning'}>
            {deadlinePassed ? 'Closed' : fromNow(campaign.submissionDeadline)}
          </Typography.Text>
        </Flex>
        <Flex justify="space-between">
          <Typography.Text type="secondary">Shows in</Typography.Text>
          <Typography.Text>{CUSTOMER_SECTION_LABELS[campaign.customerSection]}</Typography.Text>
        </Flex>
      </Flex>

      <div style={{ marginTop: 'auto' }}>
        <Button type={canJoin ? 'primary' : 'default'} block onClick={(e) => { e.stopPropagation(); onOpen(); }}>
          {campaign.myProducts > 0 ? 'View my entries' : canJoin ? 'Add products' : 'View campaign'}
          <ArrowRightOutlined />
        </Button>
      </div>
    </Card>
  );
}
