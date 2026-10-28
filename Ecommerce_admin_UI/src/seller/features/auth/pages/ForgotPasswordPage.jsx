import { MailOutlined } from '@ant-design/icons';
import { Alert, Button, Form, Input, Result, Space, Typography } from 'antd';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { IS_MOCK } from '@core/config/env';
import { sellerAuthApi } from '../api/auth.api';

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(null);

  const submit = async (values) => {
    setLoading(true);
    try {
      const res = await sellerAuthApi.forgotPassword(values.email.trim());
      setSent(res);
    } catch {
      // Same confirmation regardless, so emails cannot be enumerated.
      setSent({ sent: true });
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <Result
        status="success"
        title="Check your email"
        subTitle="If that email has a seller account, we've sent a link to reset your password."
        extra={
          <Space direction="vertical">
            {IS_MOCK && sent.devHint && (
              <Alert
                type="info"
                message={
                  <Typography.Text style={{ fontSize: 12 }}>
                    Mock reset link: <Link to={`/reset-password?token=${sent.devHint}`}>reset now</Link>
                  </Typography.Text>
                }
              />
            )}
            <Link to="/login">Back to sign in</Link>
          </Space>
        }
      />
    );
  }

  return (
    <div>
      <Space direction="vertical" size={2} style={{ marginBottom: 20 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Reset your password
        </Typography.Title>
        <Typography.Text type="secondary">We will email you a reset link.</Typography.Text>
      </Space>

      <Form layout="vertical" requiredMark={false} onFinish={submit} disabled={loading}>
        <Form.Item
          name="email"
          label="Email"
          rules={[
            { required: true, message: 'Enter your email.' },
            { type: 'email', message: 'That does not look like an email address.' },
          ]}
        >
          <Input autoFocus size="large" prefix={<MailOutlined style={{ opacity: 0.45 }} />} placeholder="you@store.test" />
        </Form.Item>
        <Button type="primary" size="large" htmlType="submit" block loading={loading}>
          Send reset link
        </Button>
      </Form>

      <div style={{ textAlign: 'center', marginTop: 14 }}>
        <Link to="/login">Back to sign in</Link>
      </div>
    </div>
  );
}
