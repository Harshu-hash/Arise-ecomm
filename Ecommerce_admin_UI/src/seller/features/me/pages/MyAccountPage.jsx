import { KeyOutlined } from '@ant-design/icons';
import { Button, Card, Descriptions, Flex, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useCurrentUser } from '@core/rbac/useCan';
import PageHeader from '@ui/components/PageHeader';

/** A read-only account summary for S1; full settings land in Phase S8. */
export default function MyAccountPage() {
  const user = useCurrentUser();
  const navigate = useNavigate();

  return (
    <Flex vertical gap={16}>
      <PageHeader
        title="My account"
        subtitle="Your seller profile and sign-in."
        actions={
          <Button icon={<KeyOutlined />} onClick={() => navigate('/change-password')}>
            Change password
          </Button>
        }
      />
      <Card>
        <Descriptions column={{ xs: 1, sm: 2 }} bordered size="middle">
          <Descriptions.Item label="Name">{user?.name}</Descriptions.Item>
          <Descriptions.Item label="Email">{user?.email}</Descriptions.Item>
          <Descriptions.Item label="Phone">{user?.phone ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Store">{user?.storeName}</Descriptions.Item>
          <Descriptions.Item label="Role">{user?.roleName}</Descriptions.Item>
          <Descriptions.Item label="Account status">
            <Tag color={user?.onboardingComplete ? 'green' : 'gold'}>{user?.accountStatus}</Tag>
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </Flex>
  );
}
