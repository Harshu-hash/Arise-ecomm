import { Alert, App, Button, Card, Drawer, Flex, Input, List, Space, Tag, Typography } from 'antd';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import DataTable from '@ui/components/DataTable/DataTable';
import DateText from '@ui/components/DateText';
import PageHeader from '@ui/components/PageHeader';
import SlaCountdown from '@ui/components/SlaCountdown';
import useListQuery from '@ui/hooks/useListQuery';
import useUrlTableState from '@ui/hooks/useUrlTableState';
import { customerExperienceApi, customerExperienceKeys } from '../api/customerExperience.api';

export default function QuestionsPage() {
  const { message } = App.useApp(); const queryClient = useQueryClient(); const state = useUrlTableState({ defaultSort: '-askedAt' });
  const [row, setRow] = useState(null); const [text, setText] = useState('');
  const { rows, meta, loading, fetching, error, refetch } = useListQuery({ queryKey: customerExperienceKeys.questions(state.queryParams), url: '/customer-experience/questions', params: state.queryParams });
  const answer = useMutation({ mutationFn: () => customerExperienceApi.answerQuestion(row.id, text), onSuccess: () => { message.success('Answer submitted for admin moderation.'); setText(''); queryClient.invalidateQueries({ queryKey: ['seller', 'customer-experience', 'questions'] }); setRow(null); }, onError: (e) => message.error(e?.message) });
  const columns = [{ key: 'text', title: 'Question', dataIndex: 'text', priority: 1, render: (v, r) => <div><Typography.Text strong>{v}</Typography.Text><div><Typography.Text type="secondary">{r.productTitle}</Typography.Text></div></div> }, { key: 'askedAt', title: 'Asked', dataIndex: 'askedAt', width: 120, render: (v) => <DateText value={v} /> }, { key: 'responseDueAt', title: 'Response SLA', width: 180, render: (v, r) => r.answers.some((a) => a.authorType === 'SELLER') ? <Tag color="green">Answered</Tag> : <SlaCountdown dueAt={v} breached={r.slaBreached} /> }, { key: 'status', title: 'Moderation', dataIndex: 'status', width: 120, render: (v) => <Tag>{v}</Tag> }];
  return <Flex vertical gap={12}><PageHeader title="Product Questions" breadcrumbs={[{ label: 'Customer Experience' }, { label: 'Questions' }]} subtitle="Answer product questions before the response SLA; answers publish only after admin moderation." /><Card styles={{ body: { padding: 0 } }}><DataTable tableId="seller-questions" columns={columns} rows={rows} meta={meta} loading={loading || fetching} error={error} onRetry={refetch} tableState={state} savedViews onRowClick={setRow} emptyProps={{ title: 'No product questions' }} /></Card>
    <Drawer width={520} open={Boolean(row)} onClose={() => setRow(null)} title={row?.productTitle}>{row && <Space direction="vertical" style={{ width: '100%' }}><Alert type={row.slaBreached ? 'error' : 'info'} showIcon message={<SlaCountdown dueAt={row.responseDueAt} breached={row.slaBreached} />} /><Typography.Title level={5}>{row.text}</Typography.Title><List header="Existing answers" dataSource={row.answers} locale={{ emptyText: 'No answers yet' }} renderItem={(item) => <List.Item><List.Item.Meta title={<Space>{item.authorName}<Tag>{item.status}</Tag></Space>} description={item.text} /></List.Item>} /><Input.TextArea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a factual answer without contact details or external links" /><Button type="primary" disabled={!text.trim()} loading={answer.isPending} onClick={() => answer.mutate()}>Submit for moderation</Button></Space>}</Drawer>
  </Flex>;
}
