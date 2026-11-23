import { Alert, Form, Input, Modal, Select, Typography } from 'antd';
import { useEffect } from 'react';

const OPTIONS = [
  { value: 'CONFIRMED', label: 'New (placed, not yet accepted)' },
  { value: 'ACCEPTED', label: 'Accepted by the seller' },
  { value: 'READY_TO_SHIP', label: 'Ready to ship' },
  { value: 'SHIPPED', label: 'Shipped' },
  { value: 'IN_TRANSIT', label: 'In transit' },
  { value: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
  { value: 'DELIVERY_FAILED', label: 'Delivery failed' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'RTO', label: 'Returning to the seller' },
  { value: 'CANCELLED', label: 'Cancelled — returns stock and refunds the customer' },
];

/** Admin override: set one seller parcel to any status, with a reason that is kept in the audit log and the parcel's history. */
export default function ParcelStatusModal({ shipment, loading, onCancel, onConfirm }) {
  const [form] = Form.useForm();
  useEffect(() => {
    if (shipment) form.setFieldsValue({ status: shipment.status, reason: '' });
  }, [shipment, form]);
  const chosen = Form.useWatch('status', form);

  return (
    <Modal
      title={shipment ? `Change status — ${shipment.sellerName}` : 'Change status'}
      open={Boolean(shipment)}
      onCancel={onCancel}
      onOk={() => form.submit()}
      okText="Change status"
      okButtonProps={{ loading, danger: chosen === 'CANCELLED', disabled: !shipment || chosen === shipment.status }}
      destroyOnClose
    >
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 12 }}
        message="This overrides the seller and the courier"
        description="The customer, the seller and this order's status update at once. Later courier updates never move the parcel backwards."
      />
      <Form form={form} layout="vertical" onFinish={(values) => onConfirm(shipment, values)}>
        <Form.Item name="status" label="New status" rules={[{ required: true }]}>
          <Select options={OPTIONS} />
        </Form.Item>
        <Form.Item name="reason" label="Reason" rules={[{ required: true, min: 3, message: 'Say why you are changing this status.' }]}>
          <Input.TextArea rows={3} maxLength={300} showCount placeholder="Shown in the order history and the audit log" />
        </Form.Item>
      </Form>
      {chosen === 'CANCELLED' && (
        <Typography.Text type="danger">
          Cancelling cannot be undone: the stock goes back on sale and this shipment&apos;s amount is refunded to the customer.
        </Typography.Text>
      )}
    </Modal>
  );
}
