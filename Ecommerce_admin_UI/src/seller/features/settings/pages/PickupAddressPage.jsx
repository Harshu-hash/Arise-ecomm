import { Alert, App, Button, Card, Flex, Form, Input, Space, Tag, Typography } from 'antd';
import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ErrorState from '@ui/components/ErrorState';
import FullPageSpinner from '@ui/components/FullPageSpinner';
import PageHeader from '@ui/components/PageHeader';
import { settingsApi, settingsKeys } from '../api/settings.api';

// The courier refuses a first line that is short or has no number, so the form asks for it up front (the server checks again).
const addressRules = [
  { required: true, message: 'Enter the full address.' },
  { min: 10, message: 'Enter the full address: house or flat number, building and road (at least 10 characters).' },
  { pattern: /\d/, message: 'Include a house, flat or road number.' },
];

export default function PickupAddressPage() {
  const { message } = App.useApp();
  const client = useQueryClient();
  const [form] = Form.useForm();
  const query = useQuery({ queryKey: settingsKeys.address, queryFn: settingsApi.address });

  useEffect(() => {
    if (query.data) form.setFieldsValue(query.data);
  }, [query.data, form]);

  const save = useMutation({
    mutationFn: settingsApi.setAddress,
    onSuccess: () => { message.success('Pickup address saved. Couriers will collect from here.'); client.invalidateQueries({ queryKey: settingsKeys.address }); },
    onError: (error) => message.error(error?.message ?? 'Could not save the address.'),
  });

  if (query.isLoading) return <FullPageSpinner label="Loading pickup address…" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />;
  const { contact, registeredWithCourier, courierVerified } = query.data;
  const missingContact = [!contact.phone && 'phone number', !contact.email && 'email'].filter(Boolean);

  return <Flex vertical gap={16}>
    <PageHeader title="Pickup address" breadcrumbs={[{ label: 'Settings' }, { label: 'Pickup address' }]} subtitle="Where the courier collects your parcels when you mark an order ready to ship." />
    {missingContact.length > 0 && <Alert type="warning" showIcon message={`Your account has no ${missingContact.join(' or ')}`} description="The courier needs a contact number and email for pickups. Add them to your account, otherwise shipping will be refused." />}
    {registeredWithCourier && courierVerified === false && <Alert type="warning" showIcon message="Pickup address not verified by the courier" description="Shiprocket has not verified your pickup phone number yet, so pickups may be refused. Contact Arise support to get it verified; you may be asked for a code sent to your phone." />}
    <Card title="Store pickup address" extra={<Tag color={registeredWithCourier ? 'green' : 'default'}>{registeredWithCourier ? 'Registered with courier' : 'Registered on your first shipment'}</Tag>}>
      <Form form={form} layout="vertical" onFinish={save.mutate} style={{ maxWidth: 560 }}>
        <Form.Item name="address" label="Address line" extra="House or flat number, building and road. The courier rejects short or number-less addresses." rules={addressRules}><Input maxLength={200} /></Form.Item>
        <Form.Item name="locality" label="Area / locality (optional)"><Input maxLength={100} /></Form.Item>
        <Space size={12} wrap style={{ width: '100%' }} styles={{ item: { flex: 1 } }}>
          <Form.Item name="city" label="City" rules={[{ required: true, message: 'Enter the city.' }]}><Input maxLength={80} /></Form.Item>
          <Form.Item name="state" label="State" rules={[{ required: true, message: 'Enter the state.' }]}><Input maxLength={80} /></Form.Item>
          <Form.Item name="pincode" label="Pincode" rules={[{ required: true, pattern: /^[1-9]\d{5}$/, message: 'Enter a valid 6-digit pincode.' }]}><Input maxLength={6} inputMode="numeric" /></Form.Item>
        </Space>
        <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>Contact for pickups: {contact.name ?? 'Owner'} · {contact.phone ?? 'no phone'} · {contact.email ?? 'no email'}. Changing the address takes effect from your next shipment.</Typography.Paragraph>
        <Button type="primary" htmlType="submit" loading={save.isPending}>Save pickup address</Button>
      </Form>
    </Card>
  </Flex>;
}
