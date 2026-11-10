import { PlusOutlined } from '@ant-design/icons';
import { App, Alert, Button, Card, Flex, Form, Input, Modal, Select, Space, Table, Tag, Typography } from 'antd';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Can } from '@core/rbac/Can';
import DateText from '@ui/components/DateText';
import ErrorState from '@ui/components/ErrorState';
import FullPageSpinner from '@ui/components/FullPageSpinner';
import PageHeader from '@ui/components/PageHeader';
import StepUpModal from '@seller/features/security/components/StepUpModal';
import { securityApi } from '@seller/features/security/api/security.api';
import { settingsApi, settingsKeys } from '../api/settings.api';

const STATUS_COLOR = { ACTIVE: 'green', INVITED: 'gold', DEACTIVATED: 'default' };

export default function UsersRolesPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [invited, setInvited] = useState(null);
  const [editing, setEditing] = useState(null);
  const [sensitiveAction, setSensitiveAction] = useState(null);
  const [editForm] = Form.useForm();

  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: settingsKeys.team, queryFn: settingsApi.team });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: settingsKeys.team });

  const inviteMut = useMutation({
    mutationFn: (values) => settingsApi.inviteUser(values),
    onSuccess: (user) => { setInvited(user); form.resetFields(); invalidate(); },
    onError: (e) => message.error(e?.message ?? 'Could not send the invite.'),
  });
  const revokeMut = useMutation({
    mutationFn: (id) => settingsApi.revokeUser(id),
    onSuccess: () => { message.success('Access removed.'); invalidate(); },
    onError: (e) => message.error(e?.message ?? 'Could not remove this user.'),
  });
  const quickAction = async (user, action) => { try { await securityApi.userAction(user.id, action); message.success(action === 'resend-invite' ? 'Invite resent.' : 'Invite cancelled.'); invalidate(); } catch (error) { message.error(error?.message); } };
  const requestEdit = async () => { const values = await editForm.validateFields(); setSensitiveAction({ type: 'update', user: editing, values }); };
  const verified = async (token) => { if (sensitiveAction.type === 'transfer') await securityApi.userAction(sensitiveAction.user.id, 'transfer-ownership', token); else await securityApi.updateUser(sensitiveAction.user.id, sensitiveAction.values, token); message.success(sensitiveAction.type === 'transfer' ? 'Ownership transferred.' : 'User access updated.'); setEditing(null); setSensitiveAction(null); invalidate(); };

  if (isLoading) return <FullPageSpinner label="Loading your team…" />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <Flex vertical gap={16}>
      <PageHeader
        title="Users & Roles"
        breadcrumbs={[{ label: 'Settings' }, { label: 'Users & Roles' }]}
        subtitle="Invite staff to help run your store, each with a role that limits what they can do."
        actions={<Can perm="settings.user.manage"><Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>Invite a user</Button></Can>}
      />

      <Card styles={{ body: { padding: 0 } }}>
        <Table
          rowKey="id"
          scroll={{ x: 'max-content' }}
          dataSource={data.team}
          pagination={false}
          columns={[
            { title: 'Name', dataIndex: 'name', render: (v, r) => <div><Typography.Text strong>{v}</Typography.Text><div><Typography.Text type="secondary" style={{ fontSize: 12 }}>{r.email}</Typography.Text></div></div> },
            { title: 'Role', dataIndex: 'roleName' },
            { title: 'Status', dataIndex: 'status', render: (s) => <Tag color={STATUS_COLOR[s] ?? 'default'}>{s}</Tag> },
            { title: 'Last login', dataIndex: 'lastLoginAt', render: (v) => (v ? <DateText value={v} /> : '—') },
            { title: 'Actions', dataIndex: 'id', render: (userId, user) => <Can perm="settings.user.manage"><Space wrap>{user.status === 'INVITED' && <><Button size="small" onClick={() => quickAction(user, 'resend-invite')}>Resend</Button><Button size="small" danger onClick={() => quickAction(user, 'cancel-invite')}>Cancel invite</Button></>}{user.roleKey !== 'owner' && <Button size="small" onClick={() => { setEditing(user); editForm.setFieldsValue({ roleKey: user.roleKey, status: user.status }); }}>Edit access</Button>}{user.roleKey !== 'owner' && user.status === 'ACTIVE' && <Button size="small" onClick={() => setSensitiveAction({ type: 'transfer', user })}>Transfer ownership</Button>}{user.roleKey !== 'owner' && user.status !== 'DEACTIVATED' && <Button danger type="text" size="small" loading={revokeMut.isPending} onClick={() => revokeMut.mutate(userId)}>Remove</Button>}</Space></Can> },
          ]}
        />
      </Card>

      <Modal title="Invite a team member" open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} okText="Send invite" confirmLoading={inviteMut.isPending}>
        <Form form={form} layout="vertical" onFinish={(v) => inviteMut.mutate(v)}>
          <Form.Item name="name" label="Name"><Input /></Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, message: 'Enter an email.' }, { type: 'email', message: 'That does not look like an email.' }]}><Input /></Form.Item>
          <Form.Item name="roleKey" label="Role" rules={[{ required: true, message: 'Choose a role.' }]}>
            <Select options={data.roles.map((r) => ({ value: r.key, label: r.name }))} placeholder="Select a role" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={`Edit access · ${editing?.name ?? ''}`} open={Boolean(editing)} onCancel={() => setEditing(null)} onOk={requestEdit} okText="Review change">
        <Form form={editForm} layout="vertical"><Form.Item name="roleKey" label="Role" rules={[{ required: true }]}><Select options={data.roles.map((role) => ({ value: role.key, label: role.name }))} /></Form.Item><Form.Item name="status" label="Access state"><Select options={[{ value: 'ACTIVE', label: 'Active' }, { value: 'DEACTIVATED', label: 'Suspended' }]} /></Form.Item></Form>
      </Modal>
      <StepUpModal open={Boolean(sensitiveAction)} onCancel={() => setSensitiveAction(null)} onVerified={verified} title={sensitiveAction?.type === 'transfer' ? 'Confirm ownership transfer' : 'Confirm access change'} />

      <Modal title="Invite sent" open={Boolean(invited)} onCancel={() => setInvited(null)} footer={<Button type="primary" onClick={() => setInvited(null)}>Done</Button>}>
        <Alert
          type="info"
          showIcon
          message={`${invited?.name} has been invited as ${invited?.roleName}.`}
          description={
            <Typography.Text style={{ fontSize: 12 }}>
              In a real deployment this would be emailed to them. For this demo, share this link:
              <br />
              <Typography.Text code copyable>{`/seller/accept-invite?token=${invited?.inviteToken}`}</Typography.Text>
            </Typography.Text>
          }
        />
      </Modal>
    </Flex>
  );
}
