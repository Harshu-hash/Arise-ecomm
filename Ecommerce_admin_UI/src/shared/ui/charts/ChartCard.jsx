import { Card, Empty, Skeleton } from 'antd';

/**
 * Consistent Card chrome for every analytics widget: title, optional extra
 * control, a skeleton while loading and an empty state when there is no data.
 */
export default function ChartCard({
  title,
  extra,
  loading,
  isEmpty,
  emptyText = 'No data for this range',
  height,
  bodyPadding,
  children,
}) {
  return (
    <Card
      size="small"
      title={title}
      extra={extra}
      style={{ height: '100%' }}
      styles={bodyPadding !== undefined ? { body: { padding: bodyPadding } } : undefined}
    >
      {loading ? (
        <Skeleton active paragraph={{ rows: 5 }} />
      ) : isEmpty ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} style={{ margin: height ? `${height / 2 - 40}px 0` : '32px 0' }} />
      ) : (
        children
      )}
    </Card>
  );
}
