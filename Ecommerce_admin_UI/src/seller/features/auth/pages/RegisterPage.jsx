import { LockOutlined, MailOutlined, PhoneOutlined, ShopOutlined, UserOutlined } from '@ant-design/icons';
import { Alert, Button, Form, Input, Space, Typography } from 'antd';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '@core/api/errors';
import { useSessionStore } from '@core/auth/sessionStore';
import { sellerAuthApi } from '../api/auth.api';

/** Create a seller account → lands straight in the onboarding wizard. */
export default function RegisterPage() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const setAuthenticated = useSessionStore((s) => s.setAuthenticated);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState(null);

  const submit = async (values) => {
    setLoading(true);
    setFormError(null);
    try {
      const payload = await sellerAuthApi.register({
        storeName: values.storeName.trim(),
        name: values.name.trim(),
        email: values.email.trim(),
        phone: values.phone,
        password: values.password,
      });
      setAuthenticated(payload);
      navigate('/onboarding', { replace: true });
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors) {
        form.setFields(Object.entries(e.fieldErrors).map(([name, errors]) => ({ name, errors: [errors] })));
      }
      setFormError(e instanceof ApiError ? e.message : 'Could not create your account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Space direction="vertical" size={2} style={{ marginBottom: 20 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Create a seller account
        </Typography.Title>
        <Typography.Text type="secondary">A few details to get started — you can finish onboarding next.</Typography.Text>
      </Space>

      {formError && (
        <Alert type="error" showIcon message={formError} style={{ marginBottom: 16 }} closable onClose={() => setFormError(null)} />
      )}

      <Form form={form} layout="vertical" requiredMark={false} onFinish={submit} disabled={loading}>
        <Form.Item name="storeName" label="Store name" rules={[{ required: true, message: 'Enter your store name.' }]}>
          <Input autoFocus size="large" prefix={<ShopOutlined style={{ opacity: 0.45 }} />} placeholder="e.g. Nova Essentials" />
        </Form.Item>
        <Form.Item name="name" label="Your name" rules={[{ required: true, message: 'Enter your name.' }]}>
          <Input size="large" prefix={<UserOutlined style={{ opacity: 0.45 }} />} placeholder="Full name" />
        </Form.Item>
        <Form.Item
          name="email"
          label="Email"
          rules={[
            { required: true, message: 'Enter your email.' },
            { type: 'email', message: 'That does not look like an email address.' },
          ]}
        >
          <Input size="large" prefix={<MailOutlined style={{ opacity: 0.45 }} />} placeholder="you@store.test" autoComplete="username" />
        </Form.Item>
        <Form.Item name="phone" label="Phone" rules={[{ required: true, message: 'Enter a contact number.' }]}>
          <Input size="large" prefix={<PhoneOutlined style={{ opacity: 0.45 }} />} placeholder="+91 ..." />
        </Form.Item>
        <Form.Item
          name="password"
          label="Password"
          rules={[
            { required: true, message: 'Choose a password.' },
            { min: 8, message: 'Use at least 8 characters.' },
          ]}
        >
          <Input.Password size="large" prefix={<LockOutlined style={{ opacity: 0.45 }} />} placeholder="At least 8 characters" autoComplete="new-password" />
        </Form.Item>

        <Button type="primary" size="large" htmlType="submit" block loading={loading}>
          Create account
        </Button>
      </Form>

      <div style={{ textAlign: 'center', marginTop: 14 }}>
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          Already selling? <Link to="/login">Sign in</Link>
        </Typography.Text>
      </div>
    </div>
  );
}
