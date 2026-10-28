import { App, Button, Card, Checkbox, Col, Flex, Form, Input, InputNumber, Radio, Row, Space, Typography } from 'antd';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { rupeesToPaise } from '@core/utils/money';
import PageHeader from '@ui/components/PageHeader';
import { adsApi } from '../api/ads.api';

export default function CreateCampaignPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const { data: listings = [] } = useQuery({ queryKey: ['seller', 'ads', 'listings-source'], queryFn: adsApi.myLiveListings });

  const submit = async (values) => {
    setSaving(true);
    try {
      const created = await adsApi.create({
        name: values.name,
        productIds: values.productIds,
        biddingType: values.biddingType,
        dailyBudgetPaise: rupeesToPaise(values.dailyBudget),
        totalBudgetPaise: rupeesToPaise(values.totalBudget),
        defaultBidPaise: values.biddingType === 'MANUAL_CPC' ? rupeesToPaise(values.defaultBid) : undefined,
      });
      if (values.submitNow) await adsApi.submit(created.id);
      message.success(values.submitNow ? 'Campaign submitted for review.' : 'Draft campaign created.');
      navigate(`/ads/${created.id}`);
    } catch (e) {
      message.error(e?.message ?? 'Could not create the campaign.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Flex vertical gap={16}>
      <PageHeader title="Create a campaign" breadcrumbs={[{ label: 'Growth & Ads', to: '/ads' }, { label: 'New campaign' }]} onBack={() => navigate('/ads')} subtitle="Promote your live listings in search results and on product pages." />

      <Form form={form} layout="vertical" onFinish={submit} initialValues={{ biddingType: 'AUTOMATIC', dailyBudget: 300, totalBudget: 9000, defaultBid: 2, submitNow: true }}>
        <Row gutter={16}>
          <Col xs={24} lg={14}>
            <Card title="Campaign details" style={{ marginBottom: 16 }}>
              <Form.Item name="name" label="Campaign name" rules={[{ required: true, message: 'Name your campaign.' }]}>
                <Input placeholder="e.g. Summer Launch — T-Shirts" />
              </Form.Item>
              <Form.Item name="productIds" label="Products to promote" rules={[{ required: true, message: 'Pick at least one listing.' }]} extra="Only your live listings can be promoted.">
                <Checkbox.Group style={{ width: '100%' }}>
                  <Space direction="vertical" style={{ width: '100%', maxHeight: 280, overflowY: 'auto' }}>
                    {listings.map((l) => (
                      <Checkbox key={l.productId} value={l.productId} style={{ width: '100%' }}>
                        {l.productTitle} {l.sku ? `(${l.sku})` : ''}
                      </Checkbox>
                    ))}
                    {!listings.length && <Typography.Text type="secondary">No live listings yet — list a product first.</Typography.Text>}
                  </Space>
                </Checkbox.Group>
              </Form.Item>
            </Card>
          </Col>

          <Col xs={24} lg={10}>
            <Card title="Bidding & budget">
              <Form.Item name="biddingType" label="Targeting">
                <Radio.Group>
                  <Space direction="vertical">
                    <Radio value="AUTOMATIC">Automatic — Arise targets relevant searches</Radio>
                    <Radio value="MANUAL_CPC">Manual CPC — choose your own keywords</Radio>
                  </Space>
                </Radio.Group>
              </Form.Item>
              <Form.Item
                noStyle
                shouldUpdate={(prev, cur) => prev.biddingType !== cur.biddingType}
              >
                {({ getFieldValue }) =>
                  getFieldValue('biddingType') === 'MANUAL_CPC' && (
                    <Form.Item name="defaultBid" label="Default bid (₹ per click)" rules={[{ required: true, message: 'Set a bid.' }]}>
                      <InputNumber style={{ width: '100%' }} min={0.5} step={0.5} prefix="₹" />
                    </Form.Item>
                  )
                }
              </Form.Item>
              <Form.Item name="dailyBudget" label="Daily budget (₹)" rules={[{ required: true, message: 'Set a daily budget.' }]}>
                <InputNumber style={{ width: '100%' }} min={50} prefix="₹" />
              </Form.Item>
              <Form.Item name="totalBudget" label="Total budget (₹)">
                <InputNumber style={{ width: '100%' }} min={50} prefix="₹" />
              </Form.Item>
              <Form.Item name="submitNow" valuePropName="checked" style={{ marginBottom: 0 }}>
                <Checkbox>Submit for review now (otherwise saved as a draft)</Checkbox>
              </Form.Item>
            </Card>
          </Col>
        </Row>

        <Space>
          <Button type="primary" htmlType="submit" loading={saving}>Create campaign</Button>
          <Button onClick={() => navigate('/ads')}>Cancel</Button>
        </Space>
      </Form>
    </Flex>
  );
}
