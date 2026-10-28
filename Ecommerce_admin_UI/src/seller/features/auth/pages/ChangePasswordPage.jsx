import { LockOutlined } from '@ant-design/icons';
import { App, Button, Card, Form, Input, Space, Typography } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '@core/api/errors';
import { useSessionStore } from '@core/auth/sessionStore';
import { sellerAuthApi } from '../api/auth.api';

/** Standalone change-password screen (also the forced first-login landing). */
export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const patchUser = useSessionStore((s) => s.patchUser);
  const [loading, setLoading] = useState(false);

  const submit = async (values) => {
    setLoading(true);
    try {
      await sellerAuthApi.changePassword({ currentPassword: values.current, newPassword: values.password });
      patchUser({ mustChangePassword: false });
      message.success('Password updated.');
      navigate('/', { replace: true });
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors) {
        form.setFields(Object.entries(e.fieldErrors).map(([name, errors]) => ({ name: name === 'currentPassword' ? 'current' : 'password', errors: [errors] })));
      } else {
        message.error('Could not update your password.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 440, margin: '40px auto', padding: '0 16px' }}>
      <Card>
        <Space direction="vertical" size={2} style={{ marginBottom: 20 }}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            Change your password
          </Typography.Title>
        </Space>
        <Form form={form} layout="vertical" requiredMark={false} onFinish={submit} disabled={loading}>
          <Form.Item name="current" label="Current password" rules={[{ required: true, message: 'Enter your current password.' }]}>
            <Input.Password size="large" prefix={<LockOutlined style={{ opacity: 0.45 }} />} autoComplete="current-password" />
          </Form.Item>
          <Form.Item
            name="password"
            label="New password"
            rules={[
              { required: true, message: 'Choose a new password.' },
              { min: 8, message: 'Use at least 8 characters.' },
            ]}
          >
            <Input.Password size="large" prefix={<LockOutlined style={{ opacity: 0.45 }} />} autoComplete="new-password" />
          </Form.Item>
          <Button type="primary" size="large" htmlType="submit" block loading={loading}>
            Update password
          </Button>
        </Form>
      </Card>
    </div>
  );
}
