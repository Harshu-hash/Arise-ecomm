import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { Alert, Button, Form, Input, Result, Skeleton, Space, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '@core/api/errors';
import { useSessionStore } from '@core/auth/sessionStore';
import { sellerAuthApi } from '../api/auth.api';

/** A sub-user accepts an invitation, sets a password, and is signed in. */
export default function AcceptInvitePage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const navigate = useNavigate();
  const setAuthenticated = useSessionStore((s) => s.setAuthenticated);
  const [invite, setInvite] = useState(null);
  const [status, setStatus] = useState('loading');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      return;
    }
    sellerAuthApi
      .getInvite(token)
      .then((data) => {
        setInvite(data);
        setStatus('ready');
      })
      .catch(() => setStatus('invalid'));
  }, [token]);

  const submit = async (values) => {
    setLoading(true);
    setFormError(null);
    try {
      const payload = await sellerAuthApi.acceptInvite({ token, name: values.name, password: values.password });
      setAuthenticated(payload);
      navigate(payload.user.defaultLanding ?? '/', { replace: true });
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : 'Could not accept this invitation.');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading') return <Skeleton active paragraph={{ rows: 4 }} />;
  if (status === 'invalid') {
    return <Result status="warning" title="Invitation not found" subTitle="This invite link is invalid or has already been used." extra={<Link to="/login">Go to sign in</Link>} />;
  }

  return (
    <div>
      <Space direction="vertical" size={2} style={{ marginBottom: 20 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Join {invite?.storeName}
        </Typography.Title>
        <Typography.Text type="secondary">
          Invited as <Typography.Text strong>{invite?.roleName}</Typography.Text> ({invite?.email}).
        </Typography.Text>
      </Space>

      {formError && <Alert type="error" showIcon message={formError} style={{ marginBottom: 16 }} />}

      <Form layout="vertical" requiredMark={false} onFinish={submit} disabled={loading} initialValues={{ name: invite?.name }}>
        <Form.Item name="name" label="Your name" rules={[{ required: true, message: 'Enter your name.' }]}>
          <Input autoFocus size="large" prefix={<UserOutlined style={{ opacity: 0.45 }} />} />
        </Form.Item>
        <Form.Item
          name="password"
          label="Set a password"
          rules={[
            { required: true, message: 'Choose a password.' },
            { min: 8, message: 'Use at least 8 characters.' },
          ]}
        >
          <Input.Password size="large" prefix={<LockOutlined style={{ opacity: 0.45 }} />} placeholder="At least 8 characters" autoComplete="new-password" />
        </Form.Item>
        <Button type="primary" size="large" htmlType="submit" block loading={loading}>
          Accept & continue
        </Button>
      </Form>
    </div>
  );
}
