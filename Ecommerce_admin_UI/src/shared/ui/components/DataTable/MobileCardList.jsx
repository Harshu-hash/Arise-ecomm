import { Card, Flex, Pagination, Skeleton, Space } from 'antd';

/**
 * Below 768px a dense table is unusable, so each row becomes a card. Modules
 * supply a `render(row)` that puts the two or three fields that matter on a
 * phone up front — this is why columns carry a `priority`.
 */
export default function MobileCardList({
  rows,
  rowKey,
  loading,
  render,
  onRowClick,
  empty,
  page,
  pageSize,
  total,
  onPageChange,
}) {
  const accessibleRowName = (row) => `Open ${row.name ?? row.title ?? row[rowKey]}`;

  if (loading) {
    return (
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} size="small">
            <Skeleton active paragraph={{ rows: 2 }} title={{ width: '45%' }} />
          </Card>
        ))}
      </Space>
    );
  }

  if (!rows.length) return <Card variant="borderless">{empty}</Card>;

  return (
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      {rows.map((row) => (
        <Card
          key={row[rowKey]}
          size="small"
          hoverable={Boolean(onRowClick)}
          role={onRowClick ? 'button' : undefined}
          tabIndex={onRowClick ? 0 : undefined}
          aria-label={onRowClick ? accessibleRowName(row) : undefined}
          onClick={onRowClick ? () => onRowClick(row) : undefined}
          onKeyDown={onRowClick ? (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onRowClick(row);
            }
          } : undefined}
          styles={{ body: { padding: 12 } }}
        >
          {render(row)}
        </Card>
      ))}

      <Flex justify="center" style={{ padding: '8px 0 4px' }}>
        <Pagination
          simple
          current={page}
          pageSize={pageSize}
          total={total}
          onChange={(p, ps) => onPageChange?.(p, ps)}
        />
      </Flex>
    </Space>
  );
}
