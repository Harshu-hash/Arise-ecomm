import { App, Alert, Avatar, Button, Card, Flex, Input, List, Space, Typography } from 'antd';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { avatarColor } from '@core/utils/misc';
import DateText from '@ui/components/DateText';
import ErrorState from '@ui/components/ErrorState';
import FullPageSpinner from '@ui/components/FullPageSpinner';
import PageHeader from '@ui/components/PageHeader';
import StatusTag from '@ui/components/StatusTag';
import { supportApi, supportKeys } from '../api/support.api';

export default function TicketDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [text, setText] = useState('');

  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: supportKeys.detail(id), queryFn: () => supportApi.detail(id) });
  const invalidate = () => { queryClient.invalidateQueries({ queryKey: supportKeys.detail(id) }); queryClient.invalidateQueries({ queryKey: ['seller', 'support', 'tickets'] }); };

  const replyMut = useMutation({
    mutationFn: () => supportApi.reply(id, text),
    onSuccess: () => { setText(''); invalidate(); },
    onError: (e) => message.error(e?.message ?? 'Could not send your reply.'),
  });
  const closeMut = useMutation({
    mutationFn: () => supportApi.close(id),
    onSuccess: () => { message.success('Ticket closed.'); invalidate(); },
    onError: (e) => message.error(e?.message ?? 'Could not close the ticket.'),
  });

  if (isLoading) return <FullPageSpinner label="Loading ticket…" />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;

  const closable = ['OPEN', 'PENDING_CUSTOMER', 'PENDING_INTERNAL', 'RESOLVED'].includes(data.status);

  return (
    <Flex vertical gap={16}>
      <PageHeader
        title={data.subject}
        breadcrumbs={[{ label: 'Support', to: '/support' }, { label: data.id }]}
        onBack={() => navigate('/support')}
        tags={<StatusTag domain="ticket" code={data.status} />}
        actions={closable && <Button onClick={() => closeMut.mutate()} loading={closeMut.isPending}>Close ticket</Button>}
      />

      {data.status === 'RESOLVED' && <Alert type="success" showIcon message="Marked resolved" description="Reply if you still need help, or close it." />}

      <Card>
        <List
          dataSource={data.events}
          renderItem={(e) => (
            <List.Item>
              <List.Item.Meta
                avatar={<Avatar style={{ backgroundColor: avatarColor(e.authorName) }}>{e.authorName?.[0]}</Avatar>}
                title={<Space><Typography.Text strong>{e.authorName}</Typography.Text><Typography.Text type="secondary" style={{ fontSize: 12 }}><DateText value={e.createdAt} withTime /></Typography.Text></Space>}
                description={e.type === 'STATUS_CHANGE' ? <Typography.Text type="secondary" italic>{e.body}</Typography.Text> : e.body}
              />
            </List.Item>
          )}
        />

        {data.status !== 'CLOSED' && (
          <Space.Compact style={{ width: '100%', marginTop: 12 }}>
            <Input.TextArea rows={2} placeholder="Write a reply…" value={text} onChange={(e) => setText(e.target.value)} onPressEnter={(e) => { if (e.ctrlKey) replyMut.mutate(); }} />
            <Button type="primary" loading={replyMut.isPending} disabled={!text.trim()} onClick={() => replyMut.mutate()} style={{ height: 'auto' }}>Send</Button>
          </Space.Compact>
        )}
      </Card>
    </Flex>
  );
}
