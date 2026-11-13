import { DatePicker, Form, Input, InputNumber, Modal, Select } from 'antd';
import { useEffect } from 'react';
import { dayjs } from '@core/utils/date';
import { CAMPAIGN_TYPES, CUSTOMER_SECTIONS } from '../api/campaigns.api';

/**
 * Create or edit a campaign shell. The admin sets the window, where it shows in
 * the customer app and the discount floor sellers must beat to be approved.
 */
export default function CampaignFormModal({ open, onClose, onSubmit, loading, initial }) {
  const [form] = Form.useForm();
  const editing = Boolean(initial);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      form.setFieldsValue({
        ...initial,
        window: [dayjs(initial.startsAt), dayjs(initial.endsAt)],
        submissionDeadline: initial.submissionDeadline ? dayjs(initial.submissionDeadline) : null,
      });
    } else {
      form.resetFields();
    }
  }, [open, initial, form]);

  const submit = async () => {
    const v = await form.validateFields();
    onSubmit({
      name: v.name,
      type: v.type,
      customerSection: v.customerSection,
      tagline: v.tagline ?? '',
      minDiscountPct: v.minDiscountPct,
      startsAt: v.window[0].toISOString(),
      endsAt: v.window[1].toISOString(),
      submissionDeadline: v.submissionDeadline ? v.submissionDeadline.toISOString() : null,
    });
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={submit}
      title={editing ? 'Edit campaign' : 'New campaign'}
      okText={editing ? 'Save changes' : 'Create campaign'}
      okButtonProps={{ loading }}
      cancelButtonProps={{ disabled: loading }}
      destroyOnHidden
      width={560}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{
          type: 'FLASH_DEAL',
          customerSection: 'FLASH_DEALS_RAIL',
          minDiscountPct: 30,
          window: [dayjs().add(1, 'day'), dayjs().add(2, 'day')],
          submissionDeadline: dayjs().add(12, 'hour'),
        }}
      >
        <Form.Item name="name" label="Campaign name" rules={[{ required: true, message: 'Give the campaign a name.' }]}>
          <Input placeholder="e.g. Big Billion Days 2026" maxLength={80} />
        </Form.Item>

        <Form.Item name="tagline" label="Customer tagline" extra="Shown on the rail/landing page in the customer app.">
          <Input placeholder="e.g. The biggest sale of the year" maxLength={60} />
        </Form.Item>

        <Form.Item name="type" label="Type" rules={[{ required: true }]}>
          <Select
            options={CAMPAIGN_TYPES.map((t) => ({ value: t.value, label: `${t.label} — ${t.hint}` }))}
          />
        </Form.Item>

        <Form.Item
          name="customerSection"
          label="Shows in"
          rules={[{ required: true }]}
          extra="Where approved products appear for customers."
        >
          <Select options={CUSTOMER_SECTIONS} />
        </Form.Item>

        <Form.Item name="window" label="Runs" rules={[{ required: true, message: 'Pick the live window.' }]}>
          <DatePicker.RangePicker showTime style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          name="submissionDeadline"
          label="Seller entry deadline"
          extra="Sellers can nominate products until this time."
        >
          <DatePicker showTime style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          name="minDiscountPct"
          label="Minimum discount"
          rules={[{ required: true }]}
          extra="Entries below this are auto-flagged and will fail approval."
        >
          <InputNumber min={1} max={95} addonAfter="%" style={{ width: '100%' }} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
