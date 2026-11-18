import { ColorPicker, Form, Select, Space, Typography } from 'antd';
import ImageFieldPicker from '@ui/components/ImageFieldPicker';
import { CATEGORY_ICON_CHOICES } from './categoryIcons';

const ICON_OPTIONS = CATEGORY_ICON_CHOICES.map(([value, label, Icon]) => ({
  value,
  label: <Space><Icon />{label}</Space>,
}));

/**
 * Category image + icon — what the customer app shows on its category browse
 * screen and home category strip.
 */
export default function CategoryAppearanceFields({ isTopLevel = false }) {
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
      {isTopLevel && (
        <Form.Item
          name="color"
          label="Colour"
          getValueFromEvent={(value) => value?.toHexString?.() ?? value}
          extra="Used to identify this top-level category in the customer app."
        >
          <ColorPicker allowClear showText format="hex" />
        </Form.Item>
      )}
      <Form.Item
        name="icon"
        label="Icon"
        style={{ marginTop: 12, marginBottom: 0 }}
        extra="Shown in the customer app's category strip."
      >
        <Select allowClear placeholder="Choose an icon" options={ICON_OPTIONS} />
      </Form.Item>
    </>
  );
}
