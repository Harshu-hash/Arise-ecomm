import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Card, Flex, InputNumber, Popconfirm, Select, Switch, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';

// `label`/`about` are plain-language; `limit` marks sections whose item count the app can cap;
// `inApp: false` marks types the customer app does not render yet.
const SECTIONS = {
  HERO_BANNER_CAROUSEL: { label: 'Hero banners', about: 'The big banners at the very top. Add or change them on the Banners page.', limit: true },
  RECENTLY_VIEWED_RAIL: { label: 'Recently viewed', about: 'Products this customer opened lately. Shown only to signed-in customers who have viewed something.', limit: true },
  AD_TILE_ROW: { label: 'Shop banner ads', about: 'Paid shop-banner slots under the hero. Managed on Shop Banner Ads.', limit: true },
  FLASH_SALE_BANNER: { label: 'Flash sale', about: 'The running flash sale. Appears only while a flash sale is live (Campaigns page).' },
  SUGGESTED_FOR_YOU: { label: 'Suggested for you', about: 'Personal picks: what the customer viewed first, then the best discounts.', limit: true },
  TOP_VALUE_DEALS: { label: 'Top value deals', about: 'Offer cards from Campaigns. Appears when a campaign is placed here.', limit: true },
  BRANDS_SPOTLIGHT: { label: 'Brands in spotlight', about: 'The brands with the most live products, with their best discount.', limit: true },
  PRODUCT_FEED: { label: 'Product feed', about: 'The product grid at the bottom of the home screen.', limit: true },
  AD_SHEET_CARD: { label: 'Ad sheet card', about: 'A single advert card.', inApp: false },
  SPONSORED_RAIL: { label: 'Sponsored rail', about: 'A rail of sponsored products.', inApp: false },
};
const MAX_ITEMS = { min: 1, max: 30 }; // keep in step with the server's MAX_ITEMS_RANGE
// Rows an admin may add more than once; every other section can appear a single time.
const REPEATABLE = ['AD_TILE_ROW', 'TOP_VALUE_DEALS'];

/**
 * The home screen's sections, in plain terms: switch each on or off, move it up or down, and (where it applies)
 * choose how many items it shows. Every change is saved to the draft straight away; nothing reaches customers
 * until the layout is published.
 */
export default function SectionEditor({ sections, onChange, saving }) {
  const [local, setLocal] = useState(sections);
  const [adding, setAdding] = useState(null);

  useEffect(() => setLocal(sections), [sections]);

  const commit = (next) => {
    setLocal(next);
    onChange(next);
  };
  const patch = (index, change) => commit(local.map((s, i) => (i === index ? { ...s, ...change } : s)));

  const move = (index, dir) => {
    const next = [...local];
    const [row] = next.splice(index, 1);
    next.splice(index + dir, 0, row);
    commit(next);
  };

  // Blank means "show everything"; out-of-range numbers are pulled back into range.
  const setMaxItems = (index, raw) => {
    const n = Number.parseInt(raw, 10);
    const config = Number.isNaN(n) ? {} : { maxItems: Math.min(MAX_ITEMS.max, Math.max(MAX_ITEMS.min, n)) };
    if ((local[index].config?.maxItems ?? null) !== (config.maxItems ?? null)) patch(index, { config });
  };

  const addSection = () => {
    commit([...local, { type: adding, config: {}, visibility: { enabled: true } }]);
    setAdding(null);
  };

  const available = Object.keys(SECTIONS).filter(
    (type) => SECTIONS[type].inApp !== false && (REPEATABLE.includes(type) || !local.some((s) => s.type === type)),
  );

  return (
    <Flex vertical gap={10}>
      {saving && <Typography.Text type="secondary" style={{ fontSize: 12 }}>Saving…</Typography.Text>}

      {local.map((section, index) => {
        const info = SECTIONS[section.type] ?? { label: section.type, about: '' };
        const shown = section.visibility?.enabled !== false;
        return (
          <Card key={`${section.type}-${index}`} size="small" style={{ opacity: shown ? 1 : 0.65 }}>
            <Flex justify="space-between" align="flex-start" gap={12}>
              <Flex vertical gap={6} style={{ flex: 1, minWidth: 0 }}>
                <Flex gap={8} align="center" wrap>
                  <Typography.Text strong style={{ fontSize: 14 }}>{info.label}</Typography.Text>
                  <Tag color={shown ? 'green' : 'default'} style={{ marginInlineEnd: 0 }}>{shown ? 'Shown' : 'Hidden'}</Tag>
                  {info.inApp === false && <Tag color="gold" style={{ marginInlineEnd: 0 }}>Not in the app yet</Tag>}
                </Flex>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>{info.about}</Typography.Text>
                {info.limit && (
                  <Flex gap={8} align="center">
                    <Typography.Text style={{ fontSize: 13 }}>Items to show</Typography.Text>
                    <InputNumber
                      size="small" min={MAX_ITEMS.min} max={MAX_ITEMS.max} precision={0} placeholder="All" style={{ width: 90 }}
                      defaultValue={section.config?.maxItems}
                      key={section.config?.maxItems ?? 'all'}
                      onBlur={(e) => setMaxItems(index, e.target.value)}
                      onPressEnter={(e) => setMaxItems(index, e.target.value)}
                    />
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>Leave empty to show all</Typography.Text>
                  </Flex>
                )}
              </Flex>

              <Flex vertical align="center" gap={6}>
                <Switch
                  checked={shown} checkedChildren="Show" unCheckedChildren="Hide" aria-label={`Show ${info.label}`}
                  onChange={(enabled) => patch(index, { visibility: { enabled } })}
                />
                <Flex gap={2}>
                  <Button size="small" type="text" icon={<ArrowUpOutlined />} disabled={index === 0} onClick={() => move(index, -1)} aria-label="Move up" />
                  <Button size="small" type="text" icon={<ArrowDownOutlined />} disabled={index === local.length - 1} onClick={() => move(index, 1)} aria-label="Move down" />
                  <Popconfirm title="Remove this section?" okText="Remove" okButtonProps={{ danger: true }} onConfirm={() => commit(local.filter((_, i) => i !== index))}>
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label="Remove section" />
                  </Popconfirm>
                </Flex>
              </Flex>
            </Flex>
          </Card>
        );
      })}

      <Flex gap={8}>
        <Select
          placeholder="Add a section"
          style={{ width: 240 }}
          value={adding}
          onChange={setAdding}
          options={available.map((type) => ({ value: type, label: SECTIONS[type].label }))}
          notFoundContent="Every section is already on the page"
        />
        <Button icon={<PlusOutlined />} onClick={addSection} disabled={!adding}>Add</Button>
      </Flex>
    </Flex>
  );
}
