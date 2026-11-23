import { App, Button, Card, Flex, Input, Modal, Space, Tag, Typography } from 'antd';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { downloadBlob } from '@core/utils/misc';
import MoneyText from '@ui/components/MoneyText';
import { financeApi } from '../api/finance.api';

export const INVOICE_TYPE = { TAX_INVOICE: ['Tax invoice', 'blue'], BILL_OF_SUPPLY: ['Bill of supply', undefined], CREDIT_NOTE: ['Credit note', 'volcano'] };

/** PDF, email-to-customer and re-generate for one tax document. Re-generating cancels it with a credit note and issues a corrected invoice. */
export function InvoiceActions({ row, onChanged }) {
  const { message } = App.useApp();
  const [reason, setReason] = useState(null); // null = closed
  const act = (done, run) => async () => {
    try {
      await run();
      message.success(done);
      onChanged?.();
    } catch (error) {
      message.error(error?.message ?? 'That did not work.');
    }
  };
  const regenerate = useMutation({
    mutationFn: () => financeApi.regenerateInvoice(row.id, { reason }),
    onSuccess: () => { setReason(null); message.success('Corrected invoice issued.'); onChanged?.(); },
    onError: (error) => message.error(error?.message ?? 'Could not re-generate.'),
  });
  return (
    <>
      <Space size={4} wrap>
        <Button size="small" onClick={act('Downloaded', async () => downloadBlob(await financeApi.downloadInvoice(row.id), `${row.number.replaceAll('/', '-')}.pdf`))}>PDF</Button>
        <Button size="small" onClick={act('Emailed to the customer', () => financeApi.resendInvoice(row.id))}>Email</Button>
        {row.type !== 'CREDIT_NOTE' && !row.superseded && <Button size="small" danger onClick={() => setReason('')}>Re-generate</Button>}
      </Space>
      <Modal
        open={reason !== null}
        title={`Re-generate ${row.number}`}
        okText="Cancel and re-issue"
        okButtonProps={{ danger: true, disabled: (reason ?? '').trim().length < 3, loading: regenerate.isPending }}
        onOk={() => regenerate.mutate()}
        onCancel={() => setReason(null)}
      >
        <Typography.Paragraph type="secondary">
          A credit note cancels this invoice and a new one is issued from the current seller and tax details (for example a GSTIN added since). The original stays on record.
        </Typography.Paragraph>
        <Input.TextArea rows={3} maxLength={300} placeholder="Why is it being corrected?" value={reason ?? ''} onChange={(event) => setReason(event.target.value)} />
      </Modal>
    </>
  );
}

/** The tax documents of one order, for the order page. */
export default function InvoiceList({ invoices, onChanged }) {
  return (
    <Card size="small" title="Invoices & credit notes">
      {invoices.length === 0 && <Typography.Text type="secondary">Issued when a seller makes a parcel ready to ship.</Typography.Text>}
      <Flex vertical gap={10}>
        {invoices.map((row) => (
          <div key={row.id}>
            <Flex justify="space-between" align="center" gap={8}>
              <Typography.Text strong>{row.number}</Typography.Text>
              <Flex gap={4}>
                <Tag color={INVOICE_TYPE[row.type]?.[1]} style={{ marginInlineEnd: 0 }}>{INVOICE_TYPE[row.type]?.[0] ?? row.type}</Tag>
                {row.superseded && <Tag color="gold" style={{ marginInlineEnd: 0 }}>Superseded</Tag>}
              </Flex>
            </Flex>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {row.kind === 'PLATFORM_FEE' ? 'Arise · platform fee' : row.supplierName} · <MoneyText paise={row.totalPaise} />
            </Typography.Text>
            <div style={{ marginTop: 4 }}><InvoiceActions row={row} onChanged={onChanged} /></div>
          </div>
        ))}
      </Flex>
    </Card>
  );
}
