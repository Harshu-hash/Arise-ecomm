import { Alert, Checkbox, Empty, Flex, InputNumber, Modal, Skeleton, Space, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { formatINR } from '@core/utils/money';
import { sellerCampaignKeys, sellerCampaignsApi } from '../api/campaigns.api';

/**
 * Seller picks listings to enter into a campaign, sets a deal price and the
 * stock to reserve. Entries submit as PENDING — the admin approves each one
 * before it shows to customers.
 */
export default function SubmitProductsModal({ open, campaign, onClose, onSubmit, loading }) {
  const [selected, setSelected] = useState({}); // listingId -> { checked, dealPricePaise, stockCommitted }

  const eligible = useQuery({
    queryKey: sellerCampaignKeys.eligible(campaign?.id),
    queryFn: () => sellerCampaignsApi.eligibleListings(campaign.id),
    enabled: open && Boolean(campaign),
  });
  const listings = useMemo(() => eligible.data?.data ?? [], [eligible.data]);

  useEffect(() => {
    if (open) setSelected({});
  }, [open]);

  const minDiscount = campaign?.minDiscountPct ?? 0;

  const discountFor = (listing, dealPricePaise) =>
    dealPricePaise ? Math.round(((listing.mrpPaise - dealPricePaise) / listing.mrpPaise) * 100) : 0;

  const toggle = (listing, checked) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (checked) {
        // Default the deal price to the campaign's minimum discount.
        const suggested = Math.round((listing.mrpPaise * (100 - minDiscount)) / 100 / 100) * 100;
        next[listing.id] = {
          checked: true,
          dealPricePaise: Math.min(suggested, listing.sellingPricePaise),
          stockCommitted: Math.min(50, listing.stock),
        };
      } else {
        delete next[listing.id];
      }
      return next;
    });
  };

  const patch = (listingId, field, value) =>
    setSelected((prev) => ({ ...prev, [listingId]: { ...prev[listingId], [field]: value } }));

  const chosen = useMemo(
    () => listings.filter((l) => selected[l.id]?.checked),
    [listings, selected],
  );

  const problems = chosen.filter((l) => {
    const entry = selected[l.id];
    return (
      !entry.dealPricePaise ||
      !entry.stockCommitted ||
      discountFor(l, entry.dealPricePaise) < minDiscount ||
      entry.stockCommitted > l.stock
    );
  });

  const submit = () => {
    onSubmit(
      chosen.map((l) => ({
        listingId: l.id,
        dealPricePaise: selected[l.id].dealPricePaise,
        stockCommitted: selected[l.id].stockCommitted,
      })),
    );
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={submit}
      title={`Add products to ${campaign?.name ?? 'campaign'}`}
      okText={chosen.length ? `Submit ${chosen.length} for approval` : 'Submit for approval'}
      okButtonProps={{ loading, disabled: chosen.length === 0 || problems.length > 0 }}
      cancelButtonProps={{ disabled: loading }}
      width={680}
      destroyOnHidden
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message={`This campaign needs at least ${minDiscount}% off the MRP.`}
        description="Entries are submitted for admin approval. Approved products appear in the campaign's section of the customer app."
      />

      {eligible.isLoading ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : listings.length === 0 ? (
        <Empty description="No eligible listings left to add — they're all already in this campaign." />
      ) : (
        <Flex vertical gap={8}>
          {listings.map((l) => {
            const entry = selected[l.id];
            const checked = Boolean(entry?.checked);
            const discount = checked ? discountFor(l, entry.dealPricePaise) : 0;
            const belowMin = checked && discount < minDiscount;
            const overStock = checked && entry.stockCommitted > l.stock;
            return (
              <div
                key={l.id}
                style={{
                  border: '1px solid var(--ant-color-border)',
                  borderRadius: 8,
                  padding: 12,
                  background: checked ? 'var(--ant-color-primary-bg)' : undefined,
                }}
              >
                <Checkbox checked={checked} onChange={(e) => toggle(l, e.target.checked)}>
                  <Space size={8} wrap>
                    <Typography.Text strong>{l.title}</Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {l.sku} · MRP {formatINR(l.mrpPaise)} · {l.stock} in stock
                    </Typography.Text>
                  </Space>
                </Checkbox>

                {checked && (
                  <Flex gap={16} wrap style={{ marginTop: 12, paddingLeft: 24 }}>
                    <Flex vertical gap={2}>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>Deal price</Typography.Text>
                      <InputNumber
                        min={1}
                        max={l.mrpPaise / 100}
                        value={entry.dealPricePaise / 100}
                        onChange={(v) => patch(l.id, 'dealPricePaise', Math.round((v ?? 0) * 100))}
                        prefix="₹"
                        status={belowMin ? 'error' : undefined}
                        style={{ width: 130 }}
                      />
                    </Flex>
                    <Flex vertical gap={2}>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>Stock to reserve</Typography.Text>
                      <InputNumber
                        min={1}
                        max={l.stock}
                        value={entry.stockCommitted}
                        onChange={(v) => patch(l.id, 'stockCommitted', v)}
                        status={overStock ? 'error' : undefined}
                        style={{ width: 130 }}
                      />
                    </Flex>
                    <Flex vertical gap={2} justify="center">
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>Discount</Typography.Text>
                      <Tag color={belowMin ? 'red' : 'green'} style={{ marginInlineEnd: 0, alignSelf: 'flex-start' }}>
                        {discount}% off{belowMin ? ` · min ${minDiscount}%` : ''}
                      </Tag>
                    </Flex>
                  </Flex>
                )}
              </div>
            );
          })}
        </Flex>
      )}

      {problems.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginTop: 12 }}
          message="Fix the highlighted entries"
          description="Each selected product needs a deal price meeting the minimum discount and a stock amount within what you have."
        />
      )}
    </Modal>
  );
}
