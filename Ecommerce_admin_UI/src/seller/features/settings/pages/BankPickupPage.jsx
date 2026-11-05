import { App, Alert, Button, Card, Descriptions, Flex, Form, Input, Modal, Tag, Typography } from 'antd';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ErrorState from '@ui/components/ErrorState';
import FullPageSpinner from '@ui/components/FullPageSpinner';
import PageHeader from '@ui/components/PageHeader';
import StepUpModal from '@seller/features/security/components/StepUpModal';
import { settingsApi, settingsKeys } from '../api/settings.api';

const COLORS = { VERIFIED: 'green', PENDING: 'gold', NAME_MISMATCH: 'red' };

export default function BankPickupPage() {
  const { message } = App.useApp();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pendingBank, setPendingBank] = useState(null);
  const [form] = Form.useForm();
  const query = useQuery({ queryKey: settingsKeys.bank, queryFn: settingsApi.bank });
  const mutation = useMutation({
    mutationFn: ({ values, token }) => settingsApi.setBankAccount(values, token),
    onSuccess: () => { message.success('Bank account saved — it will be re-verified.'); setOpen(false); client.invalidateQueries({ queryKey: settingsKeys.bank }); },
    onError: (error) => message.error(error?.message ?? 'Could not save the bank account.'),
  });
  if (query.isLoading) return <FullPageSpinner label="Loading bank details…" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />;
  const account = query.data.account;
  return <Flex vertical gap={16}>
    <PageHeader title="Bank account" breadcrumbs={[{ label: 'Settings' }, { label: 'Bank account' }]} subtitle="Where your verified marketplace payouts are deposited." />
    <Card title="Payout account" extra={<Button onClick={() => { form.setFieldsValue(account ?? {}); setOpen(true); }}>{account ? 'Update' : 'Add'}</Button>}>
      {account ? <>
        {account.pennyDropStatus === 'NAME_MISMATCH' && <Alert type="error" showIcon style={{ marginBottom: 12 }} message="Name mismatch" description="The account holder name does not match KYC. Payouts are paused until this is fixed." />}
        <Descriptions column={1} size="small" items={[
          { key: 'holder', label: 'Holder', children: account.accountHolder },
          { key: 'number', label: 'Account', children: `••••${account.accountNumber.slice(-4)}` },
          { key: 'ifsc', label: 'IFSC', children: account.ifsc },
          { key: 'bank', label: 'Bank', children: account.bankName },
          { key: 'status', label: 'Verification', children: <Tag color={COLORS[account.pennyDropStatus]}>{account.pennyDropStatus}</Tag> },
        ]} />
      </> : <Typography.Text type="secondary">No bank account on file yet.</Typography.Text>}
    </Card>
    <Modal title={account ? 'Update bank account' : 'Add bank account'} open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} confirmLoading={mutation.isPending}>
      <Form form={form} layout="vertical" onFinish={(values) => setPendingBank(values)}>
        <Form.Item name="accountHolder" label="Account holder name" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="accountNumber" label="Account number" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="ifsc" label="IFSC code" rules={[{ required: true }, { len: 11 }]}><Input maxLength={11} /></Form.Item>
        <Form.Item name="bankName" label="Bank name" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="branch" label="Branch"><Input /></Form.Item>
      </Form>
    </Modal>
    <StepUpModal open={Boolean(pendingBank)} onCancel={() => setPendingBank(null)} onVerified={(token) => mutation.mutateAsync({ values: pendingBank, token }).then(() => setPendingBank(null))} title="Confirm bank-account change" />
  </Flex>;
}
