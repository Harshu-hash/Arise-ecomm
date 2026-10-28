import { Col, Form, InputNumber, Row, Space } from 'antd';

/** Pricing/stock/weight/dimension fields used when the category has no variant-defining attributes. */
export default function SimpleProductFields() {
  return (
    <Row gutter={16} style={{ marginTop: 12 }}>
      <Col xs={24} sm={8}>
        <Form.Item name="mrp" label="MRP (₹)" rules={[{ required: true, message: 'Enter the MRP.' }]}>
          <InputNumber style={{ width: '100%' }} min={1} prefix="₹" />
        </Form.Item>
      </Col>
      <Col xs={24} sm={8}>
        <Form.Item
          name="price"
          label="Selling price (₹)"
          dependencies={['mrp']}
          rules={[
            { required: true, message: 'Enter a selling price.' },
            ({ getFieldValue }) => ({
              validator: (_, v) => (!v || !getFieldValue('mrp') || v <= getFieldValue('mrp') ? Promise.resolve() : Promise.reject(new Error('Cannot exceed MRP.'))),
            }),
          ]}
        >
          <InputNumber style={{ width: '100%' }} min={1} prefix="₹" />
        </Form.Item>
      </Col>
      <Col xs={24} sm={8}>
        <Form.Item name="stock" label="Stock quantity" rules={[{ required: true, message: 'Enter stock.' }]}>
          <InputNumber style={{ width: '100%' }} min={0} />
        </Form.Item>
      </Col>
      <Col xs={24} sm={8}>
        <Form.Item name="weightG" label="Weight (g)">
          <InputNumber style={{ width: '100%' }} min={1} />
        </Form.Item>
      </Col>
      <Col xs={24} sm={16}>
        <Form.Item label="Dimensions L × W × H (cm)">
          <Space.Compact>
            <Form.Item name="dimsL" noStyle><InputNumber style={{ width: '33%' }} min={1} placeholder="L" /></Form.Item>
            <Form.Item name="dimsW" noStyle><InputNumber style={{ width: '33%' }} min={1} placeholder="W" /></Form.Item>
            <Form.Item name="dimsH" noStyle><InputNumber style={{ width: '34%' }} min={1} placeholder="H" /></Form.Item>
          </Space.Compact>
        </Form.Item>
      </Col>
    </Row>
  );
}
