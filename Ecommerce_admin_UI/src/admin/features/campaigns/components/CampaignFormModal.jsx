import { ColorPicker, DatePicker, Flex, Form, Input, InputNumber, Modal, Select, Typography } from 'antd';
import { ImageUpload } from '@admin/features/cms/components/BannerFormModal';
import { useEffect } from 'react';
import { dayjs } from '@core/utils/date';
import { CAMPAIGN_TYPES, CUSTOMER_SECTIONS } from '../api/campaigns.api';

/**
 * Create or edit a campaign shell. The admin sets the window, where it shows in
 * the customer app and the discount floor sellers must beat to be approved.
 */
// Server field names that differ from this form's fields.
const SERVER_FIELD = { startsAt: 'window', endsAt: 'window' };

export default function CampaignFormModal({ open, onClose, onSubmit, loading, initial, error }) {
  const [form] = Form.useForm();
  const editing = Boolean(initial);

  // Show the server's per-field errors under the matching inputs.
  useEffect(() => {
    if (!open || !error?.fieldErrors) return;
    form.setFields(
      Object.entries(error.fieldErrors).map(([name, errors]) => ({ name: SERVER_FIELD[name] ?? name, errors: [].concat(errors) })),
    );
  }, [error, open, form]);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      form.setFieldsValue({
        ...initial,
        window: [dayjs(initial.startsAt), dayjs(initial.endsAt)],
        submissionDeadline: initial.submissionDeadline ? dayjs(initial.submissionDeadline) : null,
        gradientTop: initial.gradient?.[0] ?? null,
        gradientBottom: initial.gradient?.[1] ?? null,
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
      backgroundImageUrl: v.backgroundImageUrl || null,
      heroImageUrl: v.heroImageUrl || null,
      // Both colours or none: a half-set gradient falls back to the campaign type's colours.
      gradient: v.gradientTop && v.gradientBottom ? [v.gradientTop, v.gradientBottom] : null,
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
        <Form.Item name="name" label="Campaign name" rules={[{ required: true, whitespace: true, message: 'Give the campaign a name.' }, { max: 80, message: 'Keep it under 80 characters.' }]}>
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

        <Form.Item
          name="window"
          label="Runs"
          rules={[
            { required: true, message: 'Pick the live window.' },
            // A new campaign (or a changed start) cannot begin in the past; a running campaign keeps its start.
            {
              validator: (_r, v) => {
                const startChanged = !initial || !v?.[0]?.isSame(initial.startsAt, 'minute');
                return startChanged && v?.[0]?.isBefore(dayjs().subtract(1, 'minute'))
                  ? Promise.reject(new Error('The start is in the past.'))
                  : Promise.resolve();
              },
            },
            // A new campaign that has already ended would never run.
            { validator: (_r, v) => (!editing && v?.[1]?.isBefore(dayjs()) ? Promise.reject(new Error('The end is in the past.')) : Promise.resolve()) },
          ]}
        >
          <DatePicker.RangePicker showTime style={{ width: '100%' }} disabledDate={(d) => !editing && d.isBefore(dayjs(), 'day')} />
        </Form.Item>

        <Form.Item
          name="submissionDeadline"
          label="Seller entry deadline"
          extra="Sellers can nominate products until this time."
          dependencies={['window']}
          rules={[
            ({ getFieldValue }) => ({
              validator: (_r, v) => {
                const end = getFieldValue('window')?.[1];
                return v && end && !v.isBefore(end) ? Promise.reject(new Error('Must be before the campaign ends.')) : Promise.resolve();
              },
            }),
          ]}
        >
          <DatePicker showTime style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          name="minDiscountPct"
          label="Minimum discount"
          rules={[
            { required: true, message: 'Set the minimum discount.' },
            { type: 'integer', min: 1, max: 95, message: 'Use a whole number from 1 to 95.' },
          ]}
          extra="Entries below this are auto-flagged and will fail approval."
        >
          <InputNumber min={1} max={95} precision={0} addonAfter="%" style={{ width: '100%' }} />
        </Form.Item>

        <Typography.Title level={5} style={{ marginTop: 8 }}>Look in the customer app</Typography.Title>
        <Form.Item label="Card gradient" extra="Top and bottom colours of this campaign's card in the Deals section and of its page. Leave empty to use the default.">
          <Flex gap={16}>
            <Form.Item name="gradientTop" noStyle getValueFromEvent={(color) => (color && !color.cleared ? color.toHexString() : null)}>
              <ColorPicker allowClear showText format="hex" disabledAlpha />
            </Form.Item>
            <Form.Item name="gradientBottom" noStyle getValueFromEvent={(color) => (color && !color.cleared ? color.toHexString() : null)}>
              <ColorPicker allowClear showText format="hex" disabledAlpha />
            </Form.Item>
          </Flex>
        </Form.Item>
        <Form.Item name="backgroundImageUrl" label="Card background image" extra="Blended behind the gradient on the Deals card. Any shape; it is cropped to fit.">
          <ImageUpload kind="FREE" removable />
        </Form.Item>
        <Form.Item name="heroImageUrl" label="Hero banner image" extra="Shown at the top of the campaign's own page. 16:9.">
          <ImageUpload kind="HERO" removable />
        </Form.Item>
      </Form>
    </Modal>
  );
}
