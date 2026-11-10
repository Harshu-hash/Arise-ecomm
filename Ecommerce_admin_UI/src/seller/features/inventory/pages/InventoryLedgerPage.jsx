import { Button, Card, Descriptions, Flex, Table, Tag } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import ErrorState from '@ui/components/ErrorState';
import FullPageSpinner from '@ui/components/FullPageSpinner';
import PageHeader from '@ui/components/PageHeader';
import { inventoryApi, inventoryKeys } from '../api/inventory.api';

const COLORS = { RECEIPT: 'green', RESERVATION: 'blue', RELEASE: 'cyan', ADJUSTMENT: 'gold', RETURN: 'purple', DAMAGE: 'red', REMOVAL: 'volcano' };

export default function InventoryLedgerPage() {
  const { inventoryId } = useParams();
  const navigate = useNavigate();
  const query = useQuery({ queryKey: inventoryKeys.ledger(inventoryId), queryFn: () => inventoryApi.ledger(inventoryId) });
  if (query.isLoading) return <FullPageSpinner label="Loading inventory ledger…" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />;
  const { inventory, entries } = query.data;
  return <Flex vertical gap={16}>
    <PageHeader title={`Inventory ledger — ${inventory.sku}`} breadcrumbs={[{ label: 'Inventory', path: '/inventory' }, { label: inventory.sku }]} actions={<Button onClick={() => navigate('/inventory')}>Back</Button>} />
    <Card><Descriptions size="small" column={{ xs: 1, md: 4 }} items={[
      { key: 'product', label: 'Product', children: inventory.productTitle },
      { key: 'warehouse', label: 'Warehouse', children: inventory.warehouseCode },
      { key: 'fulfilment', label: 'Fulfilment', children: inventory.fulfillmentType === 'SELLER' ? 'Self-ship' : 'FBA' },
      { key: 'balance', label: 'Available', children: `${inventory.available} (${inventory.reserved} reserved)` },
    ]} /></Card>
    <Table rowKey="id" dataSource={entries} pagination={{ pageSize: 20 }} columns={[
      { title: 'When', dataIndex: 'at', render: (v) => new Date(v).toLocaleString() },
      { title: 'Movement', dataIndex: 'type', render: (v) => <Tag color={COLORS[v]}>{v}</Tag> },
      { title: 'Quantity', dataIndex: 'qty', align: 'right', render: (v) => v > 0 ? `+${v}` : v },
      { title: 'Balance', dataIndex: 'balanceAfter', align: 'right' },
      { title: 'Reference', dataIndex: 'reference' },
      { title: 'Note', dataIndex: 'note' },
    ]} />
  </Flex>;
}
