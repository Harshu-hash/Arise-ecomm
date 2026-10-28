import { Form, Input, Modal, Select } from 'antd';
import { useEffect } from 'react';

/** Create/edit modal for an attribute set (the group a category adopts). */
export default function AttributeSetFormModal({ open, editing, attributes, onCancel, onSubmit, loading }) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (open) {
      form.resetFields();
      if (editing) form.setFieldsValue(editing);
    }
  }, [open, editing, form]);

  const submit = async () => {
    const values = await form.validateFields();
    onSubmit(values);
  };

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      onOk={submit}
      confirmLoading={loading}
      title={editing ? `Edit "${editing.name}"` : 'New attribute set'}
      okText={editing ? 'Save' : 'Create'}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Give it a name.' }]}>
          <Input placeholder="e.g. Footwear" />
        </Form.Item>
        <Form.Item name="rootName" label="Applies to (optional)">
          <Input placeholder="e.g. Fashion — leave blank for any category" />
        </Form.Item>
        <Form.Item name="attributeIds" label="Attributes" rules={[{ required: true, message: 'Pick at least one attribute.' }]}>
          <Select
            mode="multiple"
            showSearch
            optionFilterProp="label"
            options={attributes.map((a) => ({ value: a.id, label: `${a.name} (${a.code})` }))}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
