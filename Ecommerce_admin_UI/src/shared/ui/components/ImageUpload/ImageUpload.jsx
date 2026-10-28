import { ArrowLeftOutlined, ArrowRightOutlined, PictureOutlined, StarFilled, StarOutlined } from '@ant-design/icons';
import { Button, Space, Tooltip, Typography, Upload } from 'antd';

/**
 * Local-preview image picker: no backend storage exists yet, so selected
 * files are kept as object URLs. The first image in `value` is the cover —
 * the one shown first everywhere the product is listed.
 */
export default function ImageUpload({ value = [], onChange, maxCount = 8, label }) {
  const beforeUpload = (file) => {
    const url = URL.createObjectURL(file);
    onChange?.([...value, url]);
    return false;
  };

  const remove = (index) => onChange?.(value.filter((_, i) => i !== index));
  const move = (index, dir) => {
    const next = [...value];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange?.(next);
  };
  const makeCover = (index) => {
    if (index === 0) return;
    const next = [...value];
    const [picked] = next.splice(index, 1);
    next.unshift(picked);
    onChange?.(next);
  };

  return (
    <Space direction="vertical" size={6} style={{ width: '100%' }}>
      <Space size={[8, 8]} wrap>
        {value.map((url, index) => (
          <div key={url} style={{ position: 'relative', width: 104, border: '1px solid var(--ant-color-border)', borderRadius: 8, overflow: 'hidden' }}>
            <img src={url} alt={`${label ?? 'Image'} ${index + 1}`} style={{ width: 104, height: 104, objectFit: 'cover', display: 'block' }} />
            <div style={{ position: 'absolute', top: 2, left: 2 }}>
              <Tooltip title={index === 0 ? 'Cover image' : 'Make cover image'}>
                <Button
                  size="small"
                  type="text"
                  icon={index === 0 ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
                  onClick={() => makeCover(index)}
                />
              </Tooltip>
            </div>
            <Space size={0} style={{ position: 'absolute', bottom: 2, right: 2, background: 'rgba(0,0,0,0.45)', borderRadius: 6 }}>
              <Button size="small" type="text" style={{ color: '#fff' }} icon={<ArrowLeftOutlined />} disabled={index === 0} onClick={() => move(index, -1)} />
              <Button size="small" type="text" style={{ color: '#fff' }} danger onClick={() => remove(index)}>×</Button>
              <Button size="small" type="text" style={{ color: '#fff' }} icon={<ArrowRightOutlined />} disabled={index === value.length - 1} onClick={() => move(index, 1)} />
            </Space>
          </div>
        ))}
        {value.length < maxCount && (
          <Upload accept="image/*" showUploadList={false} beforeUpload={beforeUpload} multiple>
            <div style={{ width: 104, height: 104, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', border: '1px dashed var(--ant-color-border)', borderRadius: 8, cursor: 'pointer' }}>
              <PictureOutlined style={{ fontSize: 20 }} />
              <Typography.Text style={{ fontSize: 11 }}>Add photo</Typography.Text>
            </div>
          </Upload>
        )}
      </Space>
      <Typography.Text type="secondary" style={{ fontSize: 11 }}>
        The starred image is the cover. {value.length}/{maxCount} added.
      </Typography.Text>
    </Space>
  );
}
