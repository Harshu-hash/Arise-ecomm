import { App, Card, Flex, Switch, Typography } from 'antd';
import { useMutation } from '@tanstack/react-query';
import { useSessionStore } from '@core/auth/sessionStore';
import PageHeader from '@ui/components/PageHeader';
import { settingsApi } from '../api/settings.api';

export default function NotificationsPage() {
  const { message } = App.useApp();
  const user = useSessionStore((s) => s.user);
  const patchUser = useSessionStore((s) => s.patchUser);

  const mut = useMutation({
    mutationFn: (payload) => settingsApi.updateNotifications(payload),
    onSuccess: (fresh) => { patchUser(fresh); message.success('Preferences saved.'); },
    onError: (e) => message.error(e?.message ?? 'Could not save.'),
  });

  return (
    <Flex vertical gap={16}>
      <PageHeader title="Notifications" breadcrumbs={[{ label: 'Settings' }, { label: 'Notifications' }]} subtitle="Choose how we reach you about orders, payments and your account." />
      <Card>
        <Flex vertical gap={20}>
          <Flex justify="space-between" align="center">
            <div>
              <Typography.Text strong>In-panel notifications</Typography.Text>
              <div><Typography.Text type="secondary" style={{ fontSize: 12 }}>Alerts shown inside the seller panel.</Typography.Text></div>
            </div>
            <Switch checked={Boolean(user?.notifyInPanel ?? true)} loading={mut.isPending} onChange={(v) => mut.mutate({ notifyInPanel: v })} />
          </Flex>
          <Flex justify="space-between" align="center">
            <div>
              <Typography.Text strong>Email notifications</Typography.Text>
              <div><Typography.Text type="secondary" style={{ fontSize: 12 }}>Order, payout and policy updates by email.</Typography.Text></div>
            </div>
            <Switch checked={Boolean(user?.notifyEmail ?? true)} loading={mut.isPending} onChange={(v) => mut.mutate({ notifyEmail: v })} />
          </Flex>
        </Flex>
      </Card>
    </Flex>
  );
}
