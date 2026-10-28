import { App, Button, Card, Col, Divider, Flex, Form, Input, InputNumber, Row, Select, Space, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '@core/api/errors';
import { rupeesToPaise } from '@core/utils/money';
import ImageUpload from '@ui/components/ImageUpload/ImageUpload';
import PageHeader from '@ui/components/PageHeader';
import { listingKeys, listingsApi } from '../api/listings.api';
import SimpleProductFields from '../components/SimpleProductFields';
import VariantMatrix from '../components/VariantMatrix';

const RETURN_TYPES = [
  { value: 'RETURN', label: 'Returnable' },
  { value: 'REPLACEMENT', label: 'Replacement only' },
  { value: 'NONE', label: 'No returns' },
];

export default function AddProductPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [categoryId, setCategoryId] = useState(null);
  const [images, setImages] = useState([]);
  const [variants, setVariants] = useState([]);
  const [saving, setSaving] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  const { data: categories = [] } = useQuery({ queryKey: listingKeys.categories, queryFn: listingsApi.categories });
  const { data: brands = [] } = useQuery({ queryKey: listingKeys.brands, queryFn: listingsApi.brands });
  const { data: catAttrs } = useQuery({
    queryKey: ['seller', 'catalog', 'attributes', categoryId],
    queryFn: () => listingsApi.categoryAttributes(categoryId),
    enabled: Boolean(categoryId),
  });

  const returnType = Form.useWatch('returnType', form);
  const attributes = useMemo(() => catAttrs?.attributes ?? [], [catAttrs]);
  const variantAttrs = useMemo(() => attributes.filter((a) => a.variantDefining), [attributes]);
  const plainAttrs = useMemo(() => attributes.filter((a) => !a.variantDefining), [attributes]);
  const sizeCharts = catAttrs?.sizeCharts ?? [];

  const onCategoryChange = (value) => {
    setCategoryId(value);
    setVariants([]);
    form.setFieldValue('sizeChartId', undefined);
  };

  const buildPayload = (values, isDraft) => {
    const attrValues = {};
    for (const attr of plainAttrs) {
      const key = attr.code ?? attr.name ?? attr.id;
      const v = values[`attr_${key}`];
      if (v !== undefined && v !== null && v !== '') attrValues[key] = v;
    }

    const payload = {
      title: (values.title ?? '').trim(),
      categoryId: values.categoryId,
      brandId: values.brandId ?? null,
      description: values.description ?? '',
      highlights: (values.highlights ?? '').split('\n').map((s) => s.trim()).filter(Boolean),
      images,
      attributes: attrValues,
      sizeChartId: values.sizeChartId ?? null,
      returnPolicy: { windowDays: values.returnWindowDays ?? 7, type: values.returnType ?? 'RETURN' },
      fulfillmentType: values.fulfillmentType ?? 'SELLER',
      status: isDraft ? 'DRAFT' : undefined,
    };

    if (variantAttrs.length) {
      payload.variants = variants.map((v) => ({
        sku: v.sku,
        attributes: v.attributes,
        label: v.label,
        mrpPaise: v.mrpPaise,
        sellingPricePaise: v.sellingPricePaise,
        stock: v.stock,
        weightG: v.weightG,
        dimsCm: v.dimsCm,
        images: v.images,
      }));
    } else {
      payload.mrpPaise = rupeesToPaise(values.mrp);
      payload.sellingPricePaise = rupeesToPaise(values.price);
      payload.stock = values.stock ?? 0;
      payload.weightG = values.weightG ?? 500;
      payload.dimsCm = { l: values.dimsL ?? 20, w: values.dimsW ?? 15, h: values.dimsH ?? 5 };
    }
    return payload;
  };

  const create = async (payload, isDraft) => {
    try {
      const created = await listingsApi.create(payload);
      message.success(isDraft ? 'Saved as draft.' : 'Listing submitted for QC review.');
      navigate(`/listings/${created.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors) {
        form.setFields(
          Object.entries(e.fieldErrors).map(([name, errors]) => ({
            name: name === 'mrpPaise' ? 'mrp' : name === 'sellingPricePaise' ? 'price' : name,
            errors: [errors],
          })),
        );
      }
      message.error(e instanceof ApiError ? e.message : 'Could not create the listing.');
    }
  };

  const submit = async (values) => {
    if (variantAttrs.length && !variants.length) {
      message.warning('Pick at least one value for each variant option above.');
      return;
    }
    setSaving(true);
    try {
      await create(buildPayload(values, false), false);
    } finally {
      setSaving(false);
    }
  };

  const saveDraft = async () => {
    setSavingDraft(true);
    try {
      const values = form.getFieldsValue();
      if (!values.title || !values.categoryId) {
        message.warning('Give the product at least a title and category before saving a draft.');
        return;
      }
      await create(buildPayload(values, true), true);
    } finally {
      setSavingDraft(false);
    }
  };

  return (
    <Flex vertical gap={16}>
      <PageHeader
        title="Add a product"
        breadcrumbs={[{ label: 'Listings', to: '/listings' }, { label: 'Add product' }]}
        subtitle="New listings go through a quick QC review before they go live."
        onBack={() => navigate('/listings')}
      />

      <Form form={form} layout="vertical" requiredMark onFinish={submit} initialValues={{ fulfillmentType: 'SELLER', stock: 0, returnWindowDays: 7, returnType: 'RETURN' }}>
        <Row gutter={16}>
          <Col xs={24} lg={16}>
            <Card title="Product details" style={{ marginBottom: 16 }}>
              <Form.Item name="categoryId" label="Category" rules={[{ required: true, message: 'Pick a category.' }]}>
                <Select
                  showSearch
                  placeholder="Search for the right category"
                  optionFilterProp="label"
                  onChange={onCategoryChange}
                  options={categories.map((c) => ({ value: c.id, label: c.path }))}
                />
              </Form.Item>
              <Form.Item name="title" label="Product title" rules={[{ required: true, message: 'Enter a title.' }]}>
                <Input placeholder="e.g. Nova Cotton Round-Neck T-Shirt (Navy)" maxLength={200} showCount />
              </Form.Item>
              <Form.Item name="brandId" label="Brand">
                <Select
                  showSearch
                  allowClear
                  placeholder="Select a brand (or request a new one later)"
                  optionFilterProp="label"
                  options={brands.map((b) => ({ value: b.id, label: b.gated ? `${b.name} (gated)` : b.name }))}
                />
              </Form.Item>
              <Form.Item name="description" label="Description">
                <Input.TextArea rows={4} placeholder="Describe the product for buyers." maxLength={2000} showCount />
              </Form.Item>
              <Form.Item name="highlights" label="Highlights" extra="One per line.">
                <Input.TextArea rows={3} placeholder={'Machine washable\n100% cotton\n1-year warranty'} />
              </Form.Item>
              {sizeCharts.length > 0 && (
                <Form.Item name="sizeChartId" label="Size chart">
                  <Select allowClear placeholder="Attach a size chart" options={sizeCharts.map((s) => ({ value: s.id, label: s.name }))} />
                </Form.Item>
              )}
            </Card>

            {plainAttrs.length > 0 && (
              <Card title="Category attributes" style={{ marginBottom: 16 }}>
                <Row gutter={16}>
                  {plainAttrs.map((attr) => {
                    const key = attr.code ?? attr.name ?? attr.id;
                    const options = attr.values ?? null;
                    return (
                      <Col xs={24} sm={12} key={key}>
                        <Form.Item name={`attr_${key}`} label={attr.name ?? key}>
                          {Array.isArray(options) && options.length ? (
                            <Select
                              allowClear
                              placeholder={`Select ${attr.name}`}
                              options={options.map((o) => ({ value: o.value, label: o.value }))}
                            />
                          ) : (
                            <Input placeholder={`Enter ${attr.name}`} />
                          )}
                        </Form.Item>
                      </Col>
                    );
                  })}
                </Row>
              </Card>
            )}

            <Card title="Images" style={{ marginBottom: 16 }} extra={<Typography.Text type="secondary" style={{ fontSize: 12 }}>Shown on the product page</Typography.Text>}>
              <ImageUpload value={images} onChange={setImages} maxCount={8} label="Product" />
            </Card>

            <Card title="Variants, pricing & stock">
              {categoryId ? (
                <VariantMatrix variantAttrs={variantAttrs} value={variants} onChange={setVariants} skuPrefix="SKU" />
              ) : (
                <Typography.Text type="secondary">Pick a category to see its variant options.</Typography.Text>
              )}

              {!variantAttrs.length && categoryId && <SimpleProductFields />}
            </Card>
          </Col>

          <Col xs={24} lg={8}>
            <Card title="Fulfilment & returns" style={{ marginBottom: 16 }}>
              <Form.Item name="fulfillmentType" label="Fulfilment">
                <Select
                  options={[
                    { value: 'SELLER', label: 'I will ship (Self-ship)' },
                    { value: 'ARISE', label: 'Fulfilled by Arise (FBA)' },
                  ]}
                />
              </Form.Item>
              <Divider style={{ margin: '8px 0 16px' }} />
              <Form.Item name="returnType" label="Return policy">
                <Select options={RETURN_TYPES} />
              </Form.Item>
              <Form.Item
                name="returnWindowDays"
                label="Return window"
                extra="Days after delivery the buyer can return or replace this."
              >
                <InputNumber style={{ width: '100%' }} min={0} max={60} addonAfter="days" disabled={returnType === 'NONE'} />
              </Form.Item>
            </Card>

            <Space direction="vertical" style={{ width: '100%' }}>
              <Button type="primary" size="large" block htmlType="submit" loading={saving} disabled={savingDraft}>
                Submit for QC
              </Button>
              <Button block loading={savingDraft} disabled={saving} onClick={saveDraft}>
                Save as draft
              </Button>
              <Button block onClick={() => navigate('/listings')}>
                Cancel
              </Button>
            </Space>
          </Col>
        </Row>
      </Form>
    </Flex>
  );
}
