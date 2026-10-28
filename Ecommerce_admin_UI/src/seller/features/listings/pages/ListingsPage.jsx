import { PlusOutlined, UploadOutlined } from '@ant-design/icons';
import { Button, Flex, Space, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { statusOptions } from '@ui/constants/statusMaps';
import { Can } from '@core/rbac/Can';
import DataTable from '@ui/components/DataTable/DataTable';
import FilterBar from '@ui/components/FilterBar';
import MoneyText from '@ui/components/MoneyText';
import PageHeader from '@ui/components/PageHeader';
import StatusTag from '@ui/components/StatusTag';
import useListQuery from '@ui/hooks/useListQuery';
import useUrlTableState from '@ui/hooks/useUrlTableState';
import { listingKeys } from '../api/listings.api';
import { listingColumns } from '../listingColumns';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'LIVE', label: 'Live' },
  { key: 'QC_PENDING', label: 'In QC' },
  { key: 'NEEDS_CHANGES', label: 'Needs changes' },
  { key: 'OUT_OF_STOCK', label: 'Out of stock' },
  { key: 'INACTIVE', label: 'Inactive' },
];

export default function ListingsPage() {
  const navigate = useNavigate();
  const state = useUrlTableState({ defaultSort: '-updatedAt' });

  const { rows, meta, loading, error, refetch, fetching } = useListQuery({
    queryKey: listingKeys.list({ ...state.queryParams, tab: state.tab }),
    url: '/listings',
    params: { ...state.queryParams, ...(state.tab && state.tab !== 'all' ? { status: state.tab } : {}) },
  });

  return (
    <Flex vertical gap={12}>
      <PageHeader
        title="My Listings"
        breadcrumbs={[{ label: 'Listings' }, { label: 'My Listings' }]}
        subtitle="Everything you sell on Arise, with its QC and buy-box status."
        actions={
          <Space>
            <Can perm="listings.product.create">
              <Button icon={<UploadOutlined />} onClick={() => navigate('/listings/bulk')}>
                Bulk upload
              </Button>
            </Can>
            <Can perm="listings.product.create">
              <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/listings/new')}>
                Add product
              </Button>
            </Can>
          </Space>
        }
      />

      <FilterBar
        schema={[
          { key: 'status', label: 'Status', kind: 'multiSelect', options: statusOptions('listing'), width: 220 },
          {
            key: 'fulfillmentType', label: 'Fulfilment', kind: 'select', width: 160,
            options: [
              { value: 'SELLER', label: 'Self-ship' },
              { value: 'ARISE', label: 'Fulfilled by Arise' },
            ],
          },
        ]}
        tableState={state}
        searchPlaceholder="Search title, SKU or brand"
      />

      <DataTable
        tableId="seller-listings"
        columns={listingColumns}
        rows={rows}
        meta={meta}
        loading={loading || fetching}
        error={error}
        onRetry={refetch}
        tableState={state}
        tabs={TABS}
        onRowClick={(row) => navigate(`/listings/${row.id}`)}
        emptyProps={{ title: 'No listings yet', description: 'Add your first product to start selling.' }}
        mobileCard={(row) => (
          <Flex vertical gap={6}>
            <Flex justify="space-between" align="flex-start" gap={8}>
              <div style={{ minWidth: 0 }}>
                <Typography.Text strong>{row.productTitle}</Typography.Text>
                <div>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {[row.brandName, row.sku].filter(Boolean).join(' · ')}
                  </Typography.Text>
                </div>
              </div>
              <StatusTag domain="listing" code={row.status} />
            </Flex>
            <Space size={8} wrap>
              <MoneyText paise={row.sellingPricePaise} strong />
              <Tag color={row.stock === 0 ? 'red' : undefined} style={{ marginInlineEnd: 0 }}>
                {row.stock} in stock
              </Tag>
              {row.needsChanges && <Tag color="gold">Action needed</Tag>}
            </Space>
          </Flex>
        )}
      />
    </Flex>
  );
}
