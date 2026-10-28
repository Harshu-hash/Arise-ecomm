import { App, Button, Card, Col, Descriptions, Flex, Form, Input, List, Row, Switch, Tag, Typography } from 'antd';
import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ErrorState from '@ui/components/ErrorState';
import FullPageSpinner from '@ui/components/FullPageSpinner';
import PageHeader from '@ui/components/PageHeader';
import { settingsApi, settingsKeys } from '../api/settings.api';

const DOC_STATUS_COLOR = { APPROVED: 'green', PENDING: 'gold', REJECTED: 'red' };

export default function ProfilePage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();

  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: settingsKeys.profile, queryFn: settingsApi.profile });

  useEffect(() => {
    if (data?.seller) form.setFieldsValue({ storeName: data.seller.storeName, legalName: data.seller.legalName });
  }, [data, form]);

  const saveMut = useMutation({
    mutationFn: (values) => settingsApi.updateProfile(values),
    onSuccess: () => { message.success('Profile updated.'); queryClient.invalidateQueries({ queryKey: settingsKeys.profile }); },
    onError: (e) => message.error(e?.message ?? 'Could not save.'),
  });
  const vacationMut = useMutation({
    mutationFn: (on) => settingsApi.setVacation(on),
    onSuccess: (seller) => {
      message.success(seller.vacationMode ? 'Holiday mode is on — your listings are paused.' : 'Holiday mode is off — your listings are live again.');
      queryClient.invalidateQueries({ queryKey: settingsKeys.profile });
    },
    onError: (e) => message.error(e?.message ?? 'Could not update.'),
  });

  if (isLoading) return <FullPageSpinner label="Loading profile…" />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;

  const { seller, documents } = data;

  return (
    <Flex vertical gap={16}>
      <PageHeader title="Business Profile" breadcrumbs={[{ label: 'Settings' }, { label: 'Business Profile' }]} subtitle="Your registered business details and verification documents." />

      <Row gutter={16}>
        <Col xs={24} lg={14}>
          <Card title="Store details" style={{ marginBottom: 16 }}>
            <Form form={form} layout="vertical" onFinish={(v) => saveMut.mutate(v)}>
              <Form.Item name="storeName" label="Store name" rules={[{ required: true, message: 'Enter your store name.' }]}>
                <Input />
              </Form.Item>
              <Form.Item name="legalName" label="Legal entity name" rules={[{ required: true, message: 'Enter your legal entity name.' }]}>
                <Input />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={saveMut.isPending}>Save changes</Button>
            </Form>
          </Card>

          <Card title="Registration" size="small">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="GSTIN">{seller.gstin ?? 'Not set'}</Descriptions.Item>
              <Descriptions.Item label="PAN">{seller.pan ?? 'Not set'}</Descriptions.Item>
              <Descriptions.Item label="Tier">{seller.tier}</Descriptions.Item>
              <Descriptions.Item label="City">{seller.city}, {seller.state}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card title="Verification documents" size="small" style={{ marginBottom: 16 }}>
            <List
              size="small"
              dataSource={documents}
              locale={{ emptyText: 'No documents on file.' }}
              renderItem={(d) => (
                <List.Item>
                  <Typography.Text>{d.label}</Typography.Text>
                  <Tag color={DOC_STATUS_COLOR[d.status] ?? 'default'}>{d.status}</Tag>
                </List.Item>
              )}
            />
          </Card>

          <Card title="Holiday mode" size="small">
            <Flex justify="space-between" align="center">
              <div>
                <Typography.Text>Pause all your listings</Typography.Text>
                <div><Typography.Text type="secondary" style={{ fontSize: 12 }}>Customers will not be able to order while this is on.</Typography.Text></div>
              </div>
              <Switch checked={Boolean(seller.vacationMode)} loading={vacationMut.isPending} onChange={(on) => vacationMut.mutate(on)} />
            </Flex>
          </Card>
        </Col>
      </Row>
    </Flex>
  );
}
