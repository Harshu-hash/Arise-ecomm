import { Card, Flex, Segmented, Tabs } from 'antd';
import { useQuery } from '@tanstack/react-query';
import ErrorState from '@ui/components/ErrorState';
import PageHeader from '@ui/components/PageHeader';
import useUrlTableState from '@ui/hooks/useUrlTableState';
import { VIEW_LABELS, VIEWS, analyticsApi, analyticsKeys, daysToRange } from '../api/analytics.api';
import { VIEW_RENDERERS } from '../components/viewPanels';

const RANGES = [
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
];

/**
 * Seller analytics: five views over a shared date window, each reading the
 * seller-scoped funnel, order, settlement and inventory data.
 */
export default function AnalyticsPage() {
  const state = useUrlTableState({ defaultSort: '', defaultPageSize: 25 });
  const days = Number(state.filters.days ?? 30);
  const view = VIEWS.includes(state.filters.view) ? state.filters.view : 'overview';

  return (
    <Flex vertical gap={16}>
      <PageHeader
        title="Analytics"
        subtitle="How shoppers find your listings, what they buy, and what you earn."
        actions={
          <Segmented
            value={days}
            onChange={(v) => state.patchFilters({ days: String(v) })}
            options={RANGES}
          />
        }
      />

      <Tabs
        activeKey={view}
        onChange={(key) => state.patchFilters({ view: key })}
        items={VIEWS.map((v) => ({
          key: v,
          label: VIEW_LABELS[v],
          children: <ViewPanel view={v} days={days} />,
        }))}
      />
    </Flex>
  );
}

function ViewPanel({ view, days }) {
  const params = { ...daysToRange(days), compare: view === 'overview' ? 'true' : undefined };
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: analyticsKeys.view(view, params),
    queryFn: () => analyticsApi.view(view, params),
  });

  if (error) {
    return (
      <Card variant="borderless">
        <ErrorState error={error} onRetry={refetch} title={`Could not load ${VIEW_LABELS[view]}`} />
      </Card>
    );
  }

  return VIEW_RENDERERS[view](data, isLoading);
}
