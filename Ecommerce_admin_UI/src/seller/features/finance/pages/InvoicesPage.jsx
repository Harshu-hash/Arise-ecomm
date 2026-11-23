import { App, Button, Flex, Tag, Typography } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { downloadBlob } from '@core/utils/misc';
import { formatDate } from '@core/utils/date';
import DataTable from '@ui/components/DataTable/DataTable';
import MoneyText from '@ui/components/MoneyText';
import PageHeader from '@ui/components/PageHeader';
import useListQuery from '@ui/hooks/useListQuery';
import useUrlTableState from '@ui/hooks/useUrlTableState';
import { financeApi, financeKeys } from '../api/finance.api';

const TYPE = { TAX_INVOICE: ['Tax invoice', 'blue'], BILL_OF_SUPPLY: ['Bill of supply', 'default'], CREDIT_NOTE: ['Credit note', 'volcano'] };

/** The seller's own tax documents: an invoice per parcel (issued at ready-to-ship) and the credit notes that reverse them. */
export default function InvoicesPage() {
  const { message } = App.useApp();
  const state = useUrlTableState({ defaultSort: '-issuedAt', defaultPageSize: 25 });
  const { rows, meta, loading, error, refetch, fetching } = useListQuery({ queryKey: financeKeys.invoices(state.queryParams), url: '/finance/invoices', params: state.queryParams });

  const download = async (row) => {
    try {
      downloadBlob(await financeApi.downloadInvoice(row.id), `${row.invoiceNo.replaceAll('/', '-')}.pdf`);
    } catch (e) {
      message.error(e?.message ?? 'Download failed.');
    }
  };

  const columns = [
    { key: 'invoiceNo', title: 'Number', dataIndex: 'invoiceNo', alwaysVisible: true, render: (v, row) => <div><Typography.Text strong>{v}</Typography.Text>{row.refNumber && <div><Typography.Text type="secondary" style={{ fontSize: 11 }}>against {row.refNumber}</Typography.Text></div>}</div> },
    { key: 'type', title: 'Type', dataIndex: 'type', render: (v, row) => <Flex gap={4} wrap><Tag color={TYPE[v]?.[1] === 'default' ? undefined : TYPE[v]?.[1]} style={{ marginInlineEnd: 0 }}>{TYPE[v]?.[0] ?? v}</Tag>{row.superseded && <Tag color="gold">Superseded</Tag>}</Flex> },
    { key: 'orderId', title: 'Order', dataIndex: 'orderId', priority: 2 },
    { key: 'customerName', title: 'Customer', dataIndex: 'customerName', priority: 3 },
    { key: 'issuedAt', title: 'Issued', dataIndex: 'issuedAt', sorter: true, priority: 2, render: (v) => formatDate(v) },
    { key: 'taxPaise', title: 'GST', dataIndex: 'taxPaise', align: 'right', priority: 3, render: (p) => <MoneyText paise={p} /> },
    { key: 'totalPaise', title: 'Total', dataIndex: 'totalPaise', align: 'right', render: (p) => <MoneyText paise={p} strong /> },
    { key: 'pdf', title: '', align: 'right', render: (_v, row) => <Button size="small" icon={<DownloadOutlined />} onClick={() => download(row)}>PDF</Button> },
  ];

  return (
    <Flex vertical gap={16}>
      <PageHeader title="Invoices" breadcrumbs={[{ label: 'Payments' }, { label: 'Invoices' }]} subtitle="A tax invoice is issued for each order when you make it ready to ship; credit notes appear if Arise cancels it afterwards." />
      <DataTable tableId="seller-invoices" columns={columns} rows={rows} meta={meta} loading={loading || fetching} error={error} onRetry={refetch} tableState={state} emptyProps={{ title: 'No invoices yet' }} />
    </Flex>
  );
}
