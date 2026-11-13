import { Form, Input, Typography } from 'antd';
import ImageFieldPicker from '@ui/components/ImageFieldPicker';

/**
 * Category image + icon — what the customer app shows on its category browse
 * screen and home category strip.
 */
export default function CategoryAppearanceFields() {
  return (
    <>
      <Typography.Text strong style={{ display: 'block', margin: '4px 0 8px' }}>
        Appearance
      </Typography.Text>
      <ImageFieldPicker
        name="imageUrl"
        label="Image"
        extra="Shown on the customer app's category browse screen. PNG/JPG, under 2 MB."
      />
      <Form.Item
        name="icon"
        label="Icon"
        style={{ marginTop: 12, marginBottom: 0 }}
        extra="Icon name or emoji for the home category strip (e.g. shopping-bag, 👗)."
      >
        <Input allowClear placeholder="e.g. shopping-bag" />
      </Form.Item>
    </>
  );
}
