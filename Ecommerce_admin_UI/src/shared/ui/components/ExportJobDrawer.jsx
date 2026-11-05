import { CheckCircleOutlined, CloseCircleOutlined, DownloadOutlined, LoadingOutlined } from '@ant-design/icons';
import { Button, Drawer, Empty, List, Progress, Space, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { exportJobsApi, foundationKeys } from '@core/api/foundationApi';
import DateText from './DateText';

const ACTIVE = new Set(['QUEUED', 'PROCESSING']);

export default function ExportJobDrawer({ open, onClose }) {
  const query = useQuery({
    queryKey: foundationKeys.jobs,
    queryFn: exportJobsApi.list,
    enabled: open,
    refetchInterval: (state) => state.state.data?.some((job) => ACTIVE.has(job.status)) ? 1000 : false,
  });
  return (
    <Drawer title="Export jobs" open={open} onClose={onClose} width={520}>
      {!query.data?.length && !query.isLoading ? <Empty description="No exports yet" /> : (
        <List loading={query.isLoading} dataSource={query.data ?? []} renderItem={(job) => {
          const complete = ['COMPLETED', 'COMPLETED_WITH_ERRORS'].includes(job.status);
          const failed = job.status === 'FAILED';
          return <List.Item actions={complete && job.resultUrl ? [<Button key="download" type="link" icon={<DownloadOutlined />} href={job.resultUrl}>Download</Button>] : []}>
            <List.Item.Meta
              avatar={failed ? <CloseCircleOutlined style={{ color: 'var(--ant-color-error)' }} /> : complete ? <CheckCircleOutlined style={{ color: 'var(--ant-color-success)' }} /> : <LoadingOutlined />}
              title={<Space><Typography.Text strong>{job.label}</Typography.Text><Tag>{job.status}</Tag></Space>}
              description={<Space direction="vertical" size={2} style={{ width: '100%' }}><DateText value={job.createdAt} /><Progress percent={job.progressPct ?? 0} size="small" status={failed ? 'exception' : undefined} />{job.expiresAt && <Typography.Text type="secondary" style={{ fontSize: 12 }}>Available until <DateText value={job.expiresAt} variant="date" /></Typography.Text>}</Space>}
            />
          </List.Item>;
        }} />
      )}
    </Drawer>
  );
}
