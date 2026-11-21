import { KeyOutlined } from '@ant-design/icons';
import { Button, Card, Descriptions, Flex } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useCurrentUser } from '@core/auth/sessionStore';
import PageHeader from '@ui/components/PageHeader';
import ProfilePage from '@seller/features/settings/pages/ProfilePage';

/** My profile: who is signed in, followed by the store's business profile (the same, editable, page as Settings). */
export default function MyAccountPage() {
  const user = useCurrentUser();
  const navigate = useNavigate();

  return (
    <Flex vertical gap={16}>
      <PageHeader
        title="My profile"
        breadcrumbs={[{ label: 'Account' }, { label: 'My profile' }]}
        subtitle="Your details and the store you sell under."
        actions={<Button icon={<KeyOutlined />} onClick={() => navigate('/change-password')}>Change password</Button>}
      />
      <Card title="Your details">
        <Descriptions column={{ xs: 1, sm: 2 }} bordered size="middle">
          <Descriptions.Item label="Name">{user?.name ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Role">{user?.roleName ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Email">{user?.email ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Phone">{user?.phone ?? '—'}</Descriptions.Item>
        </Descriptions>
      </Card>
      <ProfilePage embedded />
    </Flex>
  );
}
