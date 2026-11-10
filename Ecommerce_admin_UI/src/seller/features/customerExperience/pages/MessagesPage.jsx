import { Alert, App, Avatar, Button, Card, Col, Flex, Input, List, Row, Space, Typography } from 'antd';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import DateText from '@ui/components/DateText';
import ErrorState from '@ui/components/ErrorState';
import PageHeader from '@ui/components/PageHeader';
import { customerExperienceApi, customerExperienceKeys } from '../api/customerExperience.api';

export default function MessagesPage() {
  const { message } = App.useApp(); const queryClient = useQueryClient(); const [selected, setSelected] = useState(null); const [text, setText] = useState('');
  const policy = useQuery({ queryKey: customerExperienceKeys.policy, queryFn: customerExperienceApi.messagePolicy });
  const conversations = useQuery({ queryKey: customerExperienceKeys.conversations, queryFn: customerExperienceApi.conversations });
  const detail = useQuery({ queryKey: customerExperienceKeys.conversation(selected), queryFn: () => customerExperienceApi.conversation(selected), enabled: Boolean(selected) });
  const send = useMutation({ mutationFn: () => customerExperienceApi.sendMessage(selected, text), onSuccess: () => { setText(''); queryClient.invalidateQueries({ queryKey: customerExperienceKeys.conversation(selected) }); message.success('Message sent.'); }, onError: (e) => message.error(e?.message) });
  if (policy.isError || conversations.isError) return <ErrorState error={policy.error ?? conversations.error} onRetry={() => { policy.refetch(); conversations.refetch(); }} />;
  return <Flex vertical gap={12}><PageHeader title="Buyer Messages" breadcrumbs={[{ label: 'Customer Experience' }, { label: 'Messages' }]} subtitle="Transaction-only messaging with masked buyer identity and prohibited-content controls." /><Alert type="warning" showIcon message="Keep conversations on-platform" description={`Not allowed: ${(policy.data?.prohibited ?? []).join(', ')}.`} />
    <Row gutter={[12, 12]}><Col xs={24} md={9}><Card title="Conversations" styles={{ body: { padding: 0 } }}><List loading={conversations.isLoading} dataSource={conversations.data ?? []} locale={{ emptyText: 'No buyer conversations' }} renderItem={(item) => <List.Item style={{ cursor: 'pointer', padding: 12, background: selected === item.id ? 'var(--ant-color-fill-secondary)' : undefined }} onClick={() => setSelected(item.id)}><List.Item.Meta title={item.customerMaskedName} description={<><div>{item.productTitle}</div><DateText value={item.lastMessageAt} withTime /></>} /></List.Item>} /></Card></Col><Col xs={24} md={15}><Card title={detail.data?.customerMaskedName ?? 'Select a conversation'} loading={detail.isLoading}><List dataSource={detail.data?.messages ?? []} renderItem={(item) => <List.Item><List.Item.Meta avatar={<Avatar>{item.authorType[0]}</Avatar>} title={<Space>{item.authorType === 'CUSTOMER' ? 'Buyer' : item.authorName}<Typography.Text type="secondary"><DateText value={item.createdAt} withTime /></Typography.Text></Space>} description={item.body} /></List.Item>} />{selected && <Space.Compact style={{ width: '100%', marginTop: 12 }}><Input.TextArea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Reply about this transaction" /><Button type="primary" style={{ height: 'auto' }} disabled={!text.trim()} loading={send.isPending} onClick={() => send.mutate()}>Send</Button></Space.Compact>}</Card></Col></Row>
  </Flex>;
}
