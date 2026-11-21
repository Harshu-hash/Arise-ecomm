import { App, Button, Drawer, Flex, List, Skeleton, Tag, Typography } from 'antd';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError } from '@core/api/errors';
import { queryClient } from '@core/api/queryClient';
import { useSessionStore } from '@core/auth/sessionStore';
import ConfirmActionModal from '@ui/components/ConfirmActionModal';
import DateText from '@ui/components/DateText';
import ErrorState from '@ui/components/ErrorState';
import StatusTag from '@ui/components/StatusTag';
import { cmsApi, cmsKeys } from '../api/cms.api';

/** Every home layout version, oldest draft to oldest archive, with a rollback that needs a second approver. */
export default function VersionHistoryDrawer({ open, onClose }) {
  const { message } = App.useApp();
  const [rollingBack, setRollingBack] = useState(null);
  const userId = useSessionStore((state) => state.user?.id);

  const query = useQuery({
    queryKey: cmsKeys.homeVersions,
    queryFn: () => cmsApi.homeVersions(),
    enabled: open,
  });

  const rollback = useMutation({
    mutationFn: ({ versionId, reason }) => cmsApi.rollbackHome(versionId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cms', 'home'] });
      setRollingBack(null);
      message.info('Sent for approval. The rollback takes effect once another admin agrees.');
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : 'Could not roll back'),
  });

  // A different admin approves (the layout goes live) or rejects it; the requester can only withdraw their own.
  const decide = useMutation({
    mutationFn: ({ versionId, decision }) => cmsApi.decideRollback(versionId, decision),
    onSuccess: (_res, { decision }) => {
      queryClient.invalidateQueries({ queryKey: ['cms', 'home'] });
      message.success(decision === 'approve' ? 'Rolled back — the app will pick this up immediately' : 'Rollback request closed');
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : 'Could not update the rollback request'),
  });
  const hasPending = Boolean(query.data?.data.some((v) => v.rollbackRequest));

  return (
    <Drawer open={open} onClose={onClose} width={480} title="Version history">
      {query.isLoading ? <Skeleton active paragraph={{ rows: 6 }} /> : null}
      {query.error ? <ErrorState error={query.error} onRetry={query.refetch} /> : null}

      {query.data ? (
        <List
          dataSource={query.data.data}
          renderItem={(v) => (
            <List.Item
              actions={
                v.rollbackRequest
                  ? v.rollbackRequest.requestedBy === userId
                    ? [<Button key="withdraw" size="small" loading={decide.isPending} onClick={() => decide.mutate({ versionId: v.id, decision: 'reject' })}>Withdraw request</Button>]
                    : [
                        <Button key="approve" size="small" type="primary" loading={decide.isPending} onClick={() => decide.mutate({ versionId: v.id, decision: 'approve' })}>Approve</Button>,
                        <Button key="reject" size="small" danger loading={decide.isPending} onClick={() => decide.mutate({ versionId: v.id, decision: 'reject' })}>Reject</Button>,
                      ]
                  : v.status === 'ARCHIVED' && !hasPending
                    ? [<Button key="rb" size="small" onClick={() => setRollingBack(v)}>Roll back to this</Button>]
                    : []
              }
            >
              <Flex vertical gap={2}>
                <Flex gap={6} align="center">
                  <StatusTag domain="homeLayoutVersion" code={v.status} showIcon={false} />
                  <Typography.Text style={{ fontSize: 12 }}>{v.sections.length} sections</Typography.Text>
                </Flex>
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                  {v.publishedAt ? <>Published <DateText value={v.publishedAt} variant="datetime" /> by {v.publishedByName}</>
                    : <>Created <DateText value={v.createdAt} variant="datetime" /> by {v.createdByName}</>}
                </Typography.Text>
                {v.note && <Tag style={{ marginInlineEnd: 0, width: 'fit-content' }}>{v.note}</Tag>}
                {v.rollbackRequest && (
                  <Typography.Text type="warning" style={{ fontSize: 11 }}>
                    Rollback requested by {v.rollbackRequest.requestedByName}: {v.rollbackRequest.reason}
                  </Typography.Text>
                )}
              </Flex>
            </List.Item>
          )}
        />
      ) : null}

      <ConfirmActionModal
        open={Boolean(rollingBack)}
        onCancel={() => setRollingBack(null)}
        onConfirm={(values) => rollback.mutate({ versionId: rollingBack.id, reason: values.reason })}
        loading={rollback.isPending}
        needsApproval
        danger
        title="Roll back the home layout"
        description={rollingBack ? `Version with ${rollingBack.sections.length} sections` : ''}
        impact="Every customer sees this version the moment a second approver agrees. The currently published version is kept in history."
        reasonRequired
        reasonLabel="Why is this being rolled back?"
        showNote={false}
        confirmLabel="Request rollback"
      />
    </Drawer>
  );
}
