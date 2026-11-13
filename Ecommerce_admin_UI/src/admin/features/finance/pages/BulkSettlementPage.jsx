import { App, Alert, Button, Card, Flex, InputNumber, Modal, Radio, Select, Table, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { formatDate } from '@core/utils/date';
import { formatINR } from '@core/utils/money';
import ErrorState from '@ui/components/ErrorState';
import MoneyText from '@ui/components/MoneyText';
import PageHeader from '@ui/components/PageHeader';
import { financeApi, financeKeys } from '../api/finance.api';
import { Dots } from '../components/settlementColumns';

/**
 * Bulk settlement — pay many of one seller's ready items at once, under a single
 * shared reference (BS-YYMM-NNN). Only items whose return window has closed and
 * whose checks are all green can be selected.
 */
export default function BulkSettlementPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [sellerId, setSellerId] = useState(null);
  const [selected, setSelected] = useState([]);
  const [payOpen, setPayOpen] = useState(false);
  const [mode, setMode] = useState('AUTOMATIC');
  const [txnNo, setTxnNo] = useState('');
  const [result, setResult] = useState(null);

  const sellersQ = useQuery({ queryKey: financeKeys.bulkSellers, queryFn: () => financeApi.bulkSellers().then((r) => r.data) });
  const linesQ = useQuery({
    queryKey: financeKeys.bulkSellerLines(sellerId),
    queryFn: () => financeApi.bulkSellerLines(sellerId).then((r) => r.data),
    enabled: Boolean(sellerId),
  });
  const historyQ = useQuery({ queryKey: financeKeys.bulkList({}), queryFn: () => financeApi.bulkList().then((r) => r) });

  const lines = useMemo(() => linesQ.data?.items ?? [], [linesQ.data]);
  const selectedLines = useMemo(() => lines.filter((l) => selected.includes(l.id)), [lines, selected]);
  const totalPaise = selectedLines.reduce((n, l) => n + l.settledPaise, 0);

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['finance', 'settlements'] });
  };

  const pay = useMutation({
    mutationFn: () => financeApi.bulkPay({ sellerId, lineIds: selected, mode, txnNo }).then((r) => r.data),
    onSuccess: (data) => {
      setResult(data);
      setPayOpen(false);
      setSelected([]);
      refreshAll();
      message.success(`Bulk settlement ${data.refNo} complete`);
    },
    onError: (e) => message.error(e.message),
  });

  const columns = [
    { title: 'Delivered', dataIndex: 'deliveredAt', render: (v) => (v ? formatDate(v) : '—') },
    {
      title: 'Order item', dataIndex: 'productTitle',
      render: (t, row) => (
        <div>
          <Typography.Text strong style={{ fontSize: 13 }}>{t}</Typography.Text>
          <div><Typography.Text type="secondary" style={{ fontSize: 11 }}>{row.orderId}{row.sku ? ` · ${row.sku}` : ''}</Typography.Text></div>
        </div>
      ),
    },
    { title: 'Customer', dataIndex: 'customerName' },
    { title: 'Checks', render: (_v, row) => <Dots dots={row.dots} /> },
    { title: 'Settlement', dataIndex: 'settledPaise', align: 'right', render: (v) => <MoneyText paise={v} strong /> },
  ];

  const historyColumns = [
    { title: 'Reference', dataIndex: 'refNo', render: (v) => <Typography.Text strong>{v}</Typography.Text> },
    { title: 'Seller', dataIndex: 'sellerName' },
    { title: 'Items', dataIndex: 'orderCount', align: 'right' },
    { title: 'Total', dataIndex: 'totalPaise', align: 'right', render: (v) => <MoneyText paise={v} /> },
    { title: 'When', dataIndex: 'createdAt', render: (v) => formatDate(v) },
  ];

  return (
    <Flex vertical gap={16}>
      <PageHeader
        title="Bulk settlement"
        breadcrumbs={[{ label: 'Finance' }, { label: 'Seller settlements', to: '/finance/payouts' }, { label: 'Bulk' }]}
        subtitle="Pay many of a single seller's ready items at once. Only items past their return window with every check green are listed."
      />

      <Card size="small">
        <Flex gap={12} align="center" wrap>
          <Typography.Text strong>Seller</Typography.Text>
          <Select
            showSearch
            optionFilterProp="label"
            style={{ minWidth: 320 }}
            placeholder="Choose a seller with payable items"
            loading={sellersQ.isLoading}
            value={sellerId}
            onChange={(v) => { setSellerId(v); setSelected([]); }}
            options={(sellersQ.data?.items ?? []).map((s) => ({
              value: s.id,
              label: `${s.shopName} — ${s.payableCount} item${s.payableCount === 1 ? '' : 's'} · ${formatINR(s.payablePaise)}`,
            }))}
            notFoundContent={sellersQ.isLoading ? 'Loading…' : 'No sellers have payable items'}
          />
        </Flex>
      </Card>

      {sellerId && (
        linesQ.error ? (
          <Card><ErrorState error={linesQ.error} onRetry={linesQ.refetch} title="Could not load the seller's items" /></Card>
        ) : (
          <Card size="small" styles={{ body: { padding: 0 } }}>
            <Table
              rowKey="id"
              size="small"
              loading={linesQ.isLoading}
              dataSource={lines}
              columns={columns}
              pagination={{ pageSize: 10, hideOnSinglePage: true }}
              rowSelection={{
                selectedRowKeys: selected,
                onChange: setSelected,
                getCheckboxProps: (row) => ({ disabled: !row.ready }),
              }}
              locale={{ emptyText: 'No items past their return window with all checks green.' }}
            />
          </Card>
        )
      )}

      {sellerId && selected.length > 0 && (
        <Card size="small" style={{ borderColor: 'var(--ant-color-primary)' }}>
          <Flex align="center" gap={16} wrap>
            <Typography.Text><b>{selected.length}</b> item{selected.length === 1 ? '' : 's'} selected</Typography.Text>
            <Typography.Text type="secondary">Total to settle</Typography.Text>
            <Typography.Text strong style={{ fontSize: 18 }}>{formatINR(totalPaise)}</Typography.Text>
            <div style={{ flex: 1 }} />
            <Button type="primary" onClick={() => setPayOpen(true)}>Settle {selected.length} now</Button>
          </Flex>
        </Card>
      )}

      <Card size="small" title="Recent bulk settlements" styles={{ body: { padding: 0 } }}>
        <Table
          rowKey="refNo"
          size="small"
          loading={historyQ.isLoading}
          dataSource={historyQ.data?.data ?? []}
          columns={historyColumns}
          pagination={{ pageSize: 5, hideOnSinglePage: true }}
          locale={{ emptyText: 'No bulk settlements yet' }}
        />
      </Card>

      <Modal
        open={payOpen}
        onCancel={() => setPayOpen(false)}
        onOk={() => pay.mutate()}
        confirmLoading={pay.isPending}
        okText={`Pay ${formatINR(totalPaise)}`}
        title={`Settle ${selected.length} item${selected.length === 1 ? '' : 's'}`}
      >
        <Flex vertical gap={12}>
          <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
            One shared reference (BS-YYMM-NNN) will be stamped on every item and its invoice.
          </Typography.Paragraph>
          <Radio.Group value={mode} onChange={(e) => setMode(e.target.value)}>
            <Radio value="AUTOMATIC">Automatic (bank transfer)</Radio>
            <Radio value="MANUAL">Manual (UPI / recorded)</Radio>
          </Radio.Group>
          {mode === 'MANUAL' && (
            <InputNumber stringMode controls={false} style={{ width: '100%' }} placeholder="Transaction / UTR number" value={txnNo} onChange={(v) => setTxnNo(v ?? '')} />
          )}
        </Flex>
      </Modal>

      <Modal open={Boolean(result)} onCancel={() => setResult(null)} onOk={() => setResult(null)} footer={<Button type="primary" onClick={() => setResult(null)}>Done</Button>} title="Bulk settlement complete">
        {result && (
          <Alert
            type="success"
            showIcon
            message={`Reference ${result.refNo}`}
            description={`${result.settledCount} item${result.settledCount === 1 ? '' : 's'} settled to ${result.sellerName} — ${formatINR(result.totalPaise)}${result.failedCount ? ` · ${result.failedCount} failed` : ''}.`}
          />
        )}
      </Modal>
    </Flex>
  );
}
