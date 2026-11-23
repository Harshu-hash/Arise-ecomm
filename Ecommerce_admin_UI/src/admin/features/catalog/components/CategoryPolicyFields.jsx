import { Col, Form, Input, InputNumber, Row, Select, Switch } from 'antd';

const RETURN_TYPES = [
  { value: 'REFUND', label: 'Refund' },
  { value: 'REPLACEMENT', label: 'Replacement' },
];

/**
 * Identity and policy fields for a category. These cascade to every listing
 * beneath it, which is why return window and GST sit here rather than on the
 * product.
 */
export default function CategoryPolicyFields({ hsnOptions = [], canEditCommission = false, inheritedCommission = null, ownCommission = null }) {
  const commissionHint = ownCommission != null
    ? 'Applies here and below, unless a lower category sets its own.'
    : inheritedCommission?.source
      ? `Using ${inheritedCommission.pct}% from “${inheritedCommission.source.name}”. Set a rate to override it.`
      : 'No rate set on this or any category above: counts as 0%.';
  return (
    <>
      <Row gutter={12}>
        <Col xs={24} md={12}>
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Give it a name.' }]}>
            <Input />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name="status" label="Visibility">
            <Select
              options={[
                { value: 'ACTIVE', label: 'Visible in the app' },
                { value: 'HIDDEN', label: 'Hidden' },
              ]}
            />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={12}>
        <Col xs={24} md={6}>
          <Form.Item
            name="returnWindowDays"
            label="Return window"
            extra="Days after delivery. 0 means no returns."
          >
            <InputNumber min={0} max={60} style={{ width: '100%' }} addonAfter="days" />
          </Form.Item>
        </Col>
        <Col xs={24} md={6}>
          <Form.Item name="returnTypes" label="Return types">
            <Select mode="multiple" options={RETURN_TYPES} placeholder="None" />
          </Form.Item>
        </Col>
        <Col xs={12} md={6}>
          <Form.Item name="gstRate" label="GST rate">
            <Select options={[0, 5, 12, 18, 28].map((r) => ({ value: r, label: `${r}%` }))} />
          </Form.Item>
        </Col>
        <Col xs={12} md={6}>
          <Form.Item
            name="commissionPct"
            label="Commission"
            extra={canEditCommission ? commissionHint : `${commissionHint} Changing it needs the Commission & fees edit permission.`}
          >
            <InputNumber min={0} max={40} step={0.5} precision={2} placeholder="Inherit" disabled={!canEditCommission} style={{ width: '100%' }} addonAfter="%" />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={12}>
        <Col xs={24} md={12}>
          <Form.Item name="hsnCode" label="Default HSN code">
            <Select showSearch allowClear optionFilterProp="label" options={hsnOptions} />
          </Form.Item>
        </Col>
        <Col xs={12} md={6}>
          <Form.Item
            name="gated"
            label="Gated"
            valuePropName="checked"
            extra="Needs brand or licence approval"
          >
            <Switch />
          </Form.Item>
        </Col>
        <Col xs={12} md={6}>
          <Form.Item name="codAllowed" label="COD allowed" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
      </Row>
    </>
  );
}
