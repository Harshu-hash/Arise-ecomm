import { Alert, Divider, Flex, Timeline, Typography } from 'antd';
import MoneyText from '@ui/components/MoneyText';
import DateText from '@ui/components/DateText';

/**
 * The deduction waterfall for one settlement line — the "explains every
 * deduction" view a seller needs to trust a payout. Deductions are shown as
 * negative; the net is what actually reaches their bank.
 */
export default function SettlementBreakdown({ line }) {
  const rows = [
    ['Sale amount', line.salePaise, false],
    [`Commission (${line.commissionPct}%)`, -line.commissionPaise, true],
    ['Closing fee', -line.closingFeePaise, true],
    ['Collection fee', -line.collectionFeePaise, true],
    ['Shipping fee', -line.shippingFeePaise, true],
    ...(line.pickPackFeePaise ? [['Pick & pack fee', -line.pickPackFeePaise, true]] : []),
    ...(line.storageFeePaise ? [['Storage fee', -line.storageFeePaise, true]] : []),
    ['GST on fees (18%)', -line.gstOnFeesPaise, true],
    ['TCS', -line.tcsPaise, true],
    ['TDS', -line.tdsPaise, true],
    ...(line.adjustmentsPaise ? [['Adjustments', line.adjustmentsPaise, true]] : []),
  ];

  return (
    <div>
      {rows.map(([label, paise, deduction]) => (
        <Flex key={label} justify="space-between" style={{ padding: '5px 0' }}>
          <Typography.Text type={deduction ? 'secondary' : undefined}>{label}</Typography.Text>
          <MoneyText paise={paise} signed={deduction} type={paise < 0 ? 'danger' : undefined} />
        </Flex>
      ))}
      <Divider style={{ margin: '8px 0' }} />
      <Flex justify="space-between">
        <Typography.Text strong>Net payout</Typography.Text>
        <MoneyText paise={line.netPaise} strong type={line.netPaise < 0 ? 'danger' : 'success'} />
      </Flex>
      {line.negative && (
        <Typography.Paragraph type="danger" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>
          Fees exceeded the sale on this item; the shortfall is carried forward against your next payout.
        </Typography.Paragraph>
      )}
      {line.status === 'ON_HOLD' && <Alert style={{ marginTop: 12 }} type="warning" showIcon message={line.holdReason ?? 'Settlement on hold'} description={line.requiredAction} />}
      {line.holdTimeline?.length > 0 && <><Divider orientation="left">Hold timeline</Divider><Timeline items={line.holdTimeline.map((event) => ({ children: <><Typography.Text strong>{event.label}</Typography.Text><div><DateText value={event.at} withTime /></div></> }))} /></>}
    </div>
  );
}
