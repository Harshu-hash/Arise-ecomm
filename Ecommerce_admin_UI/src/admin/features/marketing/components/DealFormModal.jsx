import { App, DatePicker, Form, Input, InputNumber, Modal, Select } from 'antd';
import { useMutation } from '@tanstack/react-query';
import { ApiError, showFieldErrors } from '@core/api/errors';
import { dayjs } from '@core/utils/date';
import EntitySelect from '@ui/components/EntitySelect';
import { marketingApi } from '../api/marketing.api';

const TAGS = ['BESTSELLER', 'TRENDING', 'SUPER SAVER', 'HOT DEAL'];
const MAX_DAYS = 90; // keep in step with the server's MAX_DEAL_DAYS
const FIELD_ALIASES = { dealPricePaise: 'dealPriceRupees' };

/**
 * A deal is really "pick a live offer and discount it further" — the offer
 * already carries the product, seller and MRP, so the form only asks for
 * what the rail actually displays.
 */
export default function DealFormModal({ open, onClose, onSaved }) {
  const { message } = App.useApp();
  const [form] = Form.useForm();

  const create = useMutation({
    mutationFn: (payload) => marketingApi.createDeal(payload),
    onSuccess: () => { message.success('Deal created'); onSaved(); },
    onError: (e) => {
      if (e instanceof ApiError && e.fieldErrors) showFieldErrors(form, message, e, FIELD_ALIASES);
      else message.error(e.message);
    },
  });

  const submit = async () => {
    const v = await form.validateFields();
    create.mutate({
      title: v.title,
      label: v.label,
      tag: v.tag,
      productId: v.productId,
      dealPricePaise: Math.round(v.dealPriceRupees * 100),
      placement: v.placement,
      slotDate: v.slotDate ? v.slotDate.format('YYYY-MM-DD') : null,
      endsAt: v.endsAt.endOf('day').toISOString(),
    });
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={submit}
      title="New deal"
      okText="Create"
      okButtonProps={{ loading: create.isPending }}
      destroyOnHidden
      afterOpenChange={(opened) => opened && form.resetFields()}
    >
      <Form form={form} layout="vertical" initialValues={{ placement: 'OFFERS_PAGE', tag: 'TRENDING', endsAt: dayjs().add(14, 'day') }}>
        <Form.Item name="productId" label="Product" rules={[{ required: true, message: 'Choose a product.' }]} extra="The seller, price and MRP come from that product's current buy-box offer.">
          <EntitySelect entity="product" placeholder="Search a live product" />
        </Form.Item>
        <Form.Item name="title" label="Title" rules={[{ required: true, whitespace: true, message: 'Required.' }, { max: 80 }]}>
          <Input placeholder="Helmets" maxLength={80} />
        </Form.Item>
        <Form.Item name="label" label="Label customers see" rules={[{ max: 40 }]}>
          <Input placeholder="Min. 30% Off" maxLength={40} />
        </Form.Item>
        <Form.Item name="tag" label="Tag">
          <Select options={TAGS.map((v) => ({ value: v, label: v }))} />
        </Form.Item>
        <Form.Item name="dealPriceRupees" label="Deal price (₹)" rules={[{ required: true, message: 'Required.' }]}>
          <InputNumber min={1} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="placement" label="Placement">
          <Select options={[{ value: 'TOP_VALUE_DEALS', label: 'Top value deals' }, { value: 'OFFERS_PAGE', label: 'Offers page' }]} />
        </Form.Item>
        <Form.Item
          name="slotDate" label="Deal-of-the-day slot (optional)" dependencies={['endsAt']}
          extra="One deal per placement per day. Leave blank to just run for the schedule below."
          rules={[({ getFieldValue }) => ({
            validator: (_rule, slot) => (slot && getFieldValue('endsAt') && slot.isAfter(getFieldValue('endsAt'), 'day')
              ? Promise.reject(new Error('The slot must fall on or before the end date'))
              : Promise.resolve()),
          })]}
        >
          <DatePicker style={{ width: '100%' }} disabledDate={(date) => date.isBefore(dayjs().startOf('day'))} />
        </Form.Item>
        <Form.Item name="endsAt" label="Ends" rules={[{ required: true }]} extra={`A deal can run for at most ${MAX_DAYS} days.`}>
          <DatePicker
            style={{ width: '100%' }}
            disabledDate={(date) => date.isBefore(dayjs().startOf('day')) || date.isAfter(dayjs().add(MAX_DAYS, 'day'), 'day')}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
