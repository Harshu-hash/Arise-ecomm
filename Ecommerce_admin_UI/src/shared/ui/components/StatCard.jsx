import { ArrowDownOutlined, ArrowUpOutlined, MinusOutlined } from '@ant-design/icons';
import { Card, Flex, Skeleton, Space, Tooltip, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { formatINRCompact, formatNumber, formatPercent } from '@core/utils/money';
import { glossify } from '@ui/utils/glossify';

/**
 * KPI tile with a delta against the comparison period.
 *
 * `invertDelta` matters: a rising cancellation rate is bad news, so the arrow
 * stays red even though the number went up.
 */
export default function StatCard({
  label,
  value,
  valuePaise,
  format = 'number',
  deltaPct,
  invertDelta = false,
  comparisonLabel = 'vs previous period',
  to,
  loading,
  extra,
}) {
  if (loading) {
    return (
      <Card size="small" styles={{ body: { padding: 16 } }}>
        <Skeleton active paragraph={{ rows: 1, width: '60%' }} title={{ width: '40%' }} />
      </Card>
    );
  }

  const display =
    format === 'money'
      ? formatINRCompact(valuePaise)
      : format === 'percent'
        ? formatPercent(value)
        : formatNumber(value);

  const up = (deltaPct ?? 0) > 0;
  const flat = !deltaPct;
  const good = invertDelta ? !up : up;

  const body = (
    <Card
      size="small"
      hoverable={Boolean(to)}
      styles={{ body: { padding: 16 } }}
      style={{ height: '100%' }}
    >
      <Flex vertical gap={4}>
        <Typography.Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>
          {glossify(label)}
        </Typography.Text>

        <Typography.Text strong className="tabular" style={{ fontSize: 26, lineHeight: 1.15, fontWeight: 700, letterSpacing: '-0.02em' }}>
          {display}
        </Typography.Text>

        {deltaPct !== null && deltaPct !== undefined && (
          <Tooltip title={comparisonLabel}>
            <Space size={4}>
              <Typography.Text
                style={{ fontSize: 12 }}
                type={flat ? 'secondary' : good ? 'success' : 'danger'}
              >
                {flat ? <MinusOutlined /> : up ? <ArrowUpOutlined /> : <ArrowDownOutlined />}{' '}
                {formatPercent(Math.abs(deltaPct))}
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                {comparisonLabel}
              </Typography.Text>
            </Space>
          </Tooltip>
        )}

        {extra}
      </Flex>
    </Card>
  );

  return to ? (
    <Link to={to} style={{ display: 'block', height: '100%' }}>
      {body}
    </Link>
  ) : (
    body
  );
}
