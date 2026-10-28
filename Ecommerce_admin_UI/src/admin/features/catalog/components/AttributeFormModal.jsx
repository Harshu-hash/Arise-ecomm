import { Form, Input, Modal, Select, Space, Switch } from 'antd';
import { useEffect } from 'react';

const TYPES = ['TEXT', 'NUMBER', 'SINGLE_SELECT', 'MULTI_SELECT', 'BOOLEAN', 'COLOUR', 'SIZE', 'DATE'];
const SELECT_TYPES = new Set(['SINGLE_SELECT', 'MULTI_SELECT', 'COLOUR', 'SIZE']);

/** Create/edit modal for a single attribute. */
export default function AttributeFormModal({ open, editing, onCancel, onSubmit, loading }) {
  const [form] = Form.useForm();
  const type = Form.useWatch('type', form);

  useEffect(() => {
    if (open) {
      form.resetFields();
      if (editing) {
        form.setFieldsValue({ ...editing, values: (editing.values ?? []).map((v) => v.value) });
      }
    }
  }, [open, editing, form]);

  const submit = async () => {
    const values = await form.validateFields();
    onSubmit({ ...values, values: values.values ?? [] });
  };

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      onOk={submit}
      confirmLoading={loading}
      title={editing ? `Edit "${editing.name}"` : 'New attribute'}
      okText={editing ? 'Save' : 'Create'}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Give it a name.' }]}>
          <Input placeholder="e.g. Collar Type" />
        </Form.Item>
        <Form.Item
          name="code"
          label="Code"
          rules={[{ required: true, message: 'Give it a code.' }]}
          extra="Used as the field key in listings. Cannot change after creation."
        >
          <Input placeholder="e.g. collar_type" disabled={Boolean(editing)} />
        </Form.Item>
        <Form.Item name="type" label="Type" rules={[{ required: true, message: 'Choose a type.' }]}>
          <Select
            options={TYPES.map((t) => ({ value: t, label: t.replace(/_/g, ' ').toLowerCase() }))}
            disabled={Boolean(editing) && editing.usedInCategories > 0}
          />
        </Form.Item>
        {SELECT_TYPES.has(type) && (
          <Form.Item name="values" label="Values" extra="Press enter after each value.">
            <Select mode="tags" open={false} tokenSeparators={[',']} placeholder="e.g. Red, Blue, Green" />
          </Form.Item>
        )}
        <Form.Item name="unit" label="Unit (optional)">
          <Input placeholder="e.g. mm, hours, litres" />
        </Form.Item>
        <Space>
          <Form.Item name="variantDefining" label="Defines variants" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="filterable" label="Filterable in app" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Space>
      </Form>
    </Modal>
  );
}
