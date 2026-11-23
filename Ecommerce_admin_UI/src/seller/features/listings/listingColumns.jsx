import { CrownFilled } from '@ant-design/icons';
import { Avatar, Button, Flex, Modal, Table, Tag, Tooltip, Typography } from 'antd';
import { useState } from 'react';
import CampaignTag from '@ui/components/CampaignTag';
import MoneyText from '@ui/components/MoneyText';
import StatusTag from '@ui/components/StatusTag';

/** The variant count; clicking it opens that product's variants (price, stock, status). */
function VariantsCell({ count, row }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="link"
        onClick={(e) => {
          e.stopPropagation(); // don't open the product page
          setOpen(true);
        }}
      >
        {count}
      </Button>
      {/* The modal renders in a portal but React bubbles its clicks to the table row. */}
      <span role="presentation" onClick={(e) => e.stopPropagation()}>
        <Modal
          title={`${row.productTitle} — variants`}
          open={open}
          onCancel={() => setOpen(false)}
          footer={null}
          width={720}
        >
          <Table
            size="small"
            rowKey="offerId"
            pagination={false}
            scroll={{ x: true }}
            dataSource={row.variants}
            columns={[
              {
                title: 'Variant',
                render: (_, v) => (
                  <div>
                    <Typography.Text strong>{v.label ?? 'Default'}</Typography.Text>
                    <div>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>{v.sku}</Typography.Text>
                    </div>
                  </div>
                ),
              },
              {
                title: 'Price',
                align: 'right',
                render: (_, v) => (
                  <>
                    <MoneyText paise={v.sellingPricePaise} strong />
                    <div><CampaignTag campaign={v.campaign} /></div>
                    {v.mrpPaise > v.sellingPricePaise && (
                      <div>
                        <Typography.Text delete type="secondary" style={{ fontSize: 11 }}>
                          <MoneyText paise={v.mrpPaise} type="secondary" />
                        </Typography.Text>
                      </div>
                    )}
                  </>
                ),
              },
              {
                title: 'Stock',
                dataIndex: 'stock',
                align: 'right',
                render: (stock) => (
                  <Typography.Text type={stock === 0 ? 'danger' : stock < 20 ? 'warning' : undefined}>{stock}</Typography.Text>
                ),
              },
              { title: 'Status', dataIndex: 'status', render: (status) => <StatusTag domain="listing" code={status} /> },
            ]}
          />
        </Modal>
      </span>
    </>
  );
}

/** Columns for the seller's My Listings table. */
export const listingColumns = [
  {
    key: 'productTitle',
    title: 'Product',
    dataIndex: 'productTitle',
    priority: 1,
    render: (title, row) => (
      <Flex gap={10} align="center" style={{ minWidth: 0 }}>
        <Avatar
          shape="square"
          size={40}
          src={row.productImage}
          style={{ flexShrink: 0, background: '#f0f0f0' }}
        >
          {title?.[0]}
        </Avatar>
        <div style={{ minWidth: 0 }}>
          <Typography.Text strong ellipsis style={{ display: 'block', maxWidth: 320 }}>
            {title}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {[row.brandName, row.variantLabel, row.sku].filter(Boolean).join(' · ')}
          </Typography.Text>
          {row.campaign && <div><CampaignTag campaign={row.campaign} /></div>}
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
            <Tag color="gold" style={{ margin: 0 }}>
              Action needed
            </Tag>
          </Tooltip>
        )}
      </Flex>
    ),
  },
  {
    key: 'variants',
    title: 'Variants',
    dataIndex: 'variantCount',
    align: 'center',
    priority: 1,
    width: 110,
    render: (count, row) => <VariantsCell count={count} row={row} />,
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
          <Tag color="green" icon={<CrownFilled />} style={{ margin: 0 }}>
            Winning
          </Tag>
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
    render: (ft) => (
      <Tag color={ft === 'ARISE' ? 'geekblue' : 'default'} style={{ margin: 0 }}>
        {ft === 'ARISE' ? 'By Arise' : 'Self-ship'}
      </Tag>
    ),
  },
];
