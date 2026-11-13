import { DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import { App, Button, Form, Image, Input, Space, Upload } from 'antd';

const PLACEHOLDER =
  "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='72' height='72'%3E%3Crect width='72' height='72' fill='%23f0f0f0'/%3E%3C/svg%3E";

/**
 * A Form-bound image picker. Stores the chosen file as a data URL in the field
 * named by `name` — against the mock API there is no upload server, so the
 * image is kept inline (persists and previews without a round-trip). When a
 * real backend exists, swap `readFile` for a POST to the media endpoint and
 * store the returned URL instead.
 */
export default function ImageFieldPicker({
  name = 'imageUrl',
  label = 'Image',
  extra,
  maxMB = 2,
  size = 72,
}) {
  const { message } = App.useApp();
  const form = Form.useFormInstance();
  const value = Form.useWatch(name, form);

  const beforeUpload = (file) => {
    if (!file.type?.startsWith('image/')) {
      message.error('Please choose an image file.');
      return Upload.LIST_IGNORE;
    }
    if (file.size > maxMB * 1024 * 1024) {
      message.error(`Image must be under ${maxMB} MB.`);
      return Upload.LIST_IGNORE;
    }
    const reader = new FileReader();
    reader.onload = () => form.setFieldValue(name, reader.result);
    reader.onerror = () => message.error('Could not read that image.');
    reader.readAsDataURL(file);
    return false; // handled inline — no network upload
  };

  return (
    <Space align="start" size={12} style={{ display: 'flex' }}>
      {value ? (
        <Image
          src={value}
          alt={label}
          width={size}
          height={size}
          style={{ objectFit: 'cover', borderRadius: 8, border: '1px solid var(--ant-color-border)' }}
          fallback={PLACEHOLDER}
        />
      ) : (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: 8,
            border: '1px dashed var(--ant-color-border)',
            display: 'grid',
            placeItems: 'center',
            fontSize: 11,
            color: 'var(--ant-color-text-tertiary)',
            textAlign: 'center',
          }}
        >
          No image
        </div>
      )}
      <Form.Item label={label} extra={extra} style={{ marginBottom: 0, flex: 1 }}>
        <Space>
          <Upload accept="image/*" showUploadList={false} maxCount={1} beforeUpload={beforeUpload}>
            <Button icon={<UploadOutlined />}>{value ? 'Replace image' : 'Choose image'}</Button>
          </Upload>
          {value && (
            <Button type="text" danger icon={<DeleteOutlined />} onClick={() => form.setFieldValue(name, null)}>
              Remove
            </Button>
          )}
        </Space>
      </Form.Item>
      {/* Holds the picked image so it submits with the form. */}
      <Form.Item name={name} hidden>
        <Input />
      </Form.Item>
    </Space>
  );
}
