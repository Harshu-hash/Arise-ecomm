import { Alert, Col, Flex, Input, InputNumber, Row, Select, Space, Table, Tag, Typography } from 'antd';
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

function defaultRow(combo, index, skuPrefix) {
  const attributes = Object.fromEntries(combo.map((c) => [c.code, c.value]));
  return {
    key: comboKey(combo),
    attributes,
    label: combo.map((c) => c.value).join(' · '),
    sku: `${skuPrefix}-${index + 1}`,
    mrpPaise: null,
    sellingPricePaise: null,
    stock: 0,
    weightG: 500,
    dimsCm: { l: 20, w: 15, h: 5 },
    images: [],
  };
}

/**
 * Lets the seller pick which values of each variant-defining attribute
 * (colour, size, …) this listing comes in, then renders one editable row per
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
    const existing = new Map((value ?? []).map((r) => [r.key ?? comboKey(Object.entries(r.attributes).map(([code, v]) => ({ code, value: v }))), r]));
    const nextRows = combos.map((combo, i) => existing.get(comboKey(combo)) ?? defaultRow(combo, i, skuPrefix));
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
            <Typography.Text strong style={{ fontSize: 12 }}>{attr.name}</Typography.Text>
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
        <Table
          size="small"
          rowKey="key"
          pagination={false}
          dataSource={value}
          scroll={{ x: 'max-content' }}
          columns={[
            {
              title: 'Variant', dataIndex: 'label', fixed: 'left', width: 140,
              render: (label) => <Tag style={{ marginInlineEnd: 0 }}>{label}</Tag>,
            },
            {
              title: 'SKU', dataIndex: 'sku', width: 150,
              render: (v, row) => <Input size="small" value={v} onChange={(e) => updateRow(row.key, { sku: e.target.value })} />,
            },
            {
              title: 'MRP (₹)', dataIndex: 'mrpPaise', width: 110,
              render: (v, row) => (
                <InputNumber size="small" style={{ width: '100%' }} min={1} value={v ? v / 100 : null} onChange={(n) => updateRow(row.key, { mrpPaise: n ? Math.round(n * 100) : null })} />
              ),
            },
            {
              title: 'Price (₹)', dataIndex: 'sellingPricePaise', width: 110,
              render: (v, row) => (
                <InputNumber size="small" style={{ width: '100%' }} min={1} value={v ? v / 100 : null} onChange={(n) => updateRow(row.key, { sellingPricePaise: n ? Math.round(n * 100) : null })} />
              ),
            },
            {
              title: 'Stock', dataIndex: 'stock', width: 90,
              render: (v, row) => <InputNumber size="small" style={{ width: '100%' }} min={0} value={v} onChange={(n) => updateRow(row.key, { stock: n ?? 0 })} />,
            },
            {
              title: 'Weight (g)', dataIndex: 'weightG', width: 100,
              render: (v, row) => <InputNumber size="small" style={{ width: '100%' }} min={1} value={v} onChange={(n) => updateRow(row.key, { weightG: n ?? 500 })} />,
            },
            {
              title: 'Dimensions L×W×H (cm)', dataIndex: 'dimsCm', width: 200,
              render: (v, row) => (
                <Space size={4}>
                  <InputNumber size="small" style={{ width: 56 }} min={1} value={v.l} onChange={(n) => updateRow(row.key, { dimsCm: { ...v, l: n ?? v.l } })} />
                  <InputNumber size="small" style={{ width: 56 }} min={1} value={v.w} onChange={(n) => updateRow(row.key, { dimsCm: { ...v, w: n ?? v.w } })} />
                  <InputNumber size="small" style={{ width: 56 }} min={1} value={v.h} onChange={(n) => updateRow(row.key, { dimsCm: { ...v, h: n ?? v.h } })} />
                </Space>
              ),
            },
            {
              title: 'Images', dataIndex: 'images', width: 240,
              render: (v, row) => <ImageUpload value={v} onChange={(images) => updateRow(row.key, { images })} maxCount={4} label={row.label} />,
            },
          ]}
        />
      )}
    </Flex>
  );
}
