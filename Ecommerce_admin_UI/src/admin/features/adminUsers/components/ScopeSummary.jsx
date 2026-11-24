import { Space, Tag, Typography } from 'antd';
import { formatINR } from '@core/utils/money';

/** Condensed description of an admin's data scope. */
export default function ScopeSummary({ scope, scopedBy }) {
  if (!scopedBy?.length) return <Typography.Text type="secondary">Unrestricted</Typography.Text>;

  const parts = [];
  if (scope?.categories?.length) parts.push(`${scope.categories.length} categories`);
  if (scope?.sellers?.length) parts.push(`${scope.sellers.length} sellers`);
  if (scope?.refundLimit) parts.push(`refunds up to ${formatINR(scope.refundLimit)}`);
  if (scope?.walletAdjustLimit) parts.push(`wallet up to ${formatINR(scope.walletAdjustLimit)}`);

  if (!parts.length) {
    return <Typography.Text type="secondary">Unrestricted on all dimensions</Typography.Text>;
  }

  return (
    <Space size={[4, 4]} wrap>
      {parts.map((p) => (
        <Tag key={p} style={{ marginInlineEnd: 0 }}>
          {p}
        </Tag>
      ))}
    </Space>
  );
}
