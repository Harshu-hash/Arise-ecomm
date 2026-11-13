import { Button, Col, Flex, Row } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from '@ui/components/DataTable/DataTable';
import FilterBar from '@ui/components/FilterBar';
import PageHeader from '@ui/components/PageHeader';
import StatCard from '@ui/components/StatCard';
import useListQuery from '@ui/hooks/useListQuery';
import useUrlTableState from '@ui/hooks/useUrlTableState';
import { financeApi, financeKeys } from '../api/finance.api';
import SettlementDrawer from '../components/SettlementDrawer';
import { STATE_META, makeSettlementColumns } from '../components/settlementColumns';

const STATE_OPTIONS = Object.entries(STATE_META).map(([value, m]) => ({ value, label: m.label }));

/**
 * Seller settlements — the payout flow. The admin pays a seller for each
 * delivered order item, but only once that item's return window has closed and
 * no return, claim or hold is standing in the way.
 */
export default function SellerSettlementsPage() {
  const navigate = useNavigate();
  const state = useUrlTableState({ defaultSort: '-deliveredAt', defaultPageSize: 25 });
  const [openId, setOpenId] = useState(null);

  const summary = useQuery({
    queryKey: financeKeys.settlementSummary,
    queryFn: () => financeApi.settlementSummary().then((r) => r.data),
  });

  const { rows, meta, loading, error, refetch, fetching } = useListQuery({
    queryKey: financeKeys.settlements(state.queryParams),
    url: '/settlements',
    params: state.queryParams,
  });

  const columns = makeSettlementColumns({ onOpen: (row) => setOpenId(row.id) });
  const s = summary.data ?? {};

  return (
    <Flex vertical gap={16}>
      <PageHeader
        title="Seller settlements"
        breadcrumbs={[{ label: 'Finance' }, { label: 'Seller settlements' }]}
        subtitle="One settlement per delivered order item. A seller is paid only after that item's return window closes."
        actions={<Button onClick={() => navigate('/finance/payouts/bulk')}>Bulk settle</Button>}
      />

      <Row gutter={[12, 12]}>
        <Col xs={12} md={8} lg={6} xxl={5}>
          <StatCard label="Payable now" valuePaise={s.payablePaise} format="money" loading={summary.isLoading} extra={countLine(s.payableCount)} />
        </Col>
        <Col xs={12} md={8} lg={6} xxl={5}>
          <StatCard label="In return window" valuePaise={s.inWindowPaise} format="money" loading={summary.isLoading} extra={countLine(s.inWindowCount)} />
        </Col>
        <Col xs={12} md={8} lg={6} xxl={5}>
          <StatCard label="Held" value={s.heldCount} loading={summary.isLoading} />
        </Col>
        <Col xs={12} md={8} lg={6} xxl={5}>
          <StatCard label="Failed" value={s.failedCount} loading={summary.isLoading} />
        </Col>
        <Col xs={12} md={8} lg={6} xxl={4}>
          <StatCard label="Settled" valuePaise={s.settledPaise} format="money" loading={summary.isLoading} extra={countLine(s.settledCount)} />
        </Col>
      </Row>

      <FilterBar
        schema={[
          { key: 'state', label: 'Status', kind: 'multiSelect', width: 220, options: STATE_OPTIONS },
          { key: 'fulfillmentType', label: 'Fulfilment', kind: 'select', options: [
            { value: 'SELLER', label: 'Seller' },
            { value: 'ARISE', label: 'Arise' },
          ] },
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
      />

      <SettlementDrawer lineId={openId} open={Boolean(openId)} onClose={() => { setOpenId(null); refetch(); summary.refetch(); }} />
    </Flex>
  );
}

function countLine(n) {
  return <span style={{ fontSize: 12, color: 'var(--ant-color-text-secondary)' }}>{n ?? 0} item{n === 1 ? '' : 's'}</span>;
}
