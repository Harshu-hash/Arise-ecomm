/* eslint-disable max-lines */
import { App, Col, Divider, Form, Input, InputNumber, Modal, Row, Select, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { paiseToRupees, rupeesToPaise } from '@core/utils/money';
import ImageUpload from '@ui/components/ImageUpload/ImageUpload';
import { listingKeys, listingsApi } from '../api/listings.api';

const RETURN_TYPES = [
  { value: 'RETURN', label: 'Returnable' },
  { value: 'REPLACEMENT', label: 'Replacement only' },
  { value: 'NONE', label: 'No returns' },
];

// Stored images come back as keys + URLs; the upload widget wants records. The key doubles as the id,
// which the backend recognises as "already on the product".
const existing = (keys = [], urls = []) =>
  keys.map((key, i) => ({ id: key, previewUrl: urls[i], fileName: `Image ${i + 1}`, status: 'READY' }));
const mediaIds = (list) => list.map((item) => item.mediaId ?? item.id).filter(Boolean);
const attrKey = (a) => a.code ?? a.name ?? a.id;

/** The "Edit" modal on a listing's detail page: the whole product and every variant. */
export default function EditListingModal({ data, open, onClose, onSaved }) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [images, setImages] = useState([]);
  const [variantImages, setVariantImages] = useState({});
  const { product, variants = [] } = data;

  const { data: catAttrs } = useQuery({
    queryKey: ['seller', 'catalog', 'attributes', product.categoryId],
    queryFn: () => listingsApi.categoryAttributes(product.categoryId),
    enabled: open,
  });
  const { data: brands = [] } = useQuery({ queryKey: listingKeys.brands, queryFn: listingsApi.brands, enabled: open });
  const plainAttrs = (catAttrs?.attributes ?? []).filter((a) => !a.variantDefining);
  const sizeCharts = catAttrs?.sizeCharts ?? [];
  const returnType = Form.useWatch('returnType', form);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue({
      title: product.title,
      brandId: product.brandId ?? undefined,
      description: product.description,
      highlights: (product.highlights ?? []).join('\n'),
      manufacturer: product.manufacturer,
      countryOfOrigin: product.countryOfOrigin,
      productCode: product.productCode,
      modelInfo: product.modelInfo,
      sizeChartId: product.sizeChartId ?? undefined,
      returnType: product.returnPolicy?.type ?? 'RETURN',
      returnWindowDays: product.returnPolicy?.windowDays ?? 7,
      attrs: product.attributes ?? {},
      variants: variants.map((v) => ({
        price: paiseToRupees(v.sellingPricePaise),
        mrp: paiseToRupees(v.mrpPaise),
        stock: v.stock,
        sellerSku: v.sellerSku,
        ean: v.ean,
        weightG: v.weightG,
        l: v.dimsCm?.l,
        w: v.dimsCm?.w,
        h: v.dimsCm?.h,
      })),
    });
    setImages(existing(product.images, product.imageUrls));
    setVariantImages(Object.fromEntries(variants.map((v) => [v.offerId, existing(v.images, v.imageUrls)])));
  }, [open, product, variants, form]);

  const save = useMutation({
    mutationFn: (v) =>
      listingsApi.update(data.id, {
        title: v.title,
        brandId: v.brandId ?? null,
        description: v.description ?? '',
        highlights: (v.highlights ?? '').split('\n').map((s) => s.trim()).filter(Boolean),
        images: mediaIds(images),
        attributes: Object.fromEntries(
          Object.entries(v.attrs ?? {}).filter(([, val]) => val !== undefined && val !== null && val !== ''),
        ),
        manufacturer: v.manufacturer ?? '',
        countryOfOrigin: v.countryOfOrigin ?? '',
        productCode: v.productCode || null,
        modelInfo: v.modelInfo || null,
        sizeChartId: v.sizeChartId ?? null,
        returnPolicy: { type: v.returnType, windowDays: v.returnType === 'NONE' ? 0 : v.returnWindowDays ?? 7 },
        variants: variants.map((variant, i) => {
          const row = v.variants[i];
          return {
            offerId: variant.offerId,
            sellingPricePaise: rupeesToPaise(row.price),
            mrpPaise: rupeesToPaise(row.mrp),
            stock: row.stock ?? 0,
            sellerSku: row.sellerSku || undefined,
            ean: row.ean ?? '',
            weightG: row.weightG,
            dimsCm: { l: row.l, w: row.w, h: row.h },
            images: mediaIds(variantImages[variant.offerId] ?? []),
          };
        }),
      }),
    onSuccess: () => {
      message.success('Product updated.');
      onSaved();
    },
    onError: (e) => message.error(e?.fieldErrors ? Object.values(e.fieldErrors).flat().join(' ') : (e?.message ?? 'Could not save.')),
  });

  return (
    <Modal
      title="Edit product"
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="Save changes"
      confirmLoading={save.isPending}
      width={960}
      style={{ top: 24 }}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)} requiredMark>
        <Typography.Text type="secondary">
          Category: {product.categoryPath ?? '—'} (cannot be changed after creation)
        </Typography.Text>
        <Row gutter={16} style={{ marginTop: 12 }}>
          <Col xs={24} md={16}>
            <Form.Item name="title" label="Product title" rules={[{ required: true, whitespace: true, message: 'Enter a title.' }]}>
              <Input maxLength={200} showCount />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="brandId" label="Brand">
              <Select
                showSearch
                allowClear
                optionFilterProp="label"
                options={brands.map((b) => ({ value: b.id, label: b.gated ? `${b.name} (gated)` : b.name }))}
              />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="description" label="Description">
          <Input.TextArea rows={4} maxLength={2000} showCount />
        </Form.Item>
        <Form.Item name="highlights" label="Highlights" extra="One per line.">
          <Input.TextArea rows={3} />
        </Form.Item>
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item name="manufacturer" label="Manufacturer" rules={[{ required: true, whitespace: true, message: 'Enter the manufacturer.' }]}>
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="countryOfOrigin" label="Country of origin" rules={[{ required: true, whitespace: true, message: 'Required.' }]}>
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="productCode" label="Product code / MPN">
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="modelInfo" label="Model info">
              <Input />
            </Form.Item>
          </Col>
          {sizeCharts.length > 0 && (
            <Col xs={24} md={12}>
              <Form.Item name="sizeChartId" label="Size chart">
                <Select allowClear options={sizeCharts.map((s) => ({ value: s.id, label: s.name }))} />
              </Form.Item>
            </Col>
          )}
          <Col xs={24} md={6}>
            <Form.Item name="returnType" label="Return policy">
              <Select options={RETURN_TYPES} />
            </Form.Item>
          </Col>
          <Col xs={24} md={6}>
            <Form.Item name="returnWindowDays" label="Return window (days)">
              <InputNumber style={{ width: '100%' }} min={0} max={60} disabled={returnType === 'NONE'} />
            </Form.Item>
          </Col>
        </Row>

        {plainAttrs.length > 0 && (
          <>
            <Divider orientation="left">Category attributes</Divider>
            <Row gutter={16}>
              {plainAttrs.map((attr) => (
                <Col xs={24} md={12} key={attrKey(attr)}>
                  <Form.Item name={['attrs', attrKey(attr)]} label={attr.name ?? attrKey(attr)}>
                    {attr.values?.length ? (
                      <Select allowClear options={attr.values.map((o) => ({ value: o.value, label: o.value }))} />
                    ) : (
                      <Input />
                    )}
                  </Form.Item>
                </Col>
              ))}
            </Row>
          </>
        )}

        <Divider orientation="left">Product images</Divider>
        <ImageUpload value={images} onChange={setImages} maxCount={8} label="Product" />

        <Divider orientation="left">Variants</Divider>
        {variants.map((variant, i) => (
          <div key={variant.offerId} style={{ border: '1px solid var(--ant-color-border)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <Typography.Text strong>
              {variant.label ?? 'Default'} <Typography.Text type="secondary">· {variant.sku}</Typography.Text>
            </Typography.Text>
            <Row gutter={12} style={{ marginTop: 8 }}>
              <Col xs={12} md={6}>
                <Form.Item name={['variants', i, 'price']} label="Selling price (₹)" rules={[{ required: true, message: 'Required' }]}>
                  <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={12} md={6}>
                <Form.Item
                  name={['variants', i, 'mrp']}
                  label="MRP (₹)"
                  dependencies={[['variants', i, 'price']]}
                  rules={[
                    { required: true, message: 'Required' },
                    ({ getFieldValue }) => ({
                      validator: (_r, mrp) =>
                        mrp < getFieldValue(['variants', i, 'price'])
                          ? Promise.reject(new Error('MRP must be at least the selling price.'))
                          : Promise.resolve(),
                    }),
                  ]}
                >
                  <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={12} md={6}>
                <Form.Item name={['variants', i, 'stock']} label="Stock" rules={[{ required: true, message: 'Required' }]}>
                  <InputNumber min={0} precision={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={12} md={6}>
                <Form.Item name={['variants', i, 'ean']} label="Barcode / EAN">
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} md={6}>
                <Form.Item name={['variants', i, 'sellerSku']} label="Seller SKU">
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={12} md={6}>
                <Form.Item name={['variants', i, 'weightG']} label="Weight (g)" rules={[{ required: true, message: 'Required' }]}>
                  <InputNumber min={1} precision={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              {['l', 'w', 'h'].map((d) => (
                <Col xs={8} md={4} key={d}>
                  <Form.Item name={['variants', i, d]} label={`${{ l: 'Length', w: 'Width', h: 'Height' }[d]} (cm)`} rules={[{ required: true, message: 'Required' }]}>
                    <InputNumber min={1} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              ))}
            </Row>
            <ImageUpload
              value={variantImages[variant.offerId] ?? []}
              onChange={(next) => setVariantImages((cur) => ({ ...cur, [variant.offerId]: next }))}
              maxCount={4}
              label={variant.label ?? 'Variant'}
            />
          </div>
        ))}
        {data.productStatus === 'LIVE' && (
          <Typography.Text type="secondary">
            This product is live: saved changes go to customers immediately.
          </Typography.Text>
        )}
      </Form>
    </Modal>
  );
}
