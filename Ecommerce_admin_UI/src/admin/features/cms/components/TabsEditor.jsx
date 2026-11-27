import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';
import { App, Button, Card, ColorPicker, Flex, Input, Skeleton, Slider, Switch, Typography } from 'antd';
import { useMutation, useQuery } from '@tanstack/react-query';
import ErrorState from '@ui/components/ErrorState';
import { cmsApi, cmsKeys } from '../api/cms.api';
import { ImageUpload } from './BannerFormModal';

/** The "For You" tab is not a category, so it has its own card: header colour, and an optional photo shown behind the header. */
function ForYouCard() {
  const { message } = App.useApp();
  const query = useQuery({ queryKey: ['cms', 'forYouTab'], queryFn: cmsApi.forYouTab });
  const save = useMutation({
    mutationFn: cmsApi.updateForYouTab,
    onSuccess: () => { query.refetch(); message.success('Saved. The app picks it up within seconds.'); },
    onError: (e) => message.error(Object.values(e.fieldErrors ?? {}).flat()[0] ?? e.message),
  });
  if (query.isLoading) return <Skeleton active paragraph={{ rows: 2 }} />;
  if (query.error) return <ErrorState error={query.error} onRetry={query.refetch} />;
  const { forYouColor, forYouImage, forYouImageOpacity, recentlyViewedTopColor, recentlyViewedBottomColor } = query.data.data;
  const current = { forYouColor, forYouImage, forYouImageOpacity, recentlyViewedTopColor, recentlyViewedBottomColor };
  const hex = (c) => c.toHexString().slice(0, 7).toUpperCase();
  return (
    <Card size="small" title="For You tab" style={{ maxWidth: 520 }}>
      <Flex vertical gap={12}>
        <Flex gap={8} align="center">
          <Typography.Text style={{ fontSize: 12, width: 110 }}>Header colour</Typography.Text>
          <ColorPicker showText value={forYouColor} onChangeComplete={(c) => save.mutate({ ...current, forYouColor: c.toHexString().slice(0, 7).toUpperCase() })} />
        </Flex>
        <Flex gap={8} align="center">
          <Typography.Text style={{ fontSize: 12, width: 110 }}>Recently viewed rail</Typography.Text>
          <ColorPicker showText value={recentlyViewedTopColor} onChangeComplete={(c) => save.mutate({ ...current, recentlyViewedTopColor: hex(c) })} />
          <ColorPicker showText value={recentlyViewedBottomColor} onChangeComplete={(c) => save.mutate({ ...current, recentlyViewedBottomColor: hex(c) })} />
          {/* top and bottom colours of the "Still looking for these?" strip on Home */}
          <div aria-label="Preview" style={{ width: 40, height: 40, borderRadius: 6, background: `linear-gradient(${recentlyViewedTopColor}, ${recentlyViewedBottomColor})`, flexShrink: 0 }} />
        </Flex>
        <Flex gap={8} align="flex-start">
          <Typography.Text style={{ fontSize: 12, width: 110 }}>Background image</Typography.Text>
          <ImageUpload kind="FREE" removable value={forYouImage || null} onChange={(url) => save.mutate({ ...current, forYouImage: url ?? '' })} />
        </Flex>
        {forYouImage ? (
          <Flex gap={8} align="center">
            <Typography.Text style={{ fontSize: 12, width: 110 }}>Image opacity</Typography.Text>
            <Slider style={{ flex: 1 }} min={0} max={100} defaultValue={forYouImageOpacity} tooltip={{ formatter: (v) => `${v}%` }} onChangeComplete={(v) => save.mutate({ ...current, forYouImageOpacity: v })} />
            {/* live preview of the blend: the colour with the picture on top at the chosen strength */}
            <div aria-label="Preview" style={{ width: 64, height: 40, borderRadius: 6, background: `linear-gradient(${forYouColor}, #FFFFFF)`, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
              <img src={forYouImage} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: forYouImageOpacity / 100 }} />
            </div>
          </Flex>
        ) : null}
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>Lower the opacity to let the colour show through. Use a light, uncluttered picture so the search bar and tabs stay readable. Remove it to go back to the colour.</Typography.Text>
      </Flex>
    </Card>
  );
}

/**
 * Category tabs (app `CATEGORY_TABS`) and top brand tabs (`BRAND_TABS`).
 * Gradient colours use a live picker so a change can be checked before
 * saving, matching the plan's call for "color pickers with live preview."
 */
export default function TabsEditor({ kind }) {
  const { message } = App.useApp();
  const isCategory = kind === 'category';
  const queryKey = isCategory ? cmsKeys.categoryTabs : cmsKeys.brandTabs;
  const fetchFn = isCategory ? cmsApi.categoryTabs : cmsApi.brandTabs;
  const updateFn = isCategory ? cmsApi.updateCategoryTab : cmsApi.updateBrandTab;

  const query = useQuery({ queryKey, queryFn: fetchFn });

  const update = useMutation({
    mutationFn: ({ id, payload }) => updateFn(id, payload),
    onSuccess: () => query.refetch(),
    onError: (e) => message.error(Object.values(e.fieldErrors ?? {}).flat()[0] ?? e.message),
  });
  const reorder = useMutation({
    mutationFn: (orderedIds) => cmsApi.reorderCategoryTabs(orderedIds),
    onSuccess: () => query.refetch(),
    onError: (e) => message.error(Object.values(e.fieldErrors ?? {}).flat()[0] ?? e.message),
  });

  if (query.isLoading) return <Skeleton active paragraph={{ rows: 4 }} />;
  if (query.error) return <ErrorState error={query.error} onRetry={query.refetch} />;

  const tabs = query.data.data;

  const move = (index, dir) => {
    const next = [...tabs];
    const [row] = next.splice(index, 1);
    next.splice(index + dir, 0, row);
    if (isCategory) reorder.mutate(next.map((t) => t.id));
  };

  return (
    <Flex vertical gap={12}>
    {isCategory && <ForYouCard />}
    <Flex gap={10} wrap>
      {tabs.map((tab, index) => (
        <Card key={tab.id} size="small" style={{ width: 240 }}>
          <Flex vertical gap={8}>
            <Input
              size="small"
              defaultValue={tab.label}
              onBlur={(e) => e.target.value !== tab.label && update.mutate({ id: tab.id, payload: { label: e.target.value } })}
            />
            {isCategory && (
              <Flex gap={6} align="center">
                <Typography.Text style={{ fontSize: 12 }}>Gradient</Typography.Text>
                {[0, 1].map((i) => (
                  <ColorPicker
                    key={i}
                    size="small"
                    value={tab.gradient[i]}
                    onChangeComplete={(c) => {
                      const gradient = [...tab.gradient];
                      gradient[i] = c.toHexString();
                      update.mutate({ id: tab.id, payload: { gradient } });
                    }}
                  />
                ))}
                <Flex gap={4} style={{ width: 48, height: 20, borderRadius: 4, background: `linear-gradient(90deg, ${tab.gradient[0]}, ${tab.gradient[1]})` }} />
              </Flex>
            )}
            <Flex justify="space-between" align="center">
              <Switch
                size="small"
                checked={tab.active}
                onChange={(active) => update.mutate({ id: tab.id, payload: { active } })}
              />
              {isCategory && (
                <Flex gap={2}>
                  <Button size="small" type="text" icon={<ArrowUpOutlined />} disabled={index === 0} onClick={() => move(index, -1)} aria-label="Move up" />
                  <Button size="small" type="text" icon={<ArrowDownOutlined />} disabled={index === tabs.length - 1} onClick={() => move(index, 1)} aria-label="Move down" />
                </Flex>
              )}
            </Flex>
          </Flex>
        </Card>
      ))}
    </Flex>
    </Flex>
  );
}
