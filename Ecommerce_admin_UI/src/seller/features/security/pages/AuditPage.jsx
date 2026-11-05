import { Card, Flex, Table, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import DateText from '@ui/components/DateText';
import ExportJobButton from '@ui/components/ExportJobButton';
import PageHeader from '@ui/components/PageHeader';
import { securityApi, securityKeys } from '../api/security.api';

export default function AuditPage() {
  const query = useQuery({ queryKey: securityKeys.audit, queryFn: securityApi.audit });
  return <Flex vertical gap={16}><PageHeader title="Activity & audit" breadcrumbs={[{ label: 'Settings' }, { label: 'Activity & audit' }]} subtitle="Seller-scoped, append-only history of sensitive commands." actions={<ExportJobButton resource="seller-audit" label="Export audit" estimatedRows={query.data?.length ?? 100} />} /><Card styles={{ body: { padding: 0 } }}><Table rowKey="id" loading={query.isLoading} dataSource={query.data ?? []} scroll={{ x: 'max-content' }} columns={[{ title: 'Time', dataIndex: 'at', render: (value) => <DateText value={value} withTime /> }, { title: 'Actor', render: (_value, row) => <div><Typography.Text>{row.actorName}</Typography.Text><div><Typography.Text type="secondary">{row.actorEmail}</Typography.Text></div></div> }, { title: 'Action', dataIndex: 'action', render: (value) => <Tag>{value}</Tag> }, { title: 'Entity', render: (_value, row) => `${row.entityType}: ${row.entityLabel}` }, { title: 'Reason', dataIndex: 'reason', render: (value) => value ?? '—' }]} /></Card></Flex>;
}
