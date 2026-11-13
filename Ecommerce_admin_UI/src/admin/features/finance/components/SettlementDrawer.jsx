import { CheckCircleFilled, ClockCircleOutlined, CloseCircleFilled } from '@ant-design/icons';
import { Alert, App, Button, Divider, Flex, InputNumber, Modal, Radio, Space, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { formatDate } from '@core/utils/date';
import { formatINR, rupeesToPaise } from '@core/utils/money';
import ErrorState from '@ui/components/ErrorState';
import MoneyText from '@ui/components/MoneyText';
import { financeApi, financeKeys } from '../api/finance.api';
import { SettlementStateTag } from './settlementColumns';

const DEDUCTIONS = [
  ['packing', 'Packing'],
  ['quality', 'Quality issue'],
  ['priceMismatch', 'Price mismatch'],
  ['extra', 'Extra charge'],
  ['misc', 'Miscellaneous'],
];

const DOT_ICON = {
  g: <CheckCircleFilled style={{ color: 'var(--ant-color-success)' }} />,
  a: <ClockCircleOutlined style={{ color: 'var(--ant-color-warning)' }} />,
  r: <CloseCircleFilled style={{ color: 'var(--ant-color-error)' }} />,
};

/** Review-and-pay panel for one order item's settlement. */
export default function SettlementDrawer({ lineId, open, onClose }) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [deductions, setDeductions] = useState({});
  const [mode, setMode] = useState('AUTOMATIC');
  const [txnNo, setTxnNo] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: financeKeys.settlement(lineId),
    queryFn: () => financeApi.settlement(lineId).then((r) => r.data),
    enabled: open && Boolean(lineId),
  });

  useEffect(() => {
    if (data) {
      const d = {};
      for (const [k] of DEDUCTIONS) d[k] = (data.deductions?.[k] ?? 0) / 100;
      setDeductions(d);
      if (data.mode) setMode(data.mode);
    }
  }, [data]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['finance', 'settlements'] });
    queryClient.invalidateQueries({ queryKey: financeKeys.settlement(lineId) });
  };

  const issuesPayload = () => {
    const out = {};
    for (const [k] of DEDUCTIONS) out[k] = rupeesToPaise(deductions[k]) ?? 0;
    return out;
  };

  const review = useMutation({
    mutationFn: async () => {
      await financeApi.setSettlementIssues(lineId, issuesPayload());
      return financeApi.reviewSettlement(lineId);
    },
    onSuccess: () => { invalidate(); message.success('Marked reviewed'); },
    onError: (e) => message.error(e.message),
  });

  const pay = useMutation({
    mutationFn: () => {
      const payload = { mode, txnNo, issues: issuesPayload() };
      const send = data?.state === 'FAILED' ? financeApi.retrySettlement : financeApi.paySettlement;
      return send(lineId, payload);
    },
    onSuccess: () => { invalidate(); message.success('Seller paid for this item'); onClose(); },
    onError: (e) => message.error(e.message),
  });

  const releaseHold = useMutation({
    mutationFn: () => financeApi.releaseSettlementHold(lineId),
    onSuccess: () => { invalidate(); message.success('Hold released'); },
    onError: (e) => message.error(e.message),
  });

  const deductTotalPaise = DEDUCTIONS.reduce((n, [k]) => n + (rupeesToPaise(deductions[k]) ?? 0), 0);
  const settledPreview = Math.max(0, (data?.quotedPaise ?? 0) - deductTotalPaise);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={640}
      title={data ? `Settlement · ${data.productTitle}` : 'Settlement'}
      destroyOnHidden
    >
      {error ? (
        <ErrorState error={error} onRetry={refetch} title="Could not load this settlement" />
      ) : isLoading || !data ? (
        <Typography.Paragraph type="secondary">Loading…</Typography.Paragraph>
      ) : (
        <Flex vertical gap={14}>
          <Flex justify="space-between" align="flex-start" gap={8} wrap>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {data.orderId} · {data.sellerName} · {data.customerName}
              {data.deliveredAt ? ` · delivered ${formatDate(data.deliveredAt)}` : ''}
            </Typography.Text>
            <SettlementStateTag state={data.state} />
          </Flex>

          {/* Readiness checks */}
          <div style={{ background: 'var(--ant-color-fill-quaternary)', borderRadius: 8, padding: 12 }}>
            <Typography.Text strong style={{ fontSize: 12 }}>Readiness</Typography.Text>
            <Flex vertical gap={6} style={{ marginTop: 8 }}>
              {data.dots.map((d) => (
                <Flex key={d.key} align="center" gap={8}>
                  {DOT_ICON[d.dot]}
                  <Typography.Text style={{ fontSize: 13 }}>{d.label}</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>— {d.tooltip}</Typography.Text>
                </Flex>
              ))}
            </Flex>
          </div>

          {(data.manualHold || data.seller?.payoutOnHold) && !data.settled && (
            <Alert
              type="warning"
              showIcon
              message="Settlement is on hold"
              description={data.dots.find((d) => d.key === 'hold')?.tooltip}
              action={
                data.manualHold ? (
                  <Button size="small" loading={releaseHold.isPending} onClick={() => releaseHold.mutate()}>
                    Release hold
                  </Button>
                ) : null
              }
            />
          )}

          {/* Order money (admin only) */}
          <div style={{ border: '1px solid var(--ant-color-border-secondary)', borderRadius: 8, padding: 12 }}>
            <Typography.Text strong style={{ fontSize: 12 }}>Order money <Typography.Text type="secondary" style={{ fontSize: 11 }}>(admin only)</Typography.Text></Typography.Text>
            <Flex vertical gap={4} style={{ marginTop: 8 }}>
              <Row k="Item sale value" v={<MoneyText paise={data.orderMoney?.salePaise} />} />
              <Row k="Commission" v={<MoneyText paise={-data.orderMoney?.commissionPaise} colorBySign />} />
              <Row k="Fees" v={<MoneyText paise={-data.orderMoney?.feesBeforeTaxPaise} colorBySign />} />
              <Row k="GST on fees" v={<MoneyText paise={-data.orderMoney?.gstOnFeesPaise} colorBySign />} />
              <Row k="TCS + TDS" v={<MoneyText paise={-(data.orderMoney?.tcsPaise + data.orderMoney?.tdsPaise)} colorBySign />} />
              <Divider style={{ margin: '6px 0' }} />
              <Row k="Seller quoted (net)" v={<MoneyText paise={data.quotedPaise} strong />} />
            </Flex>
          </div>

          {/* Deductions */}
          <div>
            <Typography.Text strong style={{ fontSize: 12 }}>Seller issue deductions</Typography.Text>
            <Flex vertical gap={6} style={{ marginTop: 8 }}>
              {DEDUCTIONS.map(([k, label]) => (
                <Flex key={k} justify="space-between" align="center">
                  <Typography.Text style={{ fontSize: 13 }}>{label}</Typography.Text>
                  <InputNumber
                    min={0}
                    disabled={data.settled}
                    prefix="₹"
                    style={{ width: 160 }}
                    value={deductions[k]}
                    onChange={(v) => setDeductions((s) => ({ ...s, [k]: v }))}
                  />
                </Flex>
              ))}
            </Flex>
          </div>

          {/* Live calc */}
          <div style={{ background: 'var(--ant-color-primary-bg)', borderRadius: 8, padding: 12 }}>
            <Row k="Seller quoted" v={formatINR(data.quotedPaise)} />
            {deductTotalPaise > 0 && <Row k="− Deductions" v={<Typography.Text type="danger">−{formatINR(deductTotalPaise)}</Typography.Text>} />}
            <Divider style={{ margin: '6px 0' }} />
            <Flex justify="space-between">
              <Typography.Text strong>Settlement amount</Typography.Text>
              <Typography.Text strong style={{ color: 'var(--ant-color-primary)' }}>{formatINR(settledPreview)}</Typography.Text>
            </Flex>
          </div>

          {data.settled ? (
            <Alert
              type="success"
              showIcon
              message={`Settled — ${formatINR(data.settledPaise)}`}
              description={
                <Space direction="vertical" size={0}>
                  <span>Invoice {data.invoiceNo}</span>
                  {data.txnNo ? <span>Txn {data.txnNo}</span> : null}
                  {data.utr ? <span>UTR {data.utr}</span> : null}
                  {data.settledAt ? <span>Paid {formatDate(data.settledAt)}</span> : null}
                </Space>
              }
            />
          ) : (
            <Flex vertical gap={12}>
              <Space>
                <Button
                  onClick={() => review.mutate()}
                  loading={review.isPending}
                  disabled={data.reviewed}
                >
                  {data.reviewed ? 'Reviewed ✓' : 'Save & mark reviewed'}
                </Button>
              </Space>

              <div style={{ border: '1px solid var(--ant-color-border-secondary)', borderRadius: 8, padding: 12 }}>
                <Typography.Text strong style={{ fontSize: 12 }}>Pay</Typography.Text>
                <div style={{ marginTop: 8 }}>
                  <Radio.Group value={mode} onChange={(e) => setMode(e.target.value)}>
                    <Radio value="AUTOMATIC">Automatic (bank transfer)</Radio>
                    <Radio value="MANUAL">Manual (UPI / recorded)</Radio>
                  </Radio.Group>
                </div>
                {mode === 'MANUAL' && (
                  <div style={{ marginTop: 8 }}>
                    {data.seller?.upiId && (
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>Seller UPI: {data.seller.upiId}</Typography.Text>
                    )}
                    <InputNumber
                      stringMode
                      style={{ width: '100%', marginTop: 4 }}
                      placeholder="Transaction / UTR number"
                      value={txnNo}
                      onChange={(v) => setTxnNo(v ?? '')}
                      controls={false}
                    />
                  </div>
                )}
                <Button
                  type="primary"
                  block
                  style={{ marginTop: 12 }}
                  loading={pay.isPending}
                  disabled={!data.ready || !data.reviewed || !(settledPreview > 0)}
                  onClick={() => pay.mutate()}
                >
                  {data.state === 'FAILED' ? 'Retry & pay' : 'Confirm & pay'} {formatINR(settledPreview)}
                </Button>
                {!data.ready && (
                  <Typography.Paragraph type="danger" style={{ fontSize: 12, marginTop: 6, marginBottom: 0 }}>
                    Every readiness check must be green — a seller is not paid until the return window closes.
                  </Typography.Paragraph>
                )}
                {data.ready && !data.reviewed && (
                  <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 6, marginBottom: 0 }}>
                    Mark the settlement reviewed before paying.
                  </Typography.Paragraph>
                )}
              </div>
            </Flex>
          )}
        </Flex>
      )}
    </Modal>
  );
}

function Row({ k, v }) {
  return (
    <Flex justify="space-between">
      <Typography.Text type="secondary" style={{ fontSize: 13 }}>{k}</Typography.Text>
      <span className="tabular" style={{ fontSize: 13 }}>{v}</span>
    </Flex>
  );
}
