import { Button, Card, Col, Flex, Row, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import PageHeader from '@ui/components/PageHeader';
import { securityApi, securityKeys } from '../api/security.api';

export default function IntegrationsPage() {
  const query = useQuery({ queryKey: securityKeys.integrations, queryFn: securityApi.integrations });
  return <Flex vertical gap={16}><PageHeader title="Integrations" breadcrumbs={[{ label: 'Settings' }, { label: 'Integrations' }]} subtitle="Connect an ERP or WMS using scoped credentials and signed webhooks." /><Row gutter={[16, 16]}>{(query.data ?? []).map((item) => <Col xs={24} md={12} key={item.key}><Card title={item.name} extra={<Tag color={item.status === 'CONNECTED' ? 'green' : 'default'}>{item.status}</Tag>}><Typography.Paragraph type="secondary">Use a least-privilege API key for outbound access and webhooks for durable event delivery.</Typography.Paragraph><Flex gap={8}><Button><Link to="/settings/api-keys">Manage API keys</Link></Button><Button><Link to="/settings/webhooks">Manage webhooks</Link></Button></Flex></Card></Col>)}</Row></Flex>;
}
