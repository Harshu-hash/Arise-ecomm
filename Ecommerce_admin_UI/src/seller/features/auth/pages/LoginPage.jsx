import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { Alert, Button, Divider, Form, Input, Space, Typography } from 'antd';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '@core/api/errors';
import { useSessionStore } from '@core/auth/sessionStore';
import { IS_MOCK } from '@core/config/env';
import { sellerAuthApi } from '../api/auth.api';

/**
 * Seller sign-in. Single-step email + password for S1 (seller 2FA is a later
 * hardening pass); the shared session machine then routes an onboarding-
 * incomplete seller to the wizard via `defaultLanding`.
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuthenticated = useSessionStore((s) => s.setAuthenticated);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState(null);

  const submit = async (values) => {
    setLoading(true);
    setFormError(null);
    try {
      const payload = await sellerAuthApi.login({ email: values.email.trim(), password: values.password });
      setAuthenticated(payload);
      const target = location.state?.from?.pathname ?? payload.user.defaultLanding ?? '/';
      navigate(payload.user.mustChangePassword ? '/change-password' : target, { replace: true });
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : 'Could not sign you in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Space direction="vertical" size={2} style={{ marginBottom: 20 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Seller sign in
        </Typography.Title>
        <Typography.Text type="secondary">Manage your Arise store.</Typography.Text>
      </Space>

      {formError && (
        <Alert type="error" showIcon message={formError} style={{ marginBottom: 16 }} closable onClose={() => setFormError(null)} />
      )}

      <Form layout="vertical" requiredMark={false} onFinish={submit} disabled={loading}>
        <Form.Item
          name="email"
          label="Email"
          rules={[
            { required: true, message: 'Enter your email.' },
            { type: 'email', message: 'That does not look like an email address.' },
          ]}
        >
          <Input autoFocus size="large" prefix={<MailOutlined style={{ opacity: 0.45 }} />} placeholder="you@store.test" autoComplete="username" />
        </Form.Item>

        <Form.Item name="password" label="Password" rules={[{ required: true, message: 'Enter your password.' }]}>
          <Input.Password size="large" prefix={<LockOutlined style={{ opacity: 0.45 }} />} placeholder="••••••••••••" autoComplete="current-password" />
        </Form.Item>

        <Button type="primary" size="large" htmlType="submit" block loading={loading}>
          Sign in
        </Button>
      </Form>

      <div style={{ textAlign: 'center', marginTop: 14 }}>
        <Link to="/forgot-password">Forgot your password?</Link>
      </div>

      <Divider plain style={{ fontSize: 12 }}>
        New to Arise?
      </Divider>
      <Link to="/register">
        <Button block size="large">
          Create a seller account
        </Button>
      </Link>

      {IS_MOCK && (
        <Alert
          type="info"
          style={{ marginTop: 18 }}
          message="Demo accounts"
          description={
            <Typography.Text style={{ fontSize: 12 }}>
              Owner <Typography.Text code>owner@arise.test</Typography.Text>, sub-users{' '}
              <Typography.Text code>catalog@arise.test</Typography.Text> /{' '}
              <Typography.Text code>orders@arise.test</Typography.Text>, mid-onboarding{' '}
              <Typography.Text code>newseller@arise.test</Typography.Text> — all password{' '}
              <Typography.Text code>Arise@123456</Typography.Text>.
            </Typography.Text>
          }
        />
      )}
    </div>
  );
}
