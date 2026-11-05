import { Form, Input, Modal, Select } from 'antd';
import { useEffect, useState } from 'react';
import DocumentUpload from './DocumentUpload';

export default function ActionReasonModal({ open, title = 'Give a reason', reasonCodes = [], onCancel, onConfirm, loading, attachmentsRequired = false, okText = 'Confirm' }) {
  const [form] = Form.useForm();
  const [attachments, setAttachments] = useState([]);
  useEffect(() => { if (open) { form.resetFields(); setAttachments([]); } }, [open, form]);
  const submit = async () => {
    const values = await form.validateFields();
    if (attachmentsRequired && !attachments.length) { form.setFields([{ name: 'attachments', errors: ['Add at least one attachment.'] }]); return; }
    onConfirm?.({ reasonCode: values.reasonCode, notes: values.notes?.trim() || null, attachments: attachments.map((item) => ({ mediaId: item.mediaId ?? item.id })) });
  };
  return (
    <Modal open={open} title={title} onCancel={onCancel} onOk={submit} okText={okText} okButtonProps={{ loading }} cancelButtonProps={{ disabled: loading }} maskClosable={!loading} destroyOnHidden>
      <Form form={form} layout="vertical" requiredMark={false} disabled={loading}>
        <Form.Item name="reasonCode" label="Reason" rules={[{ required: true, message: 'Choose a reason.' }]}><Select showSearch optionFilterProp="label" options={reasonCodes.map((reason) => typeof reason === 'string' ? { value: reason, label: reason } : reason)} /></Form.Item>
        <Form.Item name="notes" label="Notes" rules={[{ max: 2000 }]}><Input.TextArea rows={4} showCount maxLength={2000} /></Form.Item>
        <Form.Item name="attachments" label="Evidence" required={attachmentsRequired}><DocumentUpload value={attachments} onChange={setAttachments} /></Form.Item>
      </Form>
    </Modal>
  );
}
