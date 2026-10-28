import { Button, InputNumber, Space, Typography } from 'antd';
import { useState } from 'react';

/** Inline single-value editor used for the listing detail page's price/stock quick-edit. */
export default function QuickEdit({ label, initial, max, loading, integer, onSave }) {
  const [value, setValue] = useState(initial);
  return (
    <div>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>{label}</Typography.Text>
      <Space.Compact style={{ width: '100%', marginTop: 4 }}>
        <InputNumber
          style={{ width: '100%' }}
          value={value}
          min={0}
          max={max}
          precision={integer ? 0 : 2}
          onChange={setValue}
        />
        <Button type="primary" loading={loading} disabled={value === initial || value === null} onClick={() => onSave(value)}>
          Save
        </Button>
      </Space.Compact>
    </div>
  );
}
