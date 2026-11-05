import { CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { Alert, App, Button, Card, Col, Flex, Result, Row, Space, Tag, Typography } from 'antd';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authApi } from '@core/auth/authApi';
import { useSessionStore } from '@core/auth/sessionStore';
import AuditTimeline from '@ui/components/AuditTimeline';
import DocumentUpload from '@ui/components/DocumentUpload';
import ErrorState from '@ui/components/ErrorState';
import FullPageSpinner from '@ui/components/FullPageSpinner';
import SlaCountdown from '@ui/components/SlaCountdown';
import { onboardingApi, onboardingKeys } from '../api/onboarding.api';

const STATE_META = {
  DRAFT: ['default', 'Draft'], SUBMITTED: ['blue', 'Submitted'], UNDER_REVIEW: ['gold', 'Under review'],
  CLARIFICATION_REQUIRED: ['red', 'Clarification required'], REJECTED: ['red', 'Rejected'], APPROVED: ['green', 'Approved'],
};

export default function OnboardingStatusPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const client = useQueryClient();
  const patchUser = useSessionStore((state) => state.patchUser);
  const [replacements, setReplacements] = useState({});
  const query = useQuery({ queryKey: onboardingKeys.status, queryFn: onboardingApi.status, refetchInterval: 5000 });
  const mutation = useMutation({
    mutationFn: ({ sectionKey, documents }) => onboardingApi.resubmitSection(sectionKey, { documents }),
    onSuccess: () => { message.success('Corrected section resubmitted.'); setReplacements({}); client.invalidateQueries({ queryKey: onboardingKeys.status }); },
    onError: (error) => message.error(error?.message ?? 'Could not resubmit this section.'),
  });

  if (query.isLoading) return <FullPageSpinner label="Loading application status…" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />;
  const data = query.data;
  const enterPanel = async () => { const me = await authApi.me(); patchUser(me); navigate('/', { replace: true }); };

  if (data.status === 'APPROVED') return <div style={{ maxWidth: 720, margin: '40px auto' }}><Result status="success" title="Your seller account is approved" subTitle="Your verified application is now connected to the active seller panel." extra={<Button type="primary" onClick={enterPanel}>Enter seller panel</Button>} /></div>;

  return (
    <Flex vertical gap={16} style={{ maxWidth: 1000, margin: '24px auto', padding: '0 16px' }}>
      <Flex justify="space-between" align="start" wrap gap={12}><div><Typography.Title level={3} style={{ marginBottom: 4 }}>Application status</Typography.Title><Typography.Text type="secondary">Application {data.id} · submitted sections are read-only unless a reviewer requests a correction.</Typography.Text></div>{data.slaDueAt && <Card size="small"><Space><ClockCircleOutlined /><span>Review SLA</span><SlaCountdown dueAt={data.slaDueAt} /></Space></Card>}</Flex>
      {data.status === 'CLARIFICATION_REQUIRED' && <Alert type="warning" showIcon message="Action required" description="Only the marked sections are editable. Replace the affected evidence and resubmit that section; approved work stays unchanged." />}
      <Row gutter={[12, 12]}>{data.sections.map((section) => <Col xs={24} md={12} key={section.id}><SectionCard section={section} documents={data.documents.filter((document) => document.sectionKey === section.key)} replacements={replacements} setReplacements={setReplacements} submitting={mutation.isPending} onResubmit={() => mutation.mutate({ sectionKey: section.key, documents: replacements[section.key] ?? {} })} /></Col>)}</Row>
      <Card title="Application timeline"><AuditTimeline events={data.events} emptyText="Your application has not been submitted yet." /></Card>
    </Flex>
  );
}

function SectionCard({ section, documents, replacements, setReplacements, submitting, onResubmit }) {
  const [color, label] = STATE_META[section.state] ?? STATE_META.DRAFT;
  const corrective = ['CLARIFICATION_REQUIRED', 'REJECTED'].includes(section.state);
  const rejectedDocuments = documents.filter((document) => document.status === 'REJECTED');
  const replacementMap = replacements[section.key] ?? {};
  const setReplacement = (type, items) => setReplacements((current) => ({ ...current, [section.key]: { ...(current[section.key] ?? {}), [type]: items?.[0] ?? null } }));
  return <Card size="small" title={<Space>{section.state === 'APPROVED' ? <CheckCircleOutlined style={{ color: 'var(--ant-color-success)' }} /> : corrective ? <ExclamationCircleOutlined style={{ color: 'var(--ant-color-error)' }} /> : <ClockCircleOutlined />}<span>{section.label}</span></Space>} extra={<Tag color={color}>{label}</Tag>} style={{ height: '100%' }}>
    {section.adminReason && <Alert type="error" showIcon message={section.adminReason} description={section.correctiveAction} style={{ marginBottom: 12 }} />}
    {documents.map((document) => <Flex key={document.id} justify="space-between" gap={8} style={{ marginBottom: 8 }}><Typography.Text>{document.label} · v{document.version}</Typography.Text><Tag color={document.status === 'APPROVED' ? 'green' : document.status === 'REJECTED' ? 'red' : 'gold'}>{document.status}</Tag></Flex>)}
    {corrective && (rejectedDocuments.length ? rejectedDocuments : documents).map((document) => <div key={document.id} style={{ marginTop: 12 }}><Typography.Text strong>Replace {document.label}</Typography.Text><DocumentUpload value={replacementMap[document.type] ? [replacementMap[document.type]] : []} onChange={(items) => setReplacement(document.type, items)} maxCount={1} label={document.label} /></div>)}
    {corrective && <Button type="primary" style={{ marginTop: 12 }} disabled={!Object.values(replacementMap).some(Boolean)} loading={submitting} onClick={onResubmit}>Resubmit this section</Button>}
  </Card>;
}
