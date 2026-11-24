import { MailOutlined, PhoneOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Flex, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '@ui/components/PageHeader';
import { supportApi, supportKeys } from '../api/support.api';

const ICONS = { PHONE: <PhoneOutlined />, EMAIL: <MailOutlined /> };

/** Seller support is by phone and email; the contact details and hours come from the platform Settings an admin maintains. */
export default function SupportPage() {
  const query = useQuery({ queryKey: supportKeys.channels, queryFn: supportApi.channels });
  const { availabilityLabel, channels = [] } = query.data ?? {};

  return (
    <Flex vertical gap={12}>
      <PageHeader title="Help & Support" breadcrumbs={[{ label: 'Support' }]} subtitle="Reach the Arise seller support team." />
      {query.isError && <Alert type="error" showIcon message="Could not load the support contacts." description={query.error?.message} />}
      {availabilityLabel && <Typography.Text type="secondary">{availabilityLabel}</Typography.Text>}
      <Flex gap={12} wrap>
        {channels.map((channel) => (
          <Card key={channel.id} size="small" loading={query.isLoading} style={{ minWidth: 260 }} title={channel.label}>
            <Flex vertical gap={8} align="start">
              <Typography.Text>{channel.description}</Typography.Text>
              <Button type="primary" icon={ICONS[channel.type]} href={channel.href}>{channel.label}</Button>
            </Flex>
          </Card>
        ))}
      </Flex>
    </Flex>
  );
}
