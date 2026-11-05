import { ArrowLeftOutlined } from '@ant-design/icons';
import { Button, Form, Input, Space, Typography } from 'antd';
import { useState } from 'react';
import DevCodeHint from './DevCodeHint';

export default function TwoFactorStep({ challenge, onSubmit, onBack, loading, error }) {
  const [useBackup, setUseBackup] = useState(false);
  const [form] = Form.useForm();
  return (
    <div>
      <Space direction="vertical" size={2} style={{ marginBottom: 20 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Two-step verification</Typography.Title>
        <Typography.Text type="secondary">
          {useBackup
            ? 'Enter one of the backup codes saved during setup.'
            : `Enter the 6-digit code from your authenticator app for ${challenge?.maskedEmail ?? 'your account'}.`}
        </Typography.Text>
      </Space>
      {!useBackup && <DevCodeHint code={challenge?.devHint?.code} />}
      <Form form={form} layout="vertical" requiredMark={false} onFinish={(values) => onSubmit({ code: values.code.trim() })}>
        <Form.Item
          name="code"
          label={useBackup ? 'Backup code' : 'Authentication code'}
          validateStatus={error ? 'error' : undefined}
          help={error}
          rules={[
            { required: true, message: useBackup ? 'Enter a backup code.' : 'Enter the 6-digit code.' },
            ...(useBackup ? [] : [{ pattern: /^\d{6}$/, message: 'The code is 6 digits.' }]),
          ]}
        >
          <Input
            autoFocus
            size="large"
            inputMode={useBackup ? 'text' : 'numeric'}
            autoComplete="one-time-code"
            placeholder={useBackup ? 'ABC-1234' : '000000'}
            maxLength={useBackup ? 12 : 6}
            style={{ letterSpacing: useBackup ? 1 : 6, fontSize: 18, textAlign: 'center' }}
          />
        </Form.Item>
        <Button type="primary" size="large" htmlType="submit" block loading={loading}>Verify and sign in</Button>
      </Form>
      <Space style={{ marginTop: 16, width: '100%', justifyContent: 'space-between' }}>
        <Button type="link" icon={<ArrowLeftOutlined />} onClick={onBack} style={{ padding: 0 }}>Back</Button>
        <Button type="link" onClick={() => { setUseBackup((value) => !value); form.resetFields(['code']); }} style={{ padding: 0 }}>
          {useBackup ? 'Use authenticator app' : 'Use a backup code'}
        </Button>
      </Space>
    </div>
  );
}

