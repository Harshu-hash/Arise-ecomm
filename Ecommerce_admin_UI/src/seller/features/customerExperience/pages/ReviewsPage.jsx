import { Alert, App, Button, Card, Drawer, Flex, Input, Modal, Rate, Space, Tag, Typography } from 'antd';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import DataTable from '@ui/components/DataTable/DataTable';
import DateText from '@ui/components/DateText';
import DocumentUpload from '@ui/components/DocumentUpload';
import PageHeader from '@ui/components/PageHeader';
import useListQuery from '@ui/hooks/useListQuery';
import useUrlTableState from '@ui/hooks/useUrlTableState';
import { customerExperienceApi, customerExperienceKeys } from '../api/customerExperience.api';

export default function ReviewsPage() {
  const { message } = App.useApp(); const queryClient = useQueryClient();
  const state = useUrlTableState({ defaultSort: '-submittedAt' });
  const [row, setRow] = useState(null); const [mode, setMode] = useState(null); const [text, setText] = useState(''); const [evidence, setEvidence] = useState([]);
  const { rows, meta, loading, fetching, error, refetch } = useListQuery({ queryKey: customerExperienceKeys.reviews(state.queryParams), url: '/customer-experience/reviews', params: state.queryParams });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['seller', 'customer-experience', 'reviews'] });
  const reply = useMutation({ mutationFn: () => customerExperienceApi.replyReview(row.id, text), onSuccess: () => { message.success('Reply submitted for moderation.'); setMode(null); setText(''); refresh(); }, onError: (e) => message.error(e?.message) });
  const report = useMutation({ mutationFn: () => customerExperienceApi.reportReview(row.id, { reason: text, evidenceMediaIds: evidence.map((item) => item.mediaId) }), onSuccess: () => { message.success('Report sent to the shared abuse queue.'); setMode(null); setText(''); setEvidence([]); refresh(); }, onError: (e) => message.error(e?.message) });
  const columns = [
    { key: 'productTitle', title: 'Product / SKU', dataIndex: 'productTitle', priority: 1, render: (v, r) => <div><Typography.Text strong>{v}</Typography.Text><div><Typography.Text type="secondary">{r.sku ?? r.variantLabel}</Typography.Text></div></div> },
    { key: 'rating', title: 'Rating', dataIndex: 'rating', width: 130, render: (v) => <Rate disabled value={v} style={{ fontSize: 13 }} /> },
    { key: 'certifiedBuyer', title: 'Purchase', width: 120, render: (_, r) => <Tag color={r.certifiedBuyer ? 'green' : 'default'}>{r.certifiedBuyer ? 'Verified' : 'Unverified'}</Tag> },
    { key: 'submittedAt', title: 'Submitted', dataIndex: 'submittedAt', width: 120, render: (v) => <DateText value={v} /> },
    { key: 'status', title: 'Moderation', dataIndex: 'status', width: 130, render: (v) => <Tag>{v}</Tag> },
  ];
  return <Flex vertical gap={12}><PageHeader title="Customer Reviews" breadcrumbs={[{ label: 'Customer Experience' }, { label: 'Reviews' }]} subtitle="Reply publicly without changing customer content, or report policy abuse to the same queue used by admin." />
    <Card styles={{ body: { padding: 0 } }}><DataTable tableId="seller-reviews" columns={columns} rows={rows} meta={meta} loading={loading || fetching} error={error} onRetry={refetch} tableState={state} savedViews onRowClick={setRow} emptyProps={{ title: 'No customer reviews' }} /></Card>
    <Drawer width={520} open={Boolean(row)} onClose={() => setRow(null)} title={row?.productTitle} extra={<Space><Button disabled={Boolean(row?.sellerReply && row.sellerReply.status !== 'REJECTED')} onClick={() => setMode('reply')}>Reply</Button><Button danger disabled={row?.abuseReport?.status === 'OPEN'} onClick={() => setMode('report')}>Report abuse</Button></Space>}>
      {row && <Space direction="vertical" style={{ width: '100%' }}><Rate disabled value={row.rating} /><Typography.Text type="secondary">Verified buyer · <DateText value={row.submittedAt} /></Typography.Text><Typography.Title level={5}>{row.title}</Typography.Title><Typography.Paragraph>{row.text}</Typography.Paragraph>{row.sellerReply && <Alert type="info" showIcon message={`Seller reply · ${row.sellerReply.status}`} description={row.sellerReply.text} />}{row.abuseReport && <Alert type="warning" showIcon message={`Abuse report · ${row.abuseReport.status}`} description={row.abuseReport.decisionReason ?? row.abuseReport.reason} />}</Space>}
    </Drawer>
    <Modal title={mode === 'reply' ? 'Public reply' : 'Report abusive review'} open={Boolean(mode)} onCancel={() => setMode(null)} onOk={() => mode === 'reply' ? reply.mutate() : report.mutate()} confirmLoading={reply.isPending || report.isPending} okButtonProps={{ disabled: !text.trim() }}><Alert type="info" showIcon message={mode === 'reply' ? 'Replies are public only after moderation. Customer review text is never changed.' : 'The report is sent to the admin abuse queue.'} style={{ marginBottom: 12 }} /><Input.TextArea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={mode === 'reply' ? 'Write a helpful product-focused response' : 'Describe the policy violation'} />{mode === 'report' && <div style={{ marginTop: 12 }}><DocumentUpload value={evidence} onChange={setEvidence} maxCount={3} label="Abuse evidence" /></div>}</Modal>
  </Flex>;
}
