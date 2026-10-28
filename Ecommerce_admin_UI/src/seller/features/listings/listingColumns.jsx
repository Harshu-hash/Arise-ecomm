import { CrownFilled } from '@ant-design/icons';
import { Avatar, Flex, Tag, Tooltip, Typography } from 'antd';
import MoneyText from '@ui/components/MoneyText';
import StatusTag from '@ui/components/StatusTag';

/** Columns for the seller's My Listings table. */
export const listingColumns = [
  {
    key: 'productTitle',
    title: 'Product',
    dataIndex: 'productTitle',
    priority: 1,
    render: (title, row) => (
      <Flex gap={10} align="center" style={{ minWidth: 0 }}>
        <Avatar shape="square" size={40} src={row.productImage} style={{ flexShrink: 0, background: '#f0f0f0' }}>
          {title?.[0]}
        </Avatar>
        <div style={{ minWidth: 0 }}>
          <Typography.Text strong ellipsis style={{ display: 'block', maxWidth: 320 }}>
            {title}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {[row.brandName, row.variantLabel, row.sku].filter(Boolean).join(' · ')}
          </Typography.Text>
        </div>
      </Flex>
    ),
  },
  {
    key: 'status',
    title: 'Status',
    dataIndex: 'status',
    priority: 1,
    width: 150,
    render: (status, row) => (
      <Flex gap={6} align="center">
        <StatusTag domain="listing" code={status} />
        {row.needsChanges && (
          <Tooltip title="QC asked for changes — open to see why and resubmit.">
            <Tag color="gold" style={{ margin: 0 }}>Action needed</Tag>
          </Tooltip>
        )}
      </Flex>
    ),
  },
  {
    key: 'sellingPricePaise',
    title: 'Price',
    dataIndex: 'sellingPricePaise',
    align: 'right',
    priority: 1,
    width: 120,
    sorter: true,
    render: (paise, row) => (
      <div>
        <MoneyText paise={paise} strong />
        {row.mrpPaise > paise && (
          <div>
            <Typography.Text delete type="secondary" style={{ fontSize: 11 }}>
              <MoneyText paise={row.mrpPaise} type="secondary" />
            </Typography.Text>
          </div>
        )}
      </div>
    ),
  },
  {
    key: 'stock',
    title: 'Stock',
    dataIndex: 'stock',
    align: 'right',
    priority: 2,
    width: 90,
    sorter: true,
    render: (stock) => (
      <Typography.Text type={stock === 0 ? 'danger' : stock < 20 ? 'warning' : undefined}>{stock}</Typography.Text>
    ),
  },
  {
    key: 'buyBox',
    title: 'Buy box',
    dataIndex: 'buyBoxWinner',
    align: 'center',
    priority: 3,
    width: 100,
    render: (won) =>
      won ? (
        <Tooltip title="You are winning the buy box on this variant.">
          <Tag color="green" icon={<CrownFilled />} style={{ margin: 0 }}>Winning</Tag>
        </Tooltip>
      ) : (
        <Typography.Text type="secondary">—</Typography.Text>
      ),
  },
  {
    key: 'fulfillmentType',
    title: 'Fulfilment',
    dataIndex: 'fulfillmentType',
    align: 'center',
    priority: 3,
    width: 110,
    render: (ft) => <Tag color={ft === 'ARISE' ? 'geekblue' : 'default'} style={{ margin: 0 }}>{ft === 'ARISE' ? 'By Arise' : 'Self-ship'}</Tag>,
  },
];
