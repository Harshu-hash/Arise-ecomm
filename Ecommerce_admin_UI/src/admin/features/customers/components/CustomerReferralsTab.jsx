import { Alert, Descriptions, Flex, Table, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@core/api/axiosInstance';
import DateText from '@ui/components/DateText';
import ErrorState from '@ui/components/ErrorState';
import MoneyText from '@ui/components/MoneyText';

const STATUS = { PENDING: ['default', 'Waiting for first order'], QUALIFIED: ['gold', 'Needs approval'], REWARDED: ['green', 'Rewarded'], REJECTED: ['red', 'Rejected'] };
const FLAGS = { SAME_DEVICE: 'Same phone', SAME_ADDRESS: 'Same address' };

const Status = ({ row }) => (
  <Flex gap={4} wrap>
    <Tag color={STATUS[row.status][0]} style={{ marginInlineEnd: 0 }}>{STATUS[row.status][1]}</Tag>
    {row.flags.map((f) => <Tag key={f} color="volcano" style={{ marginInlineEnd: 0 }}>{FLAGS[f] ?? f}</Tag>)}
  </Flex>
);

/** Who invited this customer, and everyone they invited, with the fraud signals seen when each one qualified. */
export default function CustomerReferralsTab({ customerId }) {
  const query = useQuery({ queryKey: ['customers', 'referrals', customerId], queryFn: () => api.get(`/referrals/customer/${customerId}`) });
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />;
  const data = query.data?.data;
  const flagged = data?.invited.filter((r) => r.flags.length) ?? [];

  return (
    <Flex vertical gap={12}>
      {flagged.length > 0 && <Alert type="warning" showIcon message={`${flagged.length} invite${flagged.length > 1 ? 's' : ''} shared a phone or address with this customer. Check them before approving rewards.`} />}
      <Descriptions size="small" bordered column={{ xs: 1, md: 2 }}>
        <Descriptions.Item label="Invite code">{data?.code ?? <Typography.Text type="secondary">Not created yet</Typography.Text>}</Descriptions.Item>
        <Descriptions.Item label="Earned from invites"><MoneyText paise={data?.earnedPaise ?? 0} /></Descriptions.Item>
        <Descriptions.Item label="Invited by" span={2}>
          {data?.referredBy
            ? <Flex gap={8} align="center"><Link to={`/customers/${data.referredBy.customerId}`}>{data.referredBy.name}</Link><Status row={data.referredBy} /></Flex>
            : <Typography.Text type="secondary">Signed up without an invite</Typography.Text>}
        </Descriptions.Item>
      </Descriptions>
      <Table
        size="small"
        rowKey="id"
        loading={query.isLoading}
        dataSource={data?.invited ?? []}
        pagination={false}
        locale={{ emptyText: 'This customer has not invited anyone' }}
        columns={[
          { title: 'Invited friend', dataIndex: 'name', render: (v, row) => <Link to={`/customers/${row.customerId}`}>{v}</Link> },
          { title: 'Status', render: (_, row) => <Status row={row} /> },
          { title: 'Reward', align: 'right', render: (_, row) => (row.status === 'REWARDED' ? <MoneyText paise={row.referrerRewardPaise} /> : '—') },
          { title: 'Invited', dataIndex: 'createdAt', render: (v) => <DateText value={v} /> },
        ]}
      />
    </Flex>
  );
}
