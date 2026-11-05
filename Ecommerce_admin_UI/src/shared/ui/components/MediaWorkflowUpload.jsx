import {
  ArrowLeftOutlined, ArrowRightOutlined, CloseOutlined, DeleteOutlined, ScissorOutlined,
  PictureOutlined, ReloadOutlined, StarFilled, StarOutlined, UploadOutlined,
} from '@ant-design/icons';
import { Alert, App, Button, Modal, Progress, Select, Space, Tooltip, Typography, Upload } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { mediaApi } from '@core/api/foundationApi';
import { readImageDimensions } from './mediaValidation';

const DEFAULT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function normalize(item, index) {
  if (typeof item === 'string') return { id: `legacy-${index}`, mediaId: null, previewUrl: item, fileName: `Image ${index + 1}`, status: 'READY' };
  return { ...item, mediaId: item.mediaId ?? item.id };
}

export default function MediaWorkflowUpload({
  value = [], onChange, kind = 'PRODUCT_IMAGE', accept = DEFAULT_TYPES, maxCount = 8,
  maxSizeBytes = 10 * 1024 * 1024, minWidth = 0, minHeight = 0,
  maxWidth = Infinity, maxHeight = Infinity, label = 'Image', imageOnly = true,
  dimensionReader = readImageDimensions,
}) {
  const { message } = App.useApp();
  const [uploads, setUploads] = useState([]);
  const [cropTarget, setCropTarget] = useState(null);
  const [cropAspect, setCropAspect] = useState('original');
  const controllers = useRef(new Map());
  const items = value.map(normalize);

  useEffect(() => () => controllers.current.forEach((controller) => controller.abort()), []);

  const validate = async (file) => {
    if (!accept.includes(file.type)) throw new Error(`Use one of: ${accept.join(', ')}.`);
    if (file.size > maxSizeBytes) throw new Error(`File must be smaller than ${Math.round(maxSizeBytes / 1024 / 1024)} MB.`);
    const dimensions = await dimensionReader(file);
    if (dimensions.width && (dimensions.width < minWidth || dimensions.width > maxWidth)) throw new Error(`Image width must be between ${minWidth} and ${maxWidth} px.`);
    if (dimensions.height && (dimensions.height < minHeight || dimensions.height > maxHeight)) throw new Error(`Image height must be between ${minHeight} and ${maxHeight} px.`);
    return dimensions;
  };
  const patchUpload = (localId, patch) => setUploads((current) => current.map((u) => (u.localId === localId ? { ...u, ...patch } : u)));

  const runUpload = async (file, retryId) => {
    const localId = retryId ?? `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const localPreviewUrl = imageOnly ? URL.createObjectURL(file) : null;
    if (!retryId) setUploads((current) => [...current, { localId, file, fileName: file.name, status: 'VALIDATING', progress: 0, localPreviewUrl }]);
    else patchUpload(localId, { status: 'VALIDATING', progress: 0, error: null });
    let uploadId;
    try {
      const dimensions = await validate(file);
      patchUpload(localId, { status: 'UPLOADING', progress: 5 });
      const presigned = await mediaApi.presign({ fileName: file.name, mimeType: file.type, sizeBytes: file.size, kind, ...dimensions });
      uploadId = presigned.uploadId;
      patchUpload(localId, { uploadId, mediaId: presigned.mediaId, progress: 15 });
      const controller = new AbortController();
      controllers.current.set(localId, controller);
      await mediaApi.upload(presigned.uploadUrl, file, { signal: controller.signal, onUploadProgress: (event) => patchUpload(localId, { progress: 15 + Math.round((event.progress ?? 0.8) * 65) }) });
      patchUpload(localId, { status: 'PROCESSING', progress: 85 });
      let media = await mediaApi.complete(uploadId, dimensions);
      for (let attempt = 0; media.status === 'PROCESSING' && attempt < 8; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        media = await mediaApi.get(media.id);
      }
      if (media.status !== 'READY') throw new Error(media.processingError ?? 'Processing did not finish.');
      onChange?.([...items, media]);
      setUploads((current) => current.filter((u) => u.localId !== localId));
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    } catch (error) {
      if (error?.code === 'ERR_CANCELED') return false;
      patchUpload(localId, { status: 'FAILED', error: error?.message ?? 'Upload failed.', uploadId });
    } finally { controllers.current.delete(localId); }
    return false;
  };

  const cancel = async (upload) => {
    controllers.current.get(upload.localId)?.abort();
    if (upload.uploadId) await mediaApi.abort(upload.uploadId).catch(() => undefined);
    if (upload.localPreviewUrl) URL.revokeObjectURL(upload.localPreviewUrl);
    setUploads((current) => current.filter((u) => u.localId !== upload.localId));
  };
  const removeItem = async (index) => {
    const item = items[index];
    if (item.mediaId) await mediaApi.remove(item.mediaId).catch(() => undefined);
    onChange?.(items.filter((_, i) => i !== index));
  };
  const move = (index, offset) => {
    const target = index + offset;
    if (target < 0 || target >= items.length) return;
    const next = [...items]; [next[index], next[target]] = [next[target], next[index]]; onChange?.(next);
  };
  const cover = (index) => { const next = [...items]; const [picked] = next.splice(index, 1); next.unshift(picked); onChange?.(next); };
  const saveCrop = async () => {
    const updated = await mediaApi.update(cropTarget.mediaId, { crop: { aspect: cropAspect } });
    onChange?.(items.map((item) => item.mediaId === updated.id ? updated : item));
    setCropTarget(null); message.success('Crop preference saved.');
  };

  return (
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      <Space size={[8, 8]} wrap role="list" aria-label={`${label} uploads`}>
        {items.map((item, index) => (
          <div key={item.mediaId ?? item.id} role="listitem" style={{ width: imageOnly ? 112 : 240, border: '1px solid var(--ant-color-border)', borderRadius: 8, overflow: 'hidden' }}>
            {imageOnly ? <img src={item.previewUrl} alt={`${label} ${index + 1}${index === 0 ? ', cover' : ''}`} style={{ width: '100%', height: 104, objectFit: 'cover', display: 'block' }} /> : <Typography.Text ellipsis style={{ display: 'block', padding: 10 }}>{item.fileName}</Typography.Text>}
            <Space size={0} style={{ padding: 3 }}>
              {imageOnly && <Tooltip title={index === 0 ? 'Cover image' : 'Make cover'}><Button type="text" size="small" aria-label={index === 0 ? 'Cover image' : `Make ${item.fileName} cover`} icon={index === 0 ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />} onClick={() => cover(index)} /></Tooltip>}
              <Button type="text" size="small" aria-label={`Move ${item.fileName} left`} icon={<ArrowLeftOutlined />} disabled={index === 0} onClick={() => move(index, -1)} />
              <Button type="text" size="small" aria-label={`Move ${item.fileName} right`} icon={<ArrowRightOutlined />} disabled={index === items.length - 1} onClick={() => move(index, 1)} />
              {imageOnly && item.mediaId && <Button type="text" size="small" aria-label={`Crop ${item.fileName}`} icon={<ScissorOutlined />} onClick={() => { setCropTarget(item); setCropAspect(item.crop?.aspect ?? 'original'); }} />}
              <Button type="text" size="small" danger aria-label={`Remove ${item.fileName}`} icon={<DeleteOutlined />} onClick={() => removeItem(index)} />
            </Space>
          </div>
        ))}
        {uploads.map((upload) => (
          <div key={upload.localId} style={{ width: 240, padding: 10, border: '1px solid var(--ant-color-border)', borderRadius: 8 }} role="status" aria-live="polite">
            <Typography.Text ellipsis style={{ display: 'block' }}>{upload.fileName}</Typography.Text>
            <Progress percent={upload.progress} size="small" status={upload.status === 'FAILED' ? 'exception' : 'active'} />
            {upload.error && <Alert type="error" showIcon message={upload.error} style={{ marginBlock: 6 }} />}
            <Space>{upload.status === 'FAILED' && <Button size="small" icon={<ReloadOutlined />} onClick={() => runUpload(upload.file, upload.localId)}>Retry</Button>}<Button size="small" icon={<CloseOutlined />} onClick={() => cancel(upload)}>Cancel</Button></Space>
          </div>
        ))}
        {items.length + uploads.length < maxCount && <Upload accept={accept.join(',')} showUploadList={false} multiple beforeUpload={(file) => { void runUpload(file); return false; }}><Button aria-label={`Add ${imageOnly ? 'image' : 'file'}`} icon={imageOnly ? <PictureOutlined /> : <UploadOutlined />}>Add {imageOnly ? 'image' : 'file'}</Button></Upload>}
      </Space>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>{items.length}/{maxCount} uploaded. Files are validated and stored before the form references them.</Typography.Text>
      <Modal title="Crop image" open={Boolean(cropTarget)} onCancel={() => setCropTarget(null)} onOk={saveCrop} okText="Save crop" destroyOnHidden>
        <Space direction="vertical" style={{ width: '100%' }}>{cropTarget && <img src={cropTarget.previewUrl} alt="Crop preview" style={{ maxWidth: '100%', maxHeight: 320, objectFit: 'contain' }} />}<Select value={cropAspect} onChange={setCropAspect} options={['original', 'square', '4:3', '16:9'].map((v) => ({ value: v, label: v === 'original' ? 'Original' : v }))} style={{ width: '100%' }} aria-label="Crop aspect ratio" /></Space>
      </Modal>
    </Space>
  );
}
