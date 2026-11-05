import { App, Alert, Avatar, Button, Card, Collapse, Flex, Input, List, Modal, Space, Tag, Typography } from 'antd';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { avatarColor } from '@core/utils/misc';
import DateText from '@ui/components/DateText';
import ErrorState from '@ui/components/ErrorState';
import FullPageSpinner from '@ui/components/FullPageSpinner';
import PageHeader from '@ui/components/PageHeader';
import AttachmentList from '@ui/components/AttachmentList';
import DocumentUpload from '@ui/components/DocumentUpload';
import SlaCountdown from '@ui/components/SlaCountdown';
import StatusTag from '@ui/components/StatusTag';
import { supportApi, supportKeys } from '../api/support.api';

export default function TicketDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [reopening, setReopening] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: supportKeys.detail(id), queryFn: () => supportApi.detail(id) });
  const invalidate = () => { queryClient.invalidateQueries({ queryKey: supportKeys.detail(id) }); queryClient.invalidateQueries({ queryKey: ['seller', 'support', 'tickets'] }); };

  const replyMut = useMutation({
    mutationFn: () => supportApi.reply(id, text, attachments.map((item) => item.mediaId)),
    onSuccess: () => { setText(''); setAttachments([]); invalidate(); },
    onError: (e) => message.error(e?.message ?? 'Could not send your reply.'),
  });
  const closeMut = useMutation({
    mutationFn: () => supportApi.close(id),
    onSuccess: () => { message.success('Ticket closed.'); invalidate(); },
    onError: (e) => message.error(e?.message ?? 'Could not close the ticket.'),
  });
  const reopenMut = useMutation({ mutationFn: () => supportApi.reopen(id, text, attachments.map((item) => item.mediaId)), onSuccess: () => { message.success('Ticket reopened.'); setReopening(false); setText(''); setAttachments([]); invalidate(); }, onError: (e) => message.error(e?.message) });
  const callbackMut = useMutation({ mutationFn: () => supportApi.callback(id), onSuccess: () => { message.success('Callback requested.'); invalidate(); }, onError: (e) => message.error(e?.message) });

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
        actions={<Space>{['RESOLVED', 'CLOSED'].includes(data.status) ? <Button type="primary" onClick={() => setReopening(true)}>Reopen</Button> : <><Button onClick={() => callbackMut.mutate()} loading={callbackMut.isPending} disabled={Boolean(data.callbackRequestedAt)}>Request callback</Button>{closable && <Button onClick={() => closeMut.mutate()} loading={closeMut.isPending}>Close ticket</Button>}</>}</Space>}
      />

      {data.status === 'RESOLVED' && <Alert type="success" showIcon message="Marked resolved" description="Reply if you still need help, or close it." />}
      {data.escalationStatus !== 'NONE' && <Alert type="info" showIcon message={`Escalation status: ${data.escalationStatus.replaceAll('_', ' ')}`} />}
      <Card size="small"><Space wrap><Tag>{data.contextType ?? 'GENERAL'} {data.contextId}</Tag><span>First response <SlaCountdown dueAt={data.firstResponseDueAt} compact /></span><span>Resolution <SlaCountdown dueAt={data.resolutionDueAt} compact /></span></Space></Card>

      <Card>
        <List
          dataSource={data.events}
          renderItem={(e) => (
            <List.Item>
              <List.Item.Meta
                avatar={<Avatar style={{ backgroundColor: avatarColor(e.authorName) }}>{e.authorName?.[0]}</Avatar>}
                title={<Space><Typography.Text strong>{e.authorName}</Typography.Text><Typography.Text type="secondary" style={{ fontSize: 12 }}><DateText value={e.createdAt} withTime /></Typography.Text></Space>}
                description={<><div>{e.type === 'STATUS_CHANGE' ? <Typography.Text type="secondary" italic>{e.body}</Typography.Text> : e.body}</div>{e.attachments?.length > 0 && <AttachmentList attachments={e.attachments} />}</>}
              />
            </List.Item>
          )}
        />

        {data.status !== 'CLOSED' && (
          <><DocumentUpload value={attachments} onChange={setAttachments} maxCount={5} label="Reply attachments" /><Space.Compact style={{ width: '100%', marginTop: 12 }}>
            <Input.TextArea rows={2} placeholder="Write a reply…" value={text} onChange={(e) => setText(e.target.value)} onPressEnter={(e) => { if (e.ctrlKey) replyMut.mutate(); }} />
            <Button type="primary" loading={replyMut.isPending} disabled={!text.trim()} onClick={() => replyMut.mutate()} style={{ height: 'auto' }}>Send</Button>
          </Space.Compact></>
        )}
      </Card>
      {data.suggestedArticles?.length > 0 && <Card title="Suggested help articles" size="small"><Collapse items={data.suggestedArticles.map((article) => ({ key: article.id, label: article.question, children: article.answer }))} /></Card>}
      <Modal title="Reopen this ticket" open={reopening} onCancel={() => setReopening(false)} onOk={() => reopenMut.mutate()} confirmLoading={reopenMut.isPending} okButtonProps={{ disabled: !text.trim() }}><Input.TextArea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Explain what remains unresolved" /><div style={{ marginTop: 12 }}><DocumentUpload value={attachments} onChange={setAttachments} maxCount={5} label="Reopen evidence" /></div></Modal>
    </Flex>
  );
}
