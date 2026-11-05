import { Alert, Button, Card, Result, Skeleton, Space, Spin, Typography } from 'antd';
import EmptyState from './EmptyState';
import ErrorState from './ErrorState';
import NoAccess from './NoAccess';
import { PAGE_STATES } from './pageStates';

export default function PageState({ state, children, error, onRetry, onRefresh, required, emptyProps, lastUpdatedAt }) {
  if (state === PAGE_STATES.INITIAL_LOADING) return <Card><Skeleton active paragraph={{ rows: 6 }} /></Card>;
  if (state === PAGE_STATES.FAILURE) return <ErrorState error={error} onRetry={onRetry} />;
  if (state === PAGE_STATES.FORBIDDEN) return <NoAccess required={required} />;
  if (state === PAGE_STATES.EMPTY) return <EmptyState {...emptyProps} />;
  if (state === PAGE_STATES.CONFLICT) return <Result status="warning" title="This record changed elsewhere" subTitle="Refresh to load the current version before trying again." extra={<Button type="primary" onClick={onRefresh}>Refresh current version</Button>} />;
  return <Space direction="vertical" style={{ width: '100%' }}>
    {state === PAGE_STATES.REFRESHING && <Alert type="info" showIcon icon={<Spin size="small" />} message="Refreshing data…" />}
    {state === PAGE_STATES.PARTIAL_FAILURE && <Alert type="warning" showIcon message="Some information could not be loaded" action={<Button size="small" onClick={onRetry}>Retry</Button>} />}
    {state === PAGE_STATES.STALE && <Alert type="warning" showIcon message="This data may be out of date" description={lastUpdatedAt ? <Typography.Text>Last updated {lastUpdatedAt}</Typography.Text> : undefined} action={<Button size="small" onClick={onRefresh}>Refresh</Button>} />}
    {children}
  </Space>;
}
