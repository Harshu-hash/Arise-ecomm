import { LockOutlined } from '@ant-design/icons';
import { Alert, Button, Form, Result, Space, Typography } from 'antd';
import { Input } from 'antd';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError } from '@core/api/errors';
import { sellerAuthApi } from '../api/auth.api';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState(null);

  const submit = async (values) => {
    setLoading(true);
    setFormError(null);
    try {
      await sellerAuthApi.resetPassword({ token, password: values.password });
      setDone(true);
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors) {
        form.setFields(Object.entries(e.fieldErrors).map(([name, errors]) => ({ name, errors: [errors] })));
      }
      setFormError(e instanceof ApiError ? e.message : 'Could not reset your password.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return <Result status="warning" title="Invalid link" subTitle="This reset link is missing its token." extra={<Link to="/forgot-password">Request a new link</Link>} />;
  }

  if (done) {
    return <Result status="success" title="Password updated" subTitle="You can now sign in with your new password." extra={<Link to="/login"><Button type="primary">Go to sign in</Button></Link>} />;
  }

  return (
    <div>
      <Space direction="vertical" size={2} style={{ marginBottom: 20 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Choose a new password
        </Typography.Title>
      </Space>

      {formError && <Alert type="error" showIcon message={formError} style={{ marginBottom: 16 }} />}

      <Form form={form} layout="vertical" requiredMark={false} onFinish={submit} disabled={loading}>
        <Form.Item
          name="password"
          label="New password"
          rules={[
            { required: true, message: 'Choose a password.' },
            { min: 8, message: 'Use at least 8 characters.' },
          ]}
        >
          <Input.Password autoFocus size="large" prefix={<LockOutlined style={{ opacity: 0.45 }} />} placeholder="At least 8 characters" autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          name="confirm"
          label="Confirm password"
          dependencies={['password']}
          rules={[
            { required: true, message: 'Re-enter your password.' },
            ({ getFieldValue }) => ({
              validator: (_, value) => (!value || getFieldValue('password') === value ? Promise.resolve() : Promise.reject(new Error('Passwords do not match.'))),
            }),
          ]}
        >
          <Input.Password size="large" prefix={<LockOutlined style={{ opacity: 0.45 }} />} placeholder="Repeat password" autoComplete="new-password" />
        </Form.Item>
        <Button type="primary" size="large" htmlType="submit" block loading={loading}>
          Update password
        </Button>
      </Form>
    </div>
  );
}
