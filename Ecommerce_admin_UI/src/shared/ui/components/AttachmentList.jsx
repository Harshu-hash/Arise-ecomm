import { DeleteOutlined, DownloadOutlined, EyeOutlined, FileOutlined } from '@ant-design/icons';
import { Button, Empty, List, Space, Tag, Typography } from 'antd';

export default function AttachmentList({ attachments = [], onPreview, onRemove, removable = false, emptyText = 'No attachments' }) {
  if (!attachments.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />;
  return (
    <List
      size="small"
      dataSource={attachments}
      renderItem={(item) => (
        <List.Item actions={[
          onPreview ? <Button key="preview" type="text" icon={<EyeOutlined />} onClick={() => onPreview(item)} aria-label={`Preview ${item.fileName}`} /> : null,
          item.downloadUrl ? <Button key="download" type="link" icon={<DownloadOutlined />} href={item.downloadUrl} target="_blank" rel="noopener noreferrer">Download</Button> : null,
          removable && onRemove ? <Button key="remove" type="text" danger icon={<DeleteOutlined />} onClick={() => onRemove(item)} aria-label={`Remove ${item.fileName}`} /> : null,
        ].filter(Boolean)}>
          <List.Item.Meta avatar={<FileOutlined />} title={item.fileName ?? item.label} description={<Space wrap><Typography.Text type="secondary">{item.mimeType}</Typography.Text>{item.status && <Tag>{item.status}</Tag>}</Space>} />
        </List.Item>
      )}
    />
  );
}
