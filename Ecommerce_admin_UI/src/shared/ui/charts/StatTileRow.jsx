import { Col, Row } from 'antd';
import StatCard from '@ui/components/StatCard';

/**
 * A responsive band of KPI tiles driven by a plain data array, so an analytics
 * panel can declare its headline metrics without repeating grid markup.
 *
 * `items`: [{ label, value?, valuePaise?, format?, deltaPct?, invertDelta? }]
 */
export default function StatTileRow({ items = [], loading }) {
  return (
    <Row gutter={[12, 12]}>
      {items.map((item, i) => (
        <Col key={item.label ?? i} xs={12} sm={12} md={8} lg={6} xxl={4}>
          <StatCard
            loading={loading}
            label={item.label}
            value={item.value}
            valuePaise={item.valuePaise}
            format={item.format ?? 'number'}
            deltaPct={item.deltaPct}
            invertDelta={item.invertDelta}
          />
        </Col>
      ))}
    </Row>
  );
}
