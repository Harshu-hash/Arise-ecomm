import { Card, Flex, Segmented, Tabs } from 'antd';
import { useQuery } from '@tanstack/react-query';
import ErrorState from '@ui/components/ErrorState';
import PageHeader from '@ui/components/PageHeader';
import useUrlTableState from '@ui/hooks/useUrlTableState';
import { DOMAIN_LABELS, DOMAINS, analyticsApi, analyticsKeys } from '../api/analytics.api';
import { DOMAIN_RENDERERS } from '../components/domainPanels';

const RANGES = [
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
];

/**
 * Platform analytics: nine domains, each with its own KPI band and the charts
 * that domain's data warrants. The selected window applies across every tab.
 */
export default function AnalyticsPage() {
  const state = useUrlTableState({ defaultSort: '', defaultPageSize: 25 });
  const days = Number(state.filters.days ?? 30);
  const domain = DOMAINS.includes(state.filters.domain) ? state.filters.domain : 'sales';

  return (
    <Flex vertical gap={16}>
      <PageHeader
        title="Analytics"
        subtitle="Every corner of the marketplace, aggregated live from real orders, finance and support data."
        actions={
          <Segmented
            value={days}
            onChange={(v) => state.patchFilters({ days: String(v) })}
            options={RANGES}
          />
        }
      />

      <Tabs
        activeKey={domain}
        onChange={(key) => state.patchFilters({ domain: key })}
        items={DOMAINS.map((d) => ({
          key: d,
          label: DOMAIN_LABELS[d],
          children: <DomainView domain={d} days={days} />,
        }))}
      />
    </Flex>
  );
}

function DomainView({ domain, days }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: analyticsKeys.domain(domain, days),
    queryFn: () => analyticsApi.domain(domain, days),
  });

  if (error) {
    return (
      <Card variant="borderless">
        <ErrorState error={error} onRetry={refetch} title={`Could not load ${DOMAIN_LABELS[domain]} analytics`} />
      </Card>
    );
  }

  return DOMAIN_RENDERERS[domain](data?.totals ?? {}, data, isLoading);
}
