import { Alert, Form, InputNumber, Typography } from 'antd';
import { SCOPE_DIMENSIONS, SCOPE_LIMITS } from '@core/rbac/scopes';
import EntitySelect from '@ui/components/EntitySelect';

/**
 * Renders only the scope dimensions the assigned roles actually use, so a
 * Finance Executive is asked for refund limits and a Category Manager for
 * categories — not both.
 *
 * Money limits are entered in rupees and stored in paise.
 */
export default function ScopeFields({ dimensions = [] }) {
  const entityDims = SCOPE_DIMENSIONS.filter((d) => dimensions.includes(d.key));
  const limitDims = SCOPE_LIMITS.filter((l) => dimensions.includes(l.key));

  if (!entityDims.length && !limitDims.length) return null;

  return (
    <>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="This role is limited"
        description="Fill in every limit below. An empty limit would mean no limit at all, so it is not allowed."
      />

      {entityDims.map((d) => (
        <Form.Item key={d.key} name={['scope', d.key]} label={d.label} extra={d.help} rules={[{ required: true, type: 'array', min: 1, message: `Choose at least one ${d.label.toLowerCase().replace(/s$/, '')}.` }]}>
          <EntitySelect entity={d.entity} multiple placeholder={`Choose ${d.label.toLowerCase()}`} />
        </Form.Item>
      ))}

      {limitDims.map((l) => (
        <Form.Item key={l.key} label={l.label} extra={l.help} style={{ marginBottom: 12 }}>
          <Form.Item name={['scope', l.key]} noStyle rules={[{ required: true, message: `Enter ${l.label.toLowerCase()} (0 means everything needs approval).` }]}>
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              step={500}
              prefix="₹"
              placeholder="Required"
              formatter={(v) => (v ? Number(v).toLocaleString('en-IN') : '')}
              parser={(v) => (v ? v.replace(/[^\d]/g, '') : '')}
            />
          </Form.Item>
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
            Anything above this amount waits for another admin to approve it.
          </Typography.Text>
        </Form.Item>
      ))}
    </>
  );
}
