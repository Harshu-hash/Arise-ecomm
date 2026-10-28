import { Alert, Form, Input, InputNumber, Modal, Select, Space } from 'antd';
import ImageUpload from '@ui/components/ImageUpload/ImageUpload';

const RETURN_TYPES = [
  { value: 'RETURN', label: 'Returnable' },
  { value: 'REPLACEMENT', label: 'Replacement only' },
  { value: 'NONE', label: 'No returns' },
];

/** The "Edit content" modal on a listing's detail page. */
export default function EditListingModal({ open, onCancel, form, onFinish, loading, images, onImagesChange, sizeCharts, isLive }) {
  return (
    <Modal title="Edit listing content" open={open} onCancel={onCancel} onOk={() => form.submit()} okText="Save changes" confirmLoading={loading}>
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Form.Item name="title" label="Title" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="description" label="Description">
          <Input.TextArea rows={3} />
        </Form.Item>
        <Form.Item name="highlights" label="Highlights" extra="One per line.">
          <Input.TextArea rows={3} />
        </Form.Item>
        <Form.Item label="Images">
          <ImageUpload value={images} onChange={onImagesChange} maxCount={8} label="Product" />
        </Form.Item>
        {sizeCharts.length > 0 && (
          <Form.Item name="sizeChartId" label="Size chart">
            <Select allowClear placeholder="Attach a size chart" options={sizeCharts.map((s) => ({ value: s.id, label: s.name }))} />
          </Form.Item>
        )}
        <Space.Compact block>
          <Form.Item name="returnType" label="Return policy" style={{ width: '60%' }}>
            <Select options={RETURN_TYPES} />
          </Form.Item>
          <Form.Item name="returnWindowDays" label="Window (days)" style={{ width: '40%' }}>
            <InputNumber style={{ width: '100%' }} min={0} max={60} />
          </Form.Item>
        </Space.Compact>
        {isLive && (
          <Alert type="info" showIcon message="Editing a live listing creates a revision for QC; the listing stays live meanwhile." />
        )}
      </Form>
    </Modal>
  );
}
