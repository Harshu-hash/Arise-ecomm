import { App, Button, Card, Col, Flex, Form, InputNumber, Modal, Row, Select, Space, Tag, Typography } from 'antd';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { paiseToRupees, rupeesToPaise } from '@core/utils/money';
import DateText from '@ui/components/DateText';
import PageHeader from '@ui/components/PageHeader';
import StatusTag from '@ui/components/StatusTag';
import { promotionsApi, promotionsKeys } from '../api/promotions.api';

export default function FlashSalesPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [sale, setSale] = useState(null);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const { data: sales = [], isLoading } = useQuery({ queryKey: promotionsKeys.flashSales, queryFn: promotionsApi.flashSales });
  const { data: listings = [] } = useQuery({ queryKey: ['seller', 'promo', 'listings-source'], queryFn: promotionsApi.myLiveListings, enabled: Boolean(sale) });

  const submit = async (values) => {
    setSaving(true);
    try {
      const res = await promotionsApi.nominate(sale.id, { offerId: values.offerId, flashPricePaise: rupeesToPaise(values.flashPrice), committedStock: values.stock });
      message[res.autoRejected ? 'warning' : 'success'](
        res.autoRejected ? `Auto-rejected: below the minimum ${sale.minDiscountPct}% discount.` : 'Nomination submitted for curation.',
      );
      setSale(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: promotionsKeys.flashSales });
      queryClient.invalidateQueries({ queryKey: promotionsKeys.nominations });
    } catch (e) {
      message.error(e?.message ?? 'Could not submit the nomination.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Flex vertical gap={16}>
      <PageHeader
        title="Flash Sales"
        breadcrumbs={[{ label: 'Growth & Ads' }, { label: 'Flash Sales' }]}
        subtitle="Nominate your listings into an upcoming flash sale."
        actions={<Button onClick={() => navigate('/promotions/nominations')}>My nominations</Button>}
      />

      <Row gutter={[16, 16]}>
        {sales.map((s) => (
          <Col xs={24} sm={12} lg={8} key={s.id}>
            <Card
              size="small"
              loading={isLoading}
              title={s.name}
              extra={<StatusTag domain="flashSale" code={s.status} />}
              actions={s.nominationsOpen ? [<Button key="nom" type="link" onClick={() => setSale(s)}>Nominate a listing</Button>] : undefined}
            >
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}><DateText value={s.startsAt} withTime /> – <DateText value={s.endsAt} withTime /></Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>Min. {s.minDiscountPct}% off · {s.categoryRootNames?.join(', ')}</Typography.Text>
                {s.myNominations > 0 && <Tag color="blue">{s.myNominations} of your listings nominated</Tag>}
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      <Modal title={`Nominate for ${sale?.name ?? ''}`} open={Boolean(sale)} onCancel={() => setSale(null)} onOk={() => form.submit()} okText="Submit nomination" confirmLoading={saving}>
        <Typography.Paragraph type="secondary">Needs at least {sale?.minDiscountPct}% off your current price.</Typography.Paragraph>
        <Form form={form} layout="vertical" onFinish={submit}>
          <Form.Item name="offerId" label="Listing" rules={[{ required: true, message: 'Pick a listing.' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Select a live listing"
              options={listings.map((l) => ({ value: l.id, label: `${l.productTitle} — ₹${paiseToRupees(l.sellingPricePaise)}` }))}
            />
          </Form.Item>
          <Form.Item name="flashPrice" label="Flash-sale price (₹)" rules={[{ required: true, message: 'Enter the flash price.' }]}>
            <InputNumber style={{ width: '100%' }} min={1} prefix="₹" />
          </Form.Item>
          <Form.Item name="stock" label="Stock to commit" rules={[{ required: true, message: 'Enter the stock you can commit.' }]}>
            <InputNumber style={{ width: '100%' }} min={1} />
          </Form.Item>
        </Form>
      </Modal>
    </Flex>
  );
}
