import { PlusOutlined } from '@ant-design/icons';
import { App, Alert, Button, Card, Col, Descriptions, Flex, Form, Input, List, Modal, Row, Tag, Typography } from 'antd';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ErrorState from '@ui/components/ErrorState';
import FullPageSpinner from '@ui/components/FullPageSpinner';
import PageHeader from '@ui/components/PageHeader';
import { settingsApi, settingsKeys } from '../api/settings.api';

const PENNY_DROP_COLOR = { VERIFIED: 'green', PENDING: 'gold', NAME_MISMATCH: 'red' };

export default function BankPickupPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [bankOpen, setBankOpen] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);
  const [bankForm] = Form.useForm();
  const [addressForm] = Form.useForm();

  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: settingsKeys.bank, queryFn: settingsApi.bank });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: settingsKeys.bank });

  const bankMut = useMutation({
    mutationFn: (values) => settingsApi.setBankAccount(values),
    onSuccess: () => { message.success('Bank account saved — it will be re-verified.'); setBankOpen(false); invalidate(); },
    onError: (e) => message.error(e?.message ?? 'Could not save the bank account.'),
  });
  const addressMut = useMutation({
    mutationFn: (values) => settingsApi.addPickupAddress(values),
    onSuccess: () => { message.success('Pickup address added.'); setAddressOpen(false); addressForm.resetFields(); invalidate(); },
    onError: (e) => message.error(e?.message ?? 'Could not add the address.'),
  });

  if (isLoading) return <FullPageSpinner label="Loading bank & pickup details…" />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;

  const { account, addresses } = data;

  return (
    <Flex vertical gap={16}>
      <PageHeader title="Bank & Pickup" breadcrumbs={[{ label: 'Settings' }, { label: 'Bank & Pickup' }]} subtitle="Where your payouts land, and where couriers pick up from." />

      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <Card title="Bank account" extra={<Button size="small" onClick={() => { bankForm.setFieldsValue(account ?? {}); setBankOpen(true); }}>{account ? 'Update' : 'Add'}</Button>}>
            {account ? (
              <>
                {account.pennyDropStatus === 'NAME_MISMATCH' && <Alert type="error" showIcon style={{ marginBottom: 12 }} message="Name mismatch" description="The account holder name doesn't match your KYC. Payouts are paused until this is fixed." />}
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Holder">{account.accountHolder}</Descriptions.Item>
                  <Descriptions.Item label="Account">••••{account.accountNumber.slice(-4)}</Descriptions.Item>
                  <Descriptions.Item label="IFSC">{account.ifsc}</Descriptions.Item>
                  <Descriptions.Item label="Bank">{account.bankName}</Descriptions.Item>
                  <Descriptions.Item label="Verification"><Tag color={PENNY_DROP_COLOR[account.pennyDropStatus] ?? 'default'}>{account.pennyDropStatus}</Tag></Descriptions.Item>
                </Descriptions>
              </>
            ) : <Typography.Text type="secondary">No bank account on file yet.</Typography.Text>}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Pickup addresses" extra={<Button size="small" icon={<PlusOutlined />} onClick={() => setAddressOpen(true)}>Add</Button>}>
            <List
              dataSource={addresses}
              locale={{ emptyText: 'No pickup addresses yet.' }}
              renderItem={(a) => (
                <List.Item>
                  <List.Item.Meta
                    title={<Flex gap={8}><Typography.Text strong>{a.label}</Typography.Text>{a.isPrimary && <Tag color="blue">Primary</Tag>}</Flex>}
                    description={`${a.line1}, ${a.city}, ${a.state} ${a.pincode} · ${a.contactName} (${a.contactPhone})`}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Modal title={account ? 'Update bank account' : 'Add a bank account'} open={bankOpen} onCancel={() => setBankOpen(false)} onOk={() => bankForm.submit()} okText="Save" confirmLoading={bankMut.isPending}>
        <Form form={bankForm} layout="vertical" onFinish={(v) => bankMut.mutate(v)}>
          <Form.Item name="accountHolder" label="Account holder name" rules={[{ required: true, message: 'Enter the account holder name.' }]}><Input /></Form.Item>
          <Form.Item name="accountNumber" label="Account number" rules={[{ required: true, message: 'Enter the account number.' }]}><Input /></Form.Item>
          <Form.Item name="ifsc" label="IFSC code" rules={[{ required: true, message: 'Enter the IFSC code.' }, { len: 11, message: 'IFSC is 11 characters.' }]}><Input maxLength={11} /></Form.Item>
          <Form.Item name="bankName" label="Bank name" rules={[{ required: true, message: 'Enter the bank name.' }]}><Input /></Form.Item>
          <Form.Item name="branch" label="Branch"><Input /></Form.Item>
        </Form>
      </Modal>

      <Modal title="Add a pickup address" open={addressOpen} onCancel={() => setAddressOpen(false)} onOk={() => addressForm.submit()} okText="Add address" confirmLoading={addressMut.isPending}>
        <Form form={addressForm} layout="vertical" onFinish={(v) => addressMut.mutate(v)}>
          <Form.Item name="label" label="Label"><Input placeholder="e.g. Secondary warehouse" /></Form.Item>
          <Form.Item name="line1" label="Address" rules={[{ required: true, message: 'Enter the address.' }]}><Input.TextArea rows={2} /></Form.Item>
          <Flex gap={12}>
            <Form.Item name="city" label="City" rules={[{ required: true, message: 'City?' }]} style={{ flex: 1 }}><Input /></Form.Item>
            <Form.Item name="state" label="State" rules={[{ required: true, message: 'State?' }]} style={{ flex: 1 }}><Input /></Form.Item>
            <Form.Item name="pincode" label="PIN" rules={[{ required: true, message: 'PIN?' }]} style={{ width: 120 }}><Input maxLength={6} /></Form.Item>
          </Flex>
          <Form.Item name="contactName" label="Contact name" rules={[{ required: true, message: 'Enter a contact name.' }]}><Input /></Form.Item>
          <Form.Item name="contactPhone" label="Contact phone" rules={[{ required: true, message: 'Enter a contact phone.' }]}><Input /></Form.Item>
        </Form>
      </Modal>
    </Flex>
  );
}
