import { Flex, Tag, Typography } from 'antd';
import { useQueryClient } from '@tanstack/react-query';
import { formatDate } from '@core/utils/date';
import DataTable from '@ui/components/DataTable/DataTable';
import FilterBar from '@ui/components/FilterBar';
import MoneyText from '@ui/components/MoneyText';
import PageHeader from '@ui/components/PageHeader';
import useListQuery from '@ui/hooks/useListQuery';
import useUrlTableState from '@ui/hooks/useUrlTableState';
import { financeKeys } from '../api/finance.api';
import { INVOICE_TYPE, InvoiceActions } from '../components/InvoiceList';

const TYPE_OPTIONS = Object.entries(INVOICE_TYPE).map(([value, [label]]) => ({ value, label }));

/** Every tax document on the platform: seller invoices and bills of supply, Arise's platform-fee invoices, and credit notes. */
export default function InvoicesPage() {
  const state = useUrlTableState({ defaultSort: '-issuedAt', defaultPageSize: 25 });
  const queryClient = useQueryClient();
  const { rows, meta, loading, error, refetch, fetching } = useListQuery({ queryKey: financeKeys.invoices(state.queryParams), url: '/invoices', params: state.queryParams });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['finance', 'invoices'] });

  const columns = [
    {
      key: 'number', title: 'Number', dataIndex: 'number', alwaysVisible: true,
      render: (v, row) => (
        <div>
          <Typography.Text strong>{v}</Typography.Text>
          {row.refNumber && <div><Typography.Text type="secondary" style={{ fontSize: 11 }}>against {row.refNumber}</Typography.Text></div>}
        </div>
      ),
    },
    {
      key: 'type', title: 'Type', dataIndex: 'type',
      render: (v, row) => (
        <Flex gap={4} wrap>
          <Tag color={INVOICE_TYPE[v]?.[1]} style={{ marginInlineEnd: 0 }}>{INVOICE_TYPE[v]?.[0] ?? v}</Tag>
          {row.superseded && <Tag color="gold" style={{ marginInlineEnd: 0 }}>Superseded</Tag>}
        </Flex>
      ),
    },
    { key: 'orderNumber', title: 'Order', dataIndex: 'orderNumber' },
    {
      key: 'supplierName', title: 'Supplier', dataIndex: 'supplierName', priority: 2,
      render: (v, row) => <div>{v}<div><Typography.Text type="secondary" style={{ fontSize: 11 }}>{row.supplierGstin ?? 'No GSTIN'}</Typography.Text></div></div>,
    },
    { key: 'placeOfSupply', title: 'Place of supply', dataIndex: 'placeOfSupply', priority: 3 },
    { key: 'issuedAt', title: 'Issued', dataIndex: 'issuedAt', priority: 2, render: (v) => formatDate(v) },
    { key: 'taxablePaise', title: 'Taxable', dataIndex: 'taxablePaise', align: 'right', priority: 3, render: (p) => <MoneyText paise={p} /> },
    { key: 'taxPaise', title: 'GST', dataIndex: 'taxPaise', align: 'right', priority: 3, render: (p) => <MoneyText paise={p} /> },
    { key: 'totalPaise', title: 'Total', dataIndex: 'totalPaise', align: 'right', render: (p) => <MoneyText paise={p} strong /> },
    { key: 'actions', title: '', align: 'right', render: (_v, row) => <InvoiceActions row={row} onChanged={refresh} /> },
  ];

  return (
    <Flex vertical gap={16}>
      <PageHeader
        title="Invoices"
        breadcrumbs={[{ label: 'Finance' }, { label: 'Invoices' }]}
        subtitle="Tax invoices, bills of supply and credit notes. A wrong invoice is never edited: re-generate it and the original stays on record."
      />
      <FilterBar
        schema={[{ key: 'type', label: 'Type', kind: 'select', options: TYPE_OPTIONS }]}
        tableState={state}
        searchPlaceholder="Number, order, supplier or GSTIN"
      />
      <DataTable
        tableId="admin-invoices"
        columns={columns}
        rows={rows}
        meta={meta}
        loading={loading || fetching}
        error={error}
        onRetry={refetch}
        tableState={state}
        emptyProps={{ title: 'No invoices yet' }}
      />
    </Flex>
  );
}
