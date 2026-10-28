import { Card, Col, Flex, Row, Space, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import DataTable from '@ui/components/DataTable/DataTable';
import DateText from '@ui/components/DateText';
import MoneyText from '@ui/components/MoneyText';
import PageHeader from '@ui/components/PageHeader';
import StatCard from '@ui/components/StatCard';
import useListQuery from '@ui/hooks/useListQuery';
import useUrlTableState from '@ui/hooks/useUrlTableState';
import { financeApi, financeKeys } from '../api/finance.api';

const columns = [
  { key: 'invoiceNo', title: 'Invoice', dataIndex: 'invoiceNo', priority: 1, render: (v, r) => (
    <div><Typography.Text strong>{v}</Typography.Text><div><Typography.Text type="secondary" style={{ fontSize: 12 }}>{r.orderId} · {r.customerName}</Typography.Text></div></div>
  ) },
  { key: 'type', title: 'Type', dataIndex: 'type', width: 130, render: (t) => <Tag color={t === 'CREDIT_NOTE' ? 'orange' : 'blue'}>{t === 'CREDIT_NOTE' ? 'Credit note' : 'Tax invoice'}</Tag> },
  { key: 'placeOfSupply', title: 'Place of supply', dataIndex: 'placeOfSupply', width: 150 },
  { key: 'totalPaise', title: 'Total', dataIndex: 'totalPaise', align: 'right', width: 120, sorter: true, render: (p) => <MoneyText paise={p} strong type={p < 0 ? 'danger' : undefined} /> },
  { key: 'issuedAt', title: 'Issued', dataIndex: 'issuedAt', width: 120, render: (v) => <DateText value={v} /> },
];

export default function InvoicesPage() {
  const state = useUrlTableState({ defaultSort: '-issuedAt' });
  const { data: tax = [] } = useQuery({ queryKey: financeKeys.tax, queryFn: financeApi.tax });

  const { rows, meta, loading, error, refetch, fetching } = useListQuery({
    queryKey: financeKeys.invoices({ ...state.queryParams, tab: state.tab }),
    url: '/finance/invoices',
    params: { ...state.queryParams, ...(state.tab && state.tab !== 'all' ? { type: state.tab } : {}) },
  });

  const t = tax[0];
  const TABS = [
    { key: 'all', label: 'All' },
    { key: 'TAX_INVOICE', label: 'Tax invoices' },
    { key: 'CREDIT_NOTE', label: 'Credit notes' },
  ];

  return (
    <Flex vertical gap={12}>
      <PageHeader title="Invoices & Tax" breadcrumbs={[{ label: 'Payments' }, { label: 'Invoices & Tax' }]} subtitle="GST tax invoices raised in your name, and your TCS/TDS collected under GST." />

      {t && (
        <Row gutter={[12, 12]}>
          <Col xs={12} md={6}><StatCard label="Taxable value" valuePaise={t.taxableValuePaise} format="money" /></Col>
          <Col xs={12} md={6}><StatCard label="TCS collected" valuePaise={t.tcsPaise} format="money" /></Col>
          <Col xs={12} md={6}><StatCard label="TDS withheld" valuePaise={t.tdsPaise} format="money" /></Col>
          <Col xs={12} md={6}>
            <Card size="small" styles={{ body: { padding: 14 } }}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>Filings ({t.period})</Typography.Text>
              <div style={{ marginTop: 6 }}>
                <Space size={6} wrap>
                  <Tag color={t.gstr8Filed ? 'green' : 'gold'}>GSTR-8 {t.gstr8Filed ? 'filed' : 'pending'}</Tag>
                  <Tag color={t.form16aIssued ? 'green' : 'gold'}>16A {t.form16aIssued ? 'issued' : 'pending'}</Tag>
                </Space>
              </div>
            </Card>
          </Col>
        </Row>
      )}

      <Card styles={{ body: { padding: 0 } }}>
        <DataTable
          tableId="seller-invoices"
          columns={columns}
          rows={rows}
          meta={meta}
          loading={loading || fetching}
          error={error}
          onRetry={refetch}
          tableState={state}
          tabs={TABS}
          emptyProps={{ title: 'No invoices yet', description: 'Tax invoices are raised automatically when you ship an order.' }}
        />
      </Card>
    </Flex>
  );
}
