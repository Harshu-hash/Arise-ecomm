import { Button, Flex, Tag, Tooltip, Typography } from 'antd';
import { formatDate } from '@core/utils/date';
import MoneyText from '@ui/components/MoneyText';

const DOT_COLOR = { g: 'var(--ant-color-success)', a: 'var(--ant-color-warning)', r: 'var(--ant-color-error)' };

export const STATE_META = {
  WINDOW_OPEN: { label: 'In return window', color: 'gold' },
  HELD: { label: 'Held', color: 'red' },
  READY: { label: 'Ready to pay', color: 'blue' },
  REVIEWED: { label: 'Reviewed', color: 'geekblue' },
  PAYING: { label: 'Paying', color: 'cyan' },
  SETTLED: { label: 'Settled', color: 'green' },
  FAILED: { label: 'Failed', color: 'volcano' },
};

export function SettlementStateTag({ state }) {
  const meta = STATE_META[state] ?? { label: state, color: 'default' };
  return <Tag color={meta.color === 'default' ? undefined : meta.color} style={{ marginInlineEnd: 0 }}>{meta.label}</Tag>;
}

/** The four readiness checks as coloured dots with tooltips. */
export function Dots({ dots = [] }) {
  return (
    <Flex gap={5} align="center">
      {dots.map((d) => (
        <Tooltip key={d.key} title={`${d.label}: ${d.tooltip}`}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: DOT_COLOR[d.dot], display: 'inline-block' }} />
        </Tooltip>
      ))}
    </Flex>
  );
}

/** Short, human description of where the return window stands. */
function windowCell(row) {
  if (row.settled) return <Typography.Text type="secondary">—</Typography.Text>;
  if (!row.returnWindowEndsAt) {
    return <Typography.Text type="secondary" style={{ fontSize: 12 }}>No window</Typography.Text>;
  }
  const ends = new Date(row.returnWindowEndsAt).getTime();
  if (ends > Date.now()) {
    return (
      <Tooltip title={`Opens until ${formatDate(row.returnWindowEndsAt)}`}>
        <Typography.Text type="warning" style={{ fontSize: 12 }}>Open · {row.returnWindowDays}d</Typography.Text>
      </Tooltip>
    );
  }
  return <Typography.Text type="success" style={{ fontSize: 12 }}>Closed</Typography.Text>;
}

/** Columns for the per-order-item settlement console. */
export function makeSettlementColumns({ onOpen }) {
  return [
    {
      key: 'line', title: 'Order item', dataIndex: 'productTitle', alwaysVisible: true,
      render: (title, row) => (
        <div>
          <Typography.Text strong style={{ fontSize: 13 }}>{title}</Typography.Text>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              {row.orderId}{row.sku ? ` · ${row.sku}` : ''}
            </Typography.Text>
          </div>
        </div>
      ),
    },
    { key: 'sellerName', title: 'Seller', dataIndex: 'sellerName', priority: 1 },
    {
      key: 'deliveredAt', title: 'Delivered', dataIndex: 'deliveredAt', sorter: true, priority: 2,
      render: (v) => (v ? <span className="tabular">{formatDate(v)}</span> : '—'),
    },
    { key: 'window', title: 'Return window', priority: 2, render: (_v, row) => windowCell(row) },
    {
      key: 'settledPaise', title: 'Settlement', dataIndex: 'settledPaise', sorter: true, align: 'right',
      render: (v, row) => (
        <Flex vertical align="flex-end" gap={0}>
          <MoneyText paise={v} strong />
          {row.deductionsTotalPaise > 0 && (
            <Typography.Text type="secondary" style={{ fontSize: 11, textDecoration: 'line-through' }}>
              <MoneyText paise={row.quotedPaise} />
            </Typography.Text>
          )}
        </Flex>
      ),
    },
    {
      key: 'reviewed', title: 'Reviewed', dataIndex: 'reviewed', align: 'center', priority: 3,
      render: (v) => (
        <Tag color={v ? 'green' : undefined} style={{ marginInlineEnd: 0 }}>{v ? 'Yes' : 'No'}</Tag>
      ),
    },
    { key: 'state', title: 'Status', dataIndex: 'state', render: (state) => <SettlementStateTag state={state} /> },
    { key: 'checks', title: 'Checks', priority: 2, render: (_v, row) => <Dots dots={row.dots} /> },
    {
      key: 'actions', title: '', align: 'right', priority: 1, width: 130,
      render: (_v, row) => {
        if (row.settled) {
          return <Button size="small" type="text" onClick={() => onOpen(row)}>View</Button>;
        }
        if (row.state === 'FAILED') {
          return <Button size="small" danger onClick={() => onOpen(row)}>Retry</Button>;
        }
        return (
          <Button size="small" type={row.ready ? 'primary' : 'text'} onClick={() => onOpen(row)}>
            {row.ready ? 'Review & pay' : 'View'}
          </Button>
        );
      },
    },
  ];
}
