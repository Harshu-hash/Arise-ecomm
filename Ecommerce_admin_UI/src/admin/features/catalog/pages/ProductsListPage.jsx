import { Flex, Space, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { statusOptions } from '@ui/constants/statusMaps';
import DataTable from '@ui/components/DataTable/DataTable';
import FilterBar from '@ui/components/FilterBar';
import MoneyText from '@ui/components/MoneyText';
import PageHeader from '@ui/components/PageHeader';
import StatusTag from '@ui/components/StatusTag';
import useListQuery from '@ui/hooks/useListQuery';
import useUrlTableState from '@ui/hooks/useUrlTableState';
import { catalogKeys } from '../api/catalog.api';
import { productColumns } from '../qcColumns';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'LIVE', label: 'Live' },
  { key: 'QC_PENDING', label: 'QC pending' },
  { key: 'NEEDS_CHANGES', label: 'Needs changes' },
  { key: 'OUT_OF_STOCK', label: 'Out of stock' },
  { key: 'INACTIVE', label: 'Inactive' },
  { key: 'BLOCKED', label: 'Blocked' },
  { key: 'ARCHIVED', label: 'Archived' },
];

export default function ProductsListPage() {
  const navigate = useNavigate();
  const state = useUrlTableState({ defaultSort: '-updatedAt' });

  const { rows, meta, loading, error, refetch, fetching } = useListQuery({
    queryKey: catalogKeys.products({ ...state.queryParams, tab: state.tab }),
    url: '/products',
    params: { ...state.queryParams, ...(state.tab ? { status: state.tab } : {}) },
  });

  return (
    <Flex vertical gap={12}>
      <PageHeader
        title="Products"
        breadcrumbs={[{ label: 'Catalog' }, { label: 'Products' }]}
        subtitle="One catalog page per product, with every seller's offer competing on it."
      />

      <FilterBar
        schema={[
          { key: 'status', label: 'Status', kind: 'multiSelect', options: statusOptions('listing'), width: 200 },
          { key: 'categoryId', label: 'Category', kind: 'entity', entity: 'category', width: 200 },
          { key: 'brandId', label: 'Brand', kind: 'entity', entity: 'brand', width: 180 },
          { key: 'sellerId', label: 'Seller', kind: 'entity', entity: 'seller', width: 200 },
          {
            key: 'stock', label: 'Stock', kind: 'select', width: 150,
            options: [
              { value: 'OUT', label: 'Out of stock' },
              { value: 'LOW', label: 'Low (under 20)' },
              { value: 'OK', label: 'In stock' },
            ],
          },
          { key: 'assured', label: 'Assured only', kind: 'boolean' },
        ]}
        tableState={state}
        searchPlaceholder="Search title, brand or product ID"
      />

      <DataTable
        tableId="products"
        columns={productColumns}
        rows={rows}
        meta={meta}
        loading={loading || fetching}
        error={error}
        onRetry={refetch}
        tableState={state}
        tabs={TABS}
        onRowClick={(row) => navigate(`/catalog/products/${row.id}`)}
        onExport={() => {}}
        exportPerm="catalog.product.export"
        emptyProps={{ title: 'No products match' }}
        mobileCard={(row) => (
          <Flex vertical gap={6}>
            <Flex justify="space-between" align="flex-start" gap={8}>
              <div style={{ minWidth: 0 }}>
                <Typography.Text strong>{row.title}</Typography.Text>
                <div>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {row.brandName} · {row.sellerCount} seller{row.sellerCount === 1 ? '' : 's'}
                  </Typography.Text>
                </div>
              </div>
              <StatusTag domain="listing" code={row.status} />
            </Flex>
            <Space size={8} wrap>
              {row.minPricePaise !== null && <MoneyText paise={row.minPricePaise} strong />}
              <Tag color={row.totalStock === 0 ? 'red' : undefined} style={{ marginInlineEnd: 0 }}>
                {row.totalStock} in stock
              </Tag>
            </Space>
          </Flex>
        )}
      />
    </Flex>
  );
}
