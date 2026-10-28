import { ClockCircleOutlined } from '@ant-design/icons';
import { Avatar, Button, Flex, Tag, Tooltip, Typography } from 'antd';
import DateText from '@ui/components/DateText';
import MoneyText from '@ui/components/MoneyText';
import StatusTag from '@ui/components/StatusTag';
import { ACTION_LABELS } from './api/orders.api';

/** Columns for the seller's orders table; `onAction` runs the row's next step. */
export function makeOrderColumns({ onAction, pendingId }) {
  return [
    {
      key: 'orderId',
      title: 'Order',
      dataIndex: 'orderId',
      priority: 1,
      render: (orderId, row) => (
        <div style={{ minWidth: 0 }}>
          <Typography.Text strong>{orderId}</Typography.Text>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              <DateText value={row.placedAt} /> · {row.city ?? '—'}
            </Typography.Text>
          </div>
        </div>
      ),
    },
    {
      key: 'items',
      title: 'Items',
      dataIndex: 'items',
      priority: 2,
      render: (items) => (
        <Flex align="center" gap={6}>
          <Avatar.Group max={{ count: 3 }} size={32}>
            {items.map((it) => (
              <Avatar key={it.id} shape="square" src={it.image} style={{ background: '#f0f0f0' }}>
                {it.name?.[0]}
              </Avatar>
            ))}
          </Avatar.Group>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {items.length} item{items.length === 1 ? '' : 's'}
          </Typography.Text>
        </Flex>
      ),
    },
    {
      key: 'totalPaise',
      title: 'Value',
      dataIndex: 'totalPaise',
      align: 'right',
      priority: 1,
      width: 110,
      sorter: true,
      render: (paise, row) => (
        <div>
          <MoneyText paise={paise} strong />
          <div>
            <Tag color={row.prepaid ? 'green' : 'orange'} style={{ margin: 0, fontSize: 10 }}>
              {row.prepaid ? 'Prepaid' : 'COD'}
            </Tag>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      title: 'Status',
      dataIndex: 'status',
      priority: 1,
      width: 150,
      render: (status, row) => (
        <Flex vertical gap={2}>
          <StatusTag domain="orderItem" code={status} />
          {row.awb && (
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              {row.courierName} · {row.awb}
            </Typography.Text>
          )}
        </Flex>
      ),
    },
    {
      key: 'dispatchByAt',
      title: 'Dispatch by',
      dataIndex: 'dispatchByAt',
      priority: 2,
      width: 140,
      sorter: true,
      render: (by, row) =>
        row.stage === 'NEW' || row.stage === 'PROCESSING' ? (
          <Tag color={row.slaBreached ? 'red' : 'default'} icon={<ClockCircleOutlined />} style={{ margin: 0 }}>
            {row.slaBreached ? 'Overdue' : <DateText value={by} />}
          </Tag>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
    {
      key: 'action',
      title: '',
      priority: 1,
      width: 150,
      render: (_, row) => {
        if (row.fulfillmentType === 'ARISE') {
          return (
            <Tooltip title="Arise picks, packs and ships this order.">
              <Tag color="geekblue" style={{ margin: 0 }}>By Arise</Tag>
            </Tooltip>
          );
        }
        if (!row.nextAction) return <Typography.Text type="secondary">—</Typography.Text>;
        return (
          <Button
            size="small"
            type="primary"
            loading={pendingId === row.id}
            onClick={(e) => {
              e.stopPropagation();
              onAction(row, row.nextAction);
            }}
          >
            {ACTION_LABELS[row.nextAction]}
          </Button>
        );
      },
    },
  ];
}
