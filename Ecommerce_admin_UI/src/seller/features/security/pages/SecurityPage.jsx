import { Button, Card, Col, Flex, List, Modal, Row, Space, Statistic, Tag, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import DateText from '@ui/components/DateText';
import ErrorState from '@ui/components/ErrorState';
import FullPageSpinner from '@ui/components/FullPageSpinner';
import PageHeader from '@ui/components/PageHeader';
import StepUpModal from '../components/StepUpModal';
import { securityApi, securityKeys } from '../api/security.api';

export default function SecurityPage() {
  const client = useQueryClient(); const [stepAction, setStepAction] = useState(null); const [secret, setSecret] = useState(null);
  const query = useQuery({ queryKey: securityKeys.overview, queryFn: securityApi.overview });
  const refresh = () => client.invalidateQueries({ queryKey: securityKeys.overview });
  const revoke = useMutation({ mutationFn: securityApi.revokeSession, onSuccess: refresh });
  if (query.isLoading) return <FullPageSpinner label="Loading security centre…" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />;
  const data = query.data;
  const verified = async (token) => { const result = stepAction === 'codes' ? await securityApi.regenerateBackupCodes(token) : stepAction === 'replace' ? await securityApi.replaceAuthenticator(token) : await securityApi.signOutAll(token); setSecret(result); refresh(); };
  return <Flex vertical gap={16}><PageHeader title="Security centre" breadcrumbs={[{ label: 'Settings' }, { label: 'Security' }]} subtitle="Two-factor authentication, recovery, sessions and recent security activity." /><Row gutter={[12, 12]}><Col xs={12} md={6}><Card><Statistic title="Two-factor authentication" value={data.twoFactorEnrolled ? 'Enabled' : 'Setup pending'} /></Card></Col><Col xs={12} md={6}><Card><Statistic title="Backup codes remaining" value={data.backupCodesRemaining} /></Card></Col><Col xs={12} md={6}><Card><Statistic title="Recovery email" value={data.recoveryEmail} valueStyle={{ fontSize: 16 }} /></Card></Col><Col xs={12} md={6}><Card><Statistic title="Password changed" valueRender={() => <DateText value={data.passwordChangedAt} />} /></Card></Col></Row><Card title="Authentication recovery" size="small"><Space wrap><Button onClick={() => setStepAction('codes')}>Regenerate backup codes</Button><Button onClick={() => setStepAction('replace')}>Replace authenticator</Button><Button danger onClick={() => setStepAction('sessions')}>Sign out all other sessions</Button></Space></Card><Card title="Active sessions" size="small"><List dataSource={data.sessions} renderItem={(session) => <List.Item actions={session.current ? [<Tag key="current" color="green">Current</Tag>] : [<Button key="revoke" danger size="small" loading={revoke.isPending} onClick={() => revoke.mutate(session.id)}>Revoke</Button>]}><List.Item.Meta title={session.device} description={`${session.city} · ${session.ip} · Last active ${session.lastActiveAt}`} /></List.Item>} /></Card><Card title="Recent security events" size="small"><List dataSource={data.events} locale={{ emptyText: 'No recent security events.' }} renderItem={(event) => <List.Item><List.Item.Meta title={event.description} description={<><DateText value={event.at} withTime /> · {event.city}</>} /></List.Item>} /></Card><StepUpModal open={Boolean(stepAction)} onCancel={() => setStepAction(null)} onVerified={verified} /><Modal title={secret?.codes ? 'Save your new backup codes' : 'Authenticator replacement'} open={Boolean(secret)} onCancel={() => setSecret(null)} footer={<Button type="primary" onClick={() => setSecret(null)}>I saved this</Button>}>{secret?.codes ? <Typography.Paragraph code copyable>{secret.codes.join('\n')}</Typography.Paragraph> : secret?.secret ? <><Typography.Paragraph>Scan the new authenticator secret and complete enrolment on your next sign-in.</Typography.Paragraph><Typography.Text code copyable>{secret.secret}</Typography.Text></> : <Typography.Text>All other sessions were signed out.</Typography.Text>}</Modal></Flex>;
}
