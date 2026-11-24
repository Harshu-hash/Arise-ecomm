/* eslint-disable max-lines */
import {
  Alert,
  Card,
  Col,
  Flex,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd';
import { useMemo } from 'react';
import ImageUpload from '@ui/components/ImageUpload/ImageUpload';

function cartesian(valueLists) {
  return valueLists.reduce(
    (acc, list) => acc.flatMap((combo) => list.map((v) => [...combo, v])),
    [[]],
  );
}

function comboKey(combo) {
  return combo.map((c) => `${c.code}:${c.value}`).join('|');
}

function defaultRow(combo, sku) {
  const attributes = Object.fromEntries(combo.map((c) => [c.code, c.value]));
  return {
    key: comboKey(combo),
    attributes,
    label: combo.map((c) => c.value).join(' · '),
    sku,
    sellerSku: sku,
    barcode: '',
    taxCode: '',
    mrpPaise: null,
    sellingPricePaise: null,
    stock: 0,
    weightG: 500,
    dimsCm: { l: 20, w: 15, h: 5 },
    images: [],
  };
}

/** One labeled field, stacked label-over-control like the rest of this form. */
function Field({ label, span = 6, children }) {
  return (
    <Col xs={24} sm={12} md={span}>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>{label}</Typography.Text>
      <div style={{ marginTop: 4 }}>{children}</div>
    </Col>
  );
}

/** One variant's full set of fields, as a simple form — no table, no horizontal scroll. */
function VariantCard({ row, onUpdate }) {
  return (
    <Card
      size="small"
      title={<Tag style={{ marginInlineEnd: 0 }}>{row.label}</Tag>}
      extra={
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {row.sellingPricePaise ? `₹${(row.sellingPricePaise / 100).toLocaleString('en-IN')}` : 'No price yet'} · Stock {row.stock}
        </Typography.Text>
      }
    >
      <Row gutter={[16, 16]}>
        <Field label="SKU">
          <Input value={row.sku} onChange={(e) => onUpdate({ sku: e.target.value })} />
        </Field>
        <Field label="Seller SKU">
          <Input value={row.sellerSku} onChange={(e) => onUpdate({ sellerSku: e.target.value })} />
        </Field>
        <Field label="Barcode / EAN">
          <Input value={row.barcode} onChange={(e) => onUpdate({ barcode: e.target.value })} />
        </Field>
        <Field label="Tax code">
          <Input value={row.taxCode} onChange={(e) => onUpdate({ taxCode: e.target.value })} />
        </Field>

        <Field label="MRP (₹)">
          <InputNumber
            style={{ width: '100%' }}
            min={1}
            value={row.mrpPaise ? row.mrpPaise / 100 : null}
            onChange={(n) => onUpdate({ mrpPaise: n ? Math.round(n * 100) : null })}
          />
        </Field>
        <Field label="Selling price (₹)">
          <InputNumber
            style={{ width: '100%' }}
            min={1}
            value={row.sellingPricePaise ? row.sellingPricePaise / 100 : null}
            onChange={(n) => onUpdate({ sellingPricePaise: n ? Math.round(n * 100) : null })}
          />
        </Field>
        <Field label="Stock">
          <InputNumber style={{ width: '100%' }} min={0} value={row.stock} onChange={(n) => onUpdate({ stock: n ?? 0 })} />
        </Field>
        <Field label="Weight (g)">
          <InputNumber style={{ width: '100%' }} min={1} value={row.weightG} onChange={(n) => onUpdate({ weightG: n ?? 500 })} />
        </Field>

        <Field label="Dimensions L × W × H (cm)" span={12}>
          <Space.Compact style={{ width: '100%' }}>
            <InputNumber style={{ width: '34%' }} min={1} placeholder="L" value={row.dimsCm.l} onChange={(n) => onUpdate({ dimsCm: { ...row.dimsCm, l: n ?? row.dimsCm.l } })} />
            <InputNumber style={{ width: '33%' }} min={1} placeholder="W" value={row.dimsCm.w} onChange={(n) => onUpdate({ dimsCm: { ...row.dimsCm, w: n ?? row.dimsCm.w } })} />
            <InputNumber style={{ width: '33%' }} min={1} placeholder="H" value={row.dimsCm.h} onChange={(n) => onUpdate({ dimsCm: { ...row.dimsCm, h: n ?? row.dimsCm.h } })} />
          </Space.Compact>
        </Field>

        <Field label="Images" span={24}>
          <ImageUpload value={row.images} onChange={(images) => onUpdate({ images })} maxCount={4} label={row.label} />
        </Field>
      </Row>
    </Card>
  );
}

/**
 * Lets the seller pick which values of each variant-defining attribute
 * (colour, size, …) this listing comes in, then renders one editable card per
 * combination — the matrix the mock handler's `variants[]` payload expects.
 */
export default function VariantMatrix({ variantAttrs, value = [], onChange, skuPrefix = 'SKU' }) {
  const selections = useMemo(() => {
    const out = {};
    for (const attr of variantAttrs) {
      const codes = new Set((value ?? []).map((r) => r.attributes?.[attr.code]).filter(Boolean));
      out[attr.code] = Array.from(codes);
    }
    return out;
  }, [variantAttrs, value]);

  const setSelection = (attr, picked) => {
    const nextSelections = { ...selections, [attr.code]: picked };
    const lists = variantAttrs.map((a) =>
      (nextSelections[a.code] ?? []).map((v) => ({ code: a.code, value: v })),
    );
    if (lists.some((l) => l.length === 0)) {
      onChange?.([]);
      return;
    }
    const combos = cartesian(lists);
    const existing = new Map(
      (value ?? []).map((r) => [
        r.key ?? comboKey(Object.entries(r.attributes).map(([code, v]) => ({ code, value: v }))),
        r,
      ]),
    );
    // A new row takes the next number no other row already uses, so editing the options never repeats a SKU.
    const taken = new Set((value ?? []).flatMap((r) => [r.sku, r.sellerSku]));
    let counter = 0;
    const nextSku = () => {
      do counter += 1;
      while (taken.has(`${skuPrefix}-${counter}`));
      taken.add(`${skuPrefix}-${counter}`);
      return `${skuPrefix}-${counter}`;
    };
    const nextRows = combos.map((combo) => existing.get(comboKey(combo)) ?? defaultRow(combo, nextSku()));
    onChange?.(nextRows);
  };

  const updateRow = (key, patch) => {
    onChange?.((value ?? []).map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  if (!variantAttrs.length) {
    return (
      <Alert
        type="info"
        showIcon
        message="This category has no variant-defining attributes"
        description="One listing will be created with a single set of price, stock and images below."
      />
    );
  }

  return (
    <Flex vertical gap={12}>
      <Row gutter={12}>
        {variantAttrs.map((attr) => (
          <Col xs={24} sm={12} key={attr.id}>
            <Typography.Text strong style={{ fontSize: 12 }}>
              {attr.name}
            </Typography.Text>
            <Select
              mode="multiple"
              style={{ width: '100%', marginTop: 4 }}
              placeholder={`Pick the ${attr.name.toLowerCase()}s you sell`}
              value={selections[attr.code] ?? []}
              onChange={(v) => setSelection(attr, v)}
              options={(attr.values ?? []).map((v) => ({ value: v.value, label: v.value }))}
            />
          </Col>
        ))}
      </Row>

      {value.length > 0 && (
        <Flex vertical gap={12}>
          {value.map((row) => (
            <VariantCard key={row.key} row={row} onUpdate={(patch) => updateRow(row.key, patch)} />
          ))}
        </Flex>
      )}
    </Flex>
  );
}
