import { App, Button, Col, Flex, Row, Tag, Tooltip, Typography } from 'antd';
import { useMutation, useQuery } from '@tanstack/react-query';
import { queryClient } from '@core/api/queryClient';
import { formatDate } from '@core/utils/date';
import DataTable from '@ui/components/DataTable/DataTable';
import FilterBar from '@ui/components/FilterBar';
import MoneyText from '@ui/components/MoneyText';
import PageHeader from '@ui/components/PageHeader';
import StatCard from '@ui/components/StatCard';
import useListQuery from '@ui/hooks/useListQuery';
import useUrlTableState from '@ui/hooks/useUrlTableState';
import { financeApi, financeKeys } from '../api/finance.api';

const STATE = {
  PENDING: ['Pending', 'gold'],
  HELD: ['Held', 'red'],
  AVAILABLE: ['In seller wallet', 'green'],
  REVERSED: ['Returned', undefined],
};
const STATE_OPTIONS = Object.entries(STATE).map(([value, [label]]) => ({ value, label }));

/**
 * Every delivered item across sellers and where its money stands (read only). Money reaches sellers through their wallets and
 * withdrawals; this is the trail behind a wallet's balance.
 */
export default function SellerSettlementsPage() {
  const state = useUrlTableState({ defaultSort: '-deliveredAt', defaultPageSize: 25 });
  const summary = useQuery({ queryKey: financeKeys.settlementSummary, queryFn: () => financeApi.settlementSummary().then((r) => r.data) });
  const { rows, meta, loading, error, refetch, fetching } = useListQuery({
    queryKey: financeKeys.settlements(state.queryParams),
    url: '/settlements',
    params: state.queryParams,
  });
  const s = summary.data ?? {};
  const { message, modal } = App.useApp();
  const remit = useMutation({
    mutationFn: (id) => financeApi.markCodRemitted([id]),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['finance'] }); message.success('Marked as received. It will be released to the seller\'s wallet.'); },
    onError: (e) => message.error(e.message),
  });
  const askRemit = (row) => modal.confirm({
    title: 'Cash received from the courier?',
    content: `Confirm the courier has paid Arise the cash for ${row.orderId} (${row.productTitle}). Its earnings then move to ${row.sellerName}'s wallet once the return window closes.`,
    okText: 'Cash received',
    onOk: () => remit.mutateAsync(row.id).catch(() => {}),
  });

  const columns = [
    {
      key: 'line', title: 'Order item', dataIndex: 'productTitle', alwaysVisible: true,
      render: (title, row) => (
        <div>
          <Typography.Text strong style={{ fontSize: 13 }}>{title}</Typography.Text>
          <div><Typography.Text type="secondary" className="mono" style={{ fontSize: 11 }}>{row.orderId} · {row.customerName}</Typography.Text></div>
        </div>
      ),
    },
    { key: 'sellerName', title: 'Seller', dataIndex: 'sellerName', priority: 1 },
    { key: 'deliveredAt', title: 'Delivered', dataIndex: 'deliveredAt', sorter: true, priority: 2, render: (v) => (v ? formatDate(v) : '—') },
    {
      key: 'releaseAt', title: 'Releases', dataIndex: 'releaseAt', sorter: true, priority: 2,
      render: (v, row) => (row.releasedAt || row.reversedAt ? <Typography.Text type="secondary">—</Typography.Text> : v ? formatDate(v) : '—'),
    },
    { key: 'salePaise', title: 'Sale', dataIndex: 'salePaise', align: 'right', sorter: true, priority: 3, render: (p) => <MoneyText paise={p} /> },
    {
      key: 'fees', title: 'Fees + taxes', align: 'right', priority: 3,
      render: (_v, row) => <MoneyText paise={(row.feesBeforeTaxPaise ?? 0) + (row.gstOnFeesPaise ?? 0) + (row.tcsPaise ?? 0) + (row.tdsPaise ?? 0)} />,
    },
    { key: 'netPaise', title: 'Seller earns', dataIndex: 'netPaise', align: 'right', sorter: true, render: (p) => <MoneyText paise={p} strong colorBySign /> },
    {
      key: 'state', title: 'Status', dataIndex: 'state',
      render: (v, row) => {
        const [label, color] = STATE[v] ?? [v];
        const tag = <Tag color={color} style={{ marginInlineEnd: 0 }}>{label}</Tag>;
        return row.holdReason ? <Tooltip title={row.holdReason}>{tag}</Tooltip> : tag;
      },
    },
    {
      key: 'actions', title: '', align: 'right', alwaysVisible: true,
      render: (_v, row) => (row.codPending ? <Button size="small" onClick={() => askRemit(row)}>Cash received</Button> : null),
    },
  ];

  return (
    <Flex vertical gap={16}>
      <PageHeader
        title="Seller settlements"
        breadcrumbs={[{ label: 'Finance' }, { label: 'Seller settlements' }]}
        subtitle="One line per delivered item. Money is pending until the return window closes, then it moves to the seller's wallet."
      />

      <Row gutter={[12, 12]}>
        <Col xs={12} md={6}><StatCard label="Owed to sellers" valuePaise={s.owedToSellersPaise} format="money" loading={summary.isLoading} /></Col>
        <Col xs={12} md={6}><StatCard label="Pending (return window)" valuePaise={s.pendingPaise} format="money" loading={summary.isLoading} /></Col>
        <Col xs={12} md={6}><StatCard label="Available in wallets" valuePaise={s.availablePaise} format="money" loading={summary.isLoading} /></Col>
        <Col xs={12} md={6}><StatCard label="Withdrawn so far" valuePaise={s.withdrawnPaise} format="money" loading={summary.isLoading} /></Col>
      </Row>

      <FilterBar
        schema={[
          { key: 'state', label: 'Status', kind: 'select', width: 200, options: STATE_OPTIONS },
          { key: 'paymentMethod', label: 'Payment', kind: 'select', options: [{ value: 'UPI', label: 'UPI' }, { value: 'CARD', label: 'Card' }, { value: 'COD', label: 'Cash on delivery' }] },
        ]}
        tableState={state}
        searchPlaceholder="Search order, item, seller, customer"
      />

      <DataTable
        tableId="seller-settlements"
        columns={columns}
        rows={rows}
        meta={meta}
        loading={loading || fetching}
        error={error}
        onRetry={refetch}
        tableState={state}
        emptyProps={{ title: 'No settlements match' }}
        mobileCard={(row) => (
          <Flex vertical gap={4}>
            <Flex justify="space-between" gap={8}>
              <Typography.Text strong style={{ fontSize: 13 }}>{row.productTitle}</Typography.Text>
              <MoneyText paise={row.netPaise} strong colorBySign />
            </Flex>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>{row.sellerName} · {row.orderId}</Typography.Text>
            <Tag color={(STATE[row.state] ?? [])[1]} style={{ marginInlineEnd: 0, alignSelf: 'flex-start' }}>{(STATE[row.state] ?? [row.state])[0]}</Tag>
            {row.codPending ? <Button size="small" style={{ alignSelf: 'flex-start' }} onClick={() => askRemit(row)}>Cash received</Button> : null}
          </Flex>
        )}
      />
    </Flex>
  );
}
