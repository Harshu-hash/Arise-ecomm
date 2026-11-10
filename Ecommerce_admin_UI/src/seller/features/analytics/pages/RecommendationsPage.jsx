import { App, Button, Card, Flex, Space, Tag, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import ErrorState from '@ui/components/ErrorState';
import PageHeader from '@ui/components/PageHeader';
import { analyticsApi, analyticsKeys } from '../api/analytics.api';

export default function RecommendationsPage() {
  const { message } = App.useApp();
  const client = useQueryClient();
  const query = useQuery({ queryKey: analyticsKeys.recommendations, queryFn: analyticsApi.recommendations });
  const action = useMutation({ mutationFn: ({ id, name }) => analyticsApi.actOnRecommendation(id, name), onSuccess: () => { client.invalidateQueries({ queryKey: analyticsKeys.recommendations }); message.success('Recommendation updated and recorded in the audit log.'); }, onError: (error) => message.error(error?.message ?? 'Could not update recommendation.') });
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />;
  return <Flex vertical gap={16}><PageHeader title="Recommendations" breadcrumbs={[{ label: 'Analytics' }, { label: 'Recommendations' }]} subtitle="Prioritised opportunities with measurable impact and auditable actions." />{(query.data ?? []).map((row) => <Card key={row.id} size="small"><Flex justify="space-between" align="flex-start" gap={16} wrap="wrap"><div><Space wrap><Typography.Text strong>{row.title}</Typography.Text><Tag>{row.type}</Tag><Tag color={row.status === 'OPEN' ? 'blue' : 'default'}>{row.status}</Tag></Space><Typography.Paragraph type="secondary" style={{ margin: '8px 0' }}>{row.rationale}</Typography.Paragraph><Typography.Text type="secondary">Expected impact: {row.estimatedImpact ?? 'Opportunity identified'} · Based on {row.provenance ?? 'seller data'}</Typography.Text></div>{row.status === 'OPEN' && <Space>{row.actionPath && <Button><Link to={row.actionPath}>Open workspace</Link></Button>}<Button type="primary" loading={action.isPending} onClick={() => action.mutate({ id: row.id, name: 'apply' })}>Mark applied</Button><Button onClick={() => action.mutate({ id: row.id, name: 'snooze' })}>Snooze</Button><Button type="text" onClick={() => action.mutate({ id: row.id, name: 'dismiss' })}>Dismiss</Button></Space>}</Flex></Card>)}</Flex>;
}
