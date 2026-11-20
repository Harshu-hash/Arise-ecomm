import { UploadOutlined } from '@ant-design/icons';
import { App, Button, DatePicker, Flex, Form, Image, Input, Modal, Select, Upload } from 'antd';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { dayjs } from '@core/utils/date';
import { catalogApi, catalogKeys } from '@admin/features/catalog/api/catalog.api';
import { cmsApi } from '../api/cms.api';

// Server field paths that differ from this form's field names.
const SERVER_FIELD = { 'images.mobile_16_9': 'imageUrl', 'images.tile_1_1': 'imageUrl', 'images.web': 'imageUrl', startsAt: 'window', endsAt: 'window' };

const PLACEMENTS = [
  { value: 'HOME_HERO', label: 'Home hero (For You page)' },
  { value: 'CATEGORY_HERO', label: 'Category page hero' },
  { value: 'HOME_AD_TILES', label: 'Home ad tiles' },
  { value: 'OFFERS_PAGE', label: 'Offers page' },
];

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_IMAGE_MB = 10; // matches the server's MAX_UPLOAD_BYTES default
// Hero banners are 16:9 and tiles are 1:1; a small tolerance forgives rounding in exports.
// FREE = any shape (e.g. a background that is cropped to fit).
const KIND_RATIO = { HERO: { ratio: 16 / 9, label: '16:9' }, TILE: { ratio: 1, label: '1:1' }, FREE: null };
const RATIO_TOLERANCE = 0.05;

function imageSize(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve({ width: img.naturalWidth, height: img.naturalHeight }); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file is not a readable image.')); };
    img.src = url;
  });
}

/** Checks type, size and shape, uploads the file, and stores the returned public URL as the field value. */
export function ImageUpload({ value, onChange, kind, removable = false }) {
  const { message } = App.useApp();
  const [uploading, setUploading] = useState(false);

  const upload = async (file) => {
    setUploading(true);
    try {
      if (!IMAGE_TYPES.includes(file.type)) throw new Error('Use a PNG, JPG or WebP image.');
      if (file.size > MAX_IMAGE_MB * 1024 * 1024) throw new Error(`The image must be under ${MAX_IMAGE_MB} MB.`);
      const { width, height } = await imageSize(file);
      const { ratio, label } = (kind in KIND_RATIO ? KIND_RATIO[kind] : KIND_RATIO.HERO) ?? {};
      if (ratio && Math.abs(width / height - ratio) / ratio > RATIO_TOLERANCE) {
        throw new Error(`This ${kind === 'TILE' ? 'tile' : 'hero'} banner needs a ${label} image; this one is ${width}×${height}.`);
      }
      onChange(await cmsApi.uploadImage(file));
    } catch (e) {
      message.error(e.message);
    } finally {
      setUploading(false);
    }
    return false; // we upload ourselves; stop antd from posting the file
  };

  return (
    <Flex vertical gap={8} align="flex-start">
      {value && <Image src={value} height={96} style={{ objectFit: 'contain' }} />}
      <Upload accept="image/png,image/jpeg,image/webp" showUploadList={false} beforeUpload={upload} disabled={uploading}>
        <Button icon={<UploadOutlined />} loading={uploading}>{value ? 'Replace image' : 'Upload image'}</Button>
      </Upload>
      {removable && value && <Button size="small" type="link" danger onClick={() => onChange(null)} style={{ padding: 0 }}>Remove image</Button>}
    </Flex>
  );
}

export default function BannerFormModal({ banner, open, onClose, onSaved }) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const kind = Form.useWatch('kind', form);
  const placements = Form.useWatch('placements', form);
  const showsOnCategoryPages = placements?.includes('CATEGORY_HERO');
  // Customer category pages are the top-level categories, so only those are offered.
  const categoryTree = useQuery({
    queryKey: catalogKeys.categoryTree,
    queryFn: () => catalogApi.categoryTree(),
    enabled: open && Boolean(showsOnCategoryPages),
  });
  const categoryOptions = (categoryTree.data?.data ?? []).map((c) => ({ value: c.id, label: c.name }));

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (banner) {
      form.setFieldsValue({
        name: banner.name,
        kind: banner.kind,
        imageUrl: banner.images?.mobile_16_9 ?? '',
        altText: banner.altText,
        placements: banner.placements,
        categoryIds: banner.categoryIds ?? [],
        window: [dayjs(banner.startsAt), dayjs(banner.endsAt)],
      });
    } else {
      form.setFieldsValue({ kind: 'HERO', placements: ['HOME_HERO'], window: [dayjs(), dayjs().add(14, 'day')] });
    }
  }, [open, banner, form]);

  // Shows the server's per-field errors under the matching inputs; falls back to a toast.
  const showError = (e) => {
    if (!e.fieldErrors) return message.error(e.message);
    return form.setFields(
      Object.entries(e.fieldErrors).map(([name, errors]) => ({ name: SERVER_FIELD[name] ?? name, errors: [].concat(errors) })),
    );
  };

  const create = useMutation({
    mutationFn: (payload) => cmsApi.createBanner(payload),
    onSuccess: () => { message.success('Banner created'); onSaved(); },
    onError: showError,
  });
  const update = useMutation({
    mutationFn: (payload) => cmsApi.updateBanner(banner.id, payload),
    onSuccess: () => { message.success('Saved'); onSaved(); },
    onError: showError,
  });

  const submit = async () => {
    const v = await form.validateFields();
    const payload = {
      name: v.name,
      kind: v.kind,
      images: { mobile_16_9: v.imageUrl, tile_1_1: v.imageUrl, web: v.imageUrl },
      altText: v.altText,
      placements: v.placements,
      categoryIds: v.placements.includes('CATEGORY_HERO') ? v.categoryIds ?? [] : [],
      startsAt: v.window[0].startOf('day').toISOString(),
      endsAt: v.window[1].endOf('day').toISOString(),
    };
    if (banner) update.mutate(payload);
    else create.mutate(payload);
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={submit}
      title={banner ? `Edit ${banner.name}` : 'New banner'}
      okText="Save"
      okButtonProps={{ loading: create.isPending || update.isPending }}
      destroyOnHidden
    >
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="Name" rules={[{ required: true, whitespace: true, message: 'Give the banner a name.' }, { max: 100, message: 'Keep it under 100 characters.' }]}>
          <Input placeholder="Monsoon sale hero" maxLength={100} />
        </Form.Item>
        <Form.Item name="kind" label="Kind">
          <Select options={[{ value: 'HERO', label: 'Hero (16:9)' }, { value: 'TILE', label: 'Tile (1:1)' }]} />
        </Form.Item>
        <Form.Item name="imageUrl" label="Image" rules={[{ required: true, message: 'Upload an image.' }]}>
          <ImageUpload kind={kind} />
        </Form.Item>
        <Form.Item name="altText" label="Alt text" rules={[{ required: true, whitespace: true, message: 'Required for accessibility.' }, { max: 200, message: 'Keep it under 200 characters.' }]}>
          <Input maxLength={200} />
        </Form.Item>
        <Form.Item name="placements" label="Placements" rules={[{ required: true, type: 'array', min: 1, message: 'Choose at least one placement.' }]}>
          <Select mode="multiple" options={PLACEMENTS} />
        </Form.Item>
        {showsOnCategoryPages && (
          <Form.Item
            name="categoryIds"
            label="Category pages"
            extra="The banner shows on these categories' pages in the customer app."
            rules={[{ required: true, type: 'array', min: 1, message: 'Choose at least one category.' }]}
          >
            <Select mode="multiple" placeholder="Choose categories" loading={categoryTree.isLoading} options={categoryOptions} optionFilterProp="label" />
          </Form.Item>
        )}
        <Form.Item
          name="window"
          label="Schedule"
          rules={[
            { required: true, message: 'Pick the start and end dates.' },
            // A new banner that has already ended would never show.
            // New banners (and a changed start) cannot begin before today; a running banner keeps its start.
            {
              validator: (_r, v) => {
                const startChanged = !banner || !v?.[0]?.isSame(banner.startsAt, 'day');
                if (startChanged && v?.[0]?.isBefore(dayjs(), 'day')) return Promise.reject(new Error('The start date is in the past.'));
                return Promise.resolve();
              },
            },
            { validator: (_r, v) => (!banner && v?.[1]?.endOf('day').isBefore(dayjs()) ? Promise.reject(new Error('The end date is in the past.')) : Promise.resolve()) },
          ]}
        >
          <DatePicker.RangePicker style={{ width: '100%' }} disabledDate={(d) => !banner && d.isBefore(dayjs(), 'day')} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
