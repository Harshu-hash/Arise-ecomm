import { App, Form, Input, Modal, Typography } from 'antd';
import { useState } from 'react';
import { securityApi } from '../api/security.api';

export default function StepUpModal({ open, onCancel, onVerified, title = 'Confirm it’s you' }) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    try { const { password } = await form.validateFields(); setLoading(true); const result = await securityApi.reauth(password); await onVerified(result.token); form.resetFields(); onCancel(); }
    catch (error) { if (error?.errorFields) return; message.error(error?.message ?? 'Re-authentication failed.'); }
    finally { setLoading(false); }
  };
  return <Modal title={title} open={open} onCancel={onCancel} onOk={submit} okText="Confirm" confirmLoading={loading} destroyOnHidden><Typography.Paragraph type="secondary">Enter your password. The short-lived confirmation is never placed in the URL or local storage.</Typography.Paragraph><Form form={form} layout="vertical"><Form.Item name="password" label="Password" rules={[{ required: true, message: 'Enter your password.' }]}><Input.Password autoComplete="current-password" /></Form.Item></Form></Modal>;
}
