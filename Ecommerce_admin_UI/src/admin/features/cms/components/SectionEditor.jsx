import { ArrowDownOutlined, ArrowUpOutlined, PushpinOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Flex, InputNumber, Switch, Tag, Typography } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import DateText from '@ui/components/DateText';
import StatusTag from '@ui/components/StatusTag';

// Always first, in this order, on the app's home screen. `altTypes` are old saved types that mean the same row
// (AD_SHEET_CARD and AD_TILE_ROW both draw from the one live ad-banner slot).
const PINNED = [
  { type: 'HERO_BANNER_CAROUSEL', label: 'Hero banners', about: 'The big banners at the very top. Add or change them on the Banners page.', limit: true },
  { type: 'AD_TILE_ROW', altTypes: ['AD_SHEET_CARD'], label: 'Shop banner ads', about: 'Paid shop-banner slots under the hero. Managed on Shop Banner Ads.', limit: true },
];
// One row each, placed anywhere below the pinned rows.
const MOVABLE = [
  { type: 'RECENTLY_VIEWED_RAIL', label: 'Recently viewed', about: 'Products this customer opened lately. Shown only to signed-in customers who have viewed something.', limit: true },
  { type: 'SUGGESTED_FOR_YOU', label: 'Suggested for you', about: 'Personal picks: what the customer viewed first, then the best discounts.', limit: true },
  { type: 'BRANDS_SPOTLIGHT', label: 'Brands in spotlight', about: 'The brands with the most live products, with their best discount.', limit: true },
  { type: 'PRODUCT_FEED', label: 'Product feed', about: 'The product grid of the home screen.', limit: true },
];
// One row per campaign placed on the home page (the server adds and removes these as campaigns come and go).
const CAMPAIGN_ROWS = {
  FLASH_SALE_BANNER: { label: 'Flash sale', about: 'Its flash-sale banner. Shows only while the campaign is live and has approved products.' },
  TOP_VALUE_DEALS: { label: 'Top value deal', about: 'Its Top Value Deals card. Deal cards placed next to each other share one row in the app.' },
};
const MAX_ITEMS = { min: 1, max: 30 }; // keep in step with the server's MAX_ITEMS_RANGE

const blank = (type) => ({ type, config: {}, visibility: { enabled: true } });
const keyOf = (section) => `${section.type}:${section.campaignId ?? ''}`;
const infoOf = (section) =>
  PINNED.find((row) => row.type === section.type) ?? MOVABLE.find((row) => row.type === section.type) ?? CAMPAIGN_ROWS[section.type];

// Pinned rows first, then the movable rows in their saved order. Drops what the app can never show (old
// SPONSORED_RAIL rows, campaign rows without a campaign) and adds any one-off row a draft never had, so publishing
// never silently hides it.
const normalize = (sections) => {
  const pinned = PINNED.map((row) => {
    const match = sections.find((s) => s.type === row.type || row.altTypes?.includes(s.type));
    return { ...blank(row.type), ...(match && { config: match.config ?? {}, visibility: match.visibility ?? { enabled: true } }) };
  });
  const movable = sections.filter((s) => (CAMPAIGN_ROWS[s.type] ? s.campaignId : MOVABLE.some((row) => row.type === s.type)));
  const unique = movable.filter((s, i) => movable.findIndex((other) => keyOf(other) === keyOf(s)) === i);
  const missing = MOVABLE.filter((row) => !unique.some((s) => s.type === row.type)).map((row) => blank(row.type));
  return [...pinned, ...unique, ...missing];
};

/**
 * The home screen top to bottom: the hero and shop banner ads stay pinned at the top; everything else, including
 * each flash sale and each top value deal on its own, can be moved, switched off and (where it applies) capped.
 * Every change is saved to the draft straight away; nothing reaches customers until the layout is published.
 */
export default function SectionEditor({ sections, onChange, saving }) {
  const [local, setLocal] = useState(() => normalize(sections));
  const seeded = useRef(false);

  useEffect(() => {
    const next = normalize(sections);
    setLocal(next);
    if (!seeded.current) {
      seeded.current = true;
      if (JSON.stringify(next) !== JSON.stringify(sections)) onChange(next);
    }
  }, [sections]);

  const commit = (next) => {
    setLocal(next);
    onChange(next);
  };
  const patch = (key, change) => commit(local.map((s) => (keyOf(s) === key ? { ...s, ...change } : s)));

  const move = (index, dir) => {
    const next = [...local];
    const [row] = next.splice(index, 1);
    next.splice(index + dir, 0, row);
    commit(next);
  };

  // Blank means "show everything"; out-of-range numbers are pulled back into range.
  const setMaxItems = (key, raw) => {
    const n = Number.parseInt(raw, 10);
    const config = Number.isNaN(n) ? {} : { maxItems: Math.min(MAX_ITEMS.max, Math.max(MAX_ITEMS.min, n)) };
    const current = local.find((s) => keyOf(s) === key);
    if ((current?.config?.maxItems ?? null) !== (config.maxItems ?? null)) patch(key, { config });
  };

  return (
    <Flex vertical gap={10}>
      {saving && <Typography.Text type="secondary" style={{ fontSize: 12 }}>Saving…</Typography.Text>}
      <Alert
        type="info"
        showIcon
        message="Top to bottom, as customers see it"
        description="Hero banners and shop banner ads always stay at the top. Move everything else into place — each flash sale and each top value deal is its own row, so they can go anywhere on the page."
      />

      {local.map((section, index) => {
        const key = keyOf(section);
        const info = infoOf(section);
        const pinned = index < PINNED.length;
        const shown = section.visibility?.enabled !== false;
        const { campaign } = section;
        return (
          <Card key={key} size="small" style={{ opacity: shown ? 1 : 0.65 }}>
            <Flex justify="space-between" align="flex-start" gap={12}>
              <Flex vertical gap={6} style={{ flex: 1, minWidth: 0 }}>
                <Flex gap={8} align="center" wrap>
                  <Typography.Text strong style={{ fontSize: 14 }}>{campaign?.name ?? info.label}</Typography.Text>
                  {campaign && <Tag style={{ marginInlineEnd: 0 }}>{info.label}</Tag>}
                  {campaign && <StatusTag domain="promoCampaign" code={campaign.status} />}
                  {pinned && <Tag icon={<PushpinOutlined />} style={{ marginInlineEnd: 0 }}>Pinned to the top</Tag>}
                </Flex>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>{info.about}</Typography.Text>
                {campaign && (
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    <DateText value={campaign.startsAt} /> – <DateText value={campaign.endsAt} /> · <Link to={`/campaigns/${campaign.id}`}>Open campaign</Link>
                  </Typography.Text>
                )}
                {info.limit && (
                  <Flex gap={8} align="center">
                    <Typography.Text style={{ fontSize: 13 }}>Items to show</Typography.Text>
                    <InputNumber
                      size="small" min={MAX_ITEMS.min} max={MAX_ITEMS.max} precision={0} placeholder="All" style={{ width: 90 }}
                      defaultValue={section.config?.maxItems}
                      key={section.config?.maxItems ?? 'all'}
                      onBlur={(e) => setMaxItems(key, e.target.value)}
                      onPressEnter={(e) => setMaxItems(key, e.target.value)}
                    />
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>Leave empty to show all</Typography.Text>
                  </Flex>
                )}
              </Flex>

              <Flex vertical align="center" gap={6}>
                <Switch
                  checked={shown} checkedChildren="Show" unCheckedChildren="Hide" aria-label={`Show ${campaign?.name ?? info.label}`}
                  onChange={(enabled) => patch(key, { visibility: { enabled } })}
                />
                {!pinned && (
                  <Flex gap={2}>
                    <Button size="small" type="text" icon={<ArrowUpOutlined />} disabled={index === PINNED.length} onClick={() => move(index, -1)} aria-label="Move up" />
                    <Button size="small" type="text" icon={<ArrowDownOutlined />} disabled={index === local.length - 1} onClick={() => move(index, 1)} aria-label="Move down" />
                  </Flex>
                )}
              </Flex>
            </Flex>
          </Card>
        );
      })}

      {!local.some((s) => s.campaign) && (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          No flash sales or top value deals are on the home page yet. Set a campaign as a home flash sale, or place it in Top Value Deals, on <Link to="/campaigns">Campaigns</Link> and it appears here.
        </Typography.Text>
      )}
    </Flex>
  );
}
