import { App, Badge, Button, Card, Empty, Flex, Input, Segmented, Select, Tag, Typography } from 'antd';
import { PictureOutlined } from '@ant-design/icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { queryClient } from '@core/api/queryClient';
import DateText from '@ui/components/DateText';
import PageHeader from '@ui/components/PageHeader';
import useRealtime from '@ui/hooks/useRealtime';
import { chatApi, chatKeys } from '../api/chat.api';

const FALLBACK_POLL_MS = 30_000; // the socket hint is the fast path; this only covers a missed one
const TYPING_SHOW_MS = 4000;
const TYPING_SEND_MS = 2000;
const MAX_PHOTOS = 3;

/** Live chat inbox: customers' chats on the left, the selected conversation on the right. Needs support.chat.handle. */
export default function LiveChatPage() {
  const { message } = App.useApp();
  const [status, setStatus] = useState('OPEN');
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState('');
  const [photos, setPhotos] = useState([]); // { name, key } once uploaded
  const [uploading, setUploading] = useState(false);
  const [transferTo, setTransferTo] = useState(null);
  const [customerTyping, setCustomerTyping] = useState(null); // customerId currently typing
  const endRef = useRef(null);
  const fileRef = useRef(null);
  const typingTimer = useRef(null);
  const lastTypingSent = useRef(0);

  const refresh = () => queryClient.invalidateQueries({ queryKey: chatKeys.all });
  const socketRef = useRealtime('admin', {
    'chat:changed': refresh,
    'session:ready': refresh,
    'chat:typing': ({ customerId }) => {
      setCustomerTyping(customerId);
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setCustomerTyping(null), TYPING_SHOW_MS);
    },
  });
  useEffect(() => () => clearTimeout(typingTimer.current), []);

  const list = useQuery({ queryKey: chatKeys.list(status), queryFn: () => chatApi.list(status), refetchInterval: FALLBACK_POLL_MS });
  const chats = list.data?.data ?? [];
  const detail = useQuery({
    queryKey: chatKeys.detail(selectedId),
    queryFn: () => chatApi.get(selectedId),
    enabled: Boolean(selectedId),
    refetchInterval: FALLBACK_POLL_MS,
  });
  const chat = detail.data?.data;
  const agents = useQuery({ queryKey: chatKeys.agents, queryFn: () => chatApi.agents(), staleTime: 5 * 60_000 });

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chat?.messages?.length]);

  // an agent looking at the chat is what clears its unread badge
  const unread = chat?.unreadCount ?? 0;
  useEffect(() => {
    if (selectedId && unread > 0) chatApi.markRead(selectedId).then(refresh).catch(() => undefined);
  }, [selectedId, unread]);

  const reply = useMutation({
    mutationFn: () => chatApi.reply(selectedId, { body: draft.trim(), attachments: photos.map((photo) => photo.key) }),
    onSuccess: () => { setDraft(''); setPhotos([]); refresh(); },
    onError: (e) => { message.error(e.message); refresh(); }, // a closed chat is refetched so the composer disappears
  });
  const close = useMutation({
    mutationFn: () => chatApi.close(selectedId),
    onSuccess: () => { refresh(); message.success('Chat ended'); },
    onError: (e) => message.error(e.message),
  });
  const transfer = useMutation({
    mutationFn: () => chatApi.transfer(selectedId, transferTo),
    onSuccess: () => { setTransferTo(null); refresh(); message.success('Chat transferred'); },
    onError: (e) => message.error(e.message),
  });

  const pickPhotos = async (event) => {
    const files = [...event.target.files].slice(0, MAX_PHOTOS - photos.length);
    event.target.value = '';
    setUploading(true);
    try {
      const added = [];
      for (const file of files) added.push({ name: file.name, key: await chatApi.uploadPhoto(file) });
      setPhotos((current) => [...current, ...added]);
    } catch (error) {
      message.error(error.message || 'Could not upload that photo.');
    } finally {
      setUploading(false);
    }
  };

  const onDraft = (text) => {
    setDraft(text);
    if (text && chat && Date.now() - lastTypingSent.current > TYPING_SEND_MS) {
      lastTypingSent.current = Date.now();
      socketRef.current?.emit('chat:typing', { customerId: chat.customerId });
    }
  };
  const canSend = (draft.trim() || photos.length) && !uploading && !reply.isPending;
  const send = () => canSend && reply.mutate();

  return (
    <Flex vertical gap={12}>
      <PageHeader
        title="Live chat"
        breadcrumbs={[{ label: 'Support' }, { label: 'Live chat' }]}
        subtitle="Customers message from the app at any time; replies reach them instantly and as a push notification."
      />
      <Flex gap={12} align="stretch" wrap>
        <Card size="small" style={{ flex: '1 1 280px', maxWidth: 380 }} title={<Segmented value={status} onChange={(v) => { setStatus(v); setSelectedId(null); }} options={[{ label: 'Open', value: 'OPEN' }, { label: 'Ended', value: 'CLOSED' }]} />}>
          {chats.length === 0 && <Empty description={list.isLoading ? 'Loading...' : 'No chats'} image={Empty.PRESENTED_IMAGE_SIMPLE} />}
          <Flex vertical gap={4}>
            {chats.map((c) => (
              <Button key={c.id} type={c.id === selectedId ? 'primary' : 'text'} onClick={() => setSelectedId(c.id)} style={{ height: 'auto', textAlign: 'left', padding: '8px 10px' }}>
                <Flex vertical style={{ width: '100%', minWidth: 0 }}>
                  <Flex justify="space-between" gap={8} align="center">
                    <Typography.Text strong ellipsis style={{ color: 'inherit' }}>{c.customerName}</Typography.Text>
                    {c.unreadCount > 0 && <Badge count={c.unreadCount} />}
                    {c.waitingForAgent && c.unreadCount === 0 && <Badge status="warning" text="Waiting" />}
                  </Flex>
                  <Typography.Text ellipsis style={{ color: 'inherit', opacity: 0.75, fontSize: 12 }}>{c.lastMessagePreview}</Typography.Text>
                  <Typography.Text ellipsis style={{ color: 'inherit', opacity: 0.6, fontSize: 11 }}>{c.agentName ? `With ${c.agentName}` : 'Unclaimed'}</Typography.Text>
                </Flex>
              </Button>
            ))}
          </Flex>
        </Card>

        <Card
          size="small"
          style={{ flex: '2 1 380px' }}
          title={chat ? <Flex gap={8} align="center" wrap><span>{chat.customerName}{chat.orderId ? ` · order ${chat.orderId}` : ''}</span><Tag style={{ marginInlineEnd: 0 }}>{chat.agentName ? `With ${chat.agentName}` : 'Unclaimed'}</Tag></Flex> : 'Conversation'}
          extra={chat?.status === 'OPEN' && (
            <Flex gap={8} wrap>
              <Select
                size="small"
                style={{ width: 160 }}
                placeholder="Transfer to..."
                value={transferTo}
                onChange={setTransferTo}
                options={(agents.data?.data ?? []).filter((agent) => agent.id !== chat.agentId).map((agent) => ({ value: agent.id, label: agent.name }))}
              />
              <Button size="small" disabled={!transferTo} loading={transfer.isPending} onClick={() => transfer.mutate()}>Transfer</Button>
              <Button danger size="small" loading={close.isPending} onClick={() => close.mutate()}>End chat</Button>
            </Flex>
          )}
        >
          {!chat && <Empty description="Select a chat" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
          {chat && (
            <Flex vertical gap={8}>
              <Flex vertical gap={6} style={{ height: 380, overflowY: 'auto' }}>
                {chat.messages.map((m) => {
                  if (m.authorType === 'SYSTEM') return <Typography.Text key={m.id} type="secondary" style={{ textAlign: 'center', fontSize: 12 }}>{m.body}</Typography.Text>;
                  const agent = m.authorType === 'AGENT';
                  return (
                    <Flex key={m.id} justify={agent ? 'flex-end' : 'flex-start'}>
                      <div style={{ maxWidth: '80%', padding: '6px 10px', borderRadius: 10, background: agent ? 'var(--ant-color-primary)' : 'var(--ant-color-fill-secondary)', color: agent ? '#fff' : 'inherit' }}>
                        {m.attachments.map((photo) => (
                          <a key={photo.id} href={photo.url} target="_blank" rel="noreferrer">
                            <img src={photo.url} alt="Attachment" style={{ display: 'block', maxWidth: 200, maxHeight: 200, borderRadius: 6, marginBottom: 4 }} />
                          </a>
                        ))}
                        {m.body && <div style={{ whiteSpace: 'pre-wrap' }}>{m.body}</div>}
                        <div style={{ fontSize: 10, opacity: 0.7 }}><DateText value={m.createdAt} variant="datetime" /></div>
                      </div>
                    </Flex>
                  );
                })}
                {customerTyping === chat.customerId && <Typography.Text type="secondary" italic style={{ fontSize: 12 }}>{chat.customerName} is typing...</Typography.Text>}
                <div ref={endRef} />
              </Flex>
              {chat.status === 'OPEN' ? (
                <Flex vertical gap={6}>
                  {photos.length > 0 && (
                    <Flex gap={6} wrap>
                      {photos.map((photo) => <Tag key={photo.key} closable onClose={() => setPhotos((current) => current.filter((item) => item.key !== photo.key))}>{photo.name}</Tag>)}
                    </Flex>
                  )}
                  <Flex gap={8} align="end">
                    <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={pickPhotos} />
                    <Button icon={<PictureOutlined />} aria-label="Attach photo" loading={uploading} disabled={photos.length >= MAX_PHOTOS} onClick={() => fileRef.current?.click()} />
                    <Input.TextArea
                      value={draft}
                      onChange={(e) => onDraft(e.target.value)}
                      autoSize={{ minRows: 1, maxRows: 4 }}
                      maxLength={2000}
                      placeholder="Reply as Arise Support"
                      onPressEnter={(e) => { if (!e.shiftKey) { e.preventDefault(); send(); } }}
                    />
                    <Button type="primary" disabled={!canSend} loading={reply.isPending} onClick={send}>Send</Button>
                  </Flex>
                </Flex>
              ) : <Typography.Text type="secondary">This chat has ended.</Typography.Text>}
            </Flex>
          )}
        </Card>
      </Flex>
    </Flex>
  );
}
