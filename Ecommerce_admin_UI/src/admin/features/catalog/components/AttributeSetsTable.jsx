import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Card, Space, Table, Tag, Tooltip, Typography } from 'antd';

/** The "Attribute sets" block on the Attributes page: a small read/write list beneath the main table. */
export default function AttributeSetsTable({ sets, loading, onNew, onEdit, onDelete }) {
  const columns = [
    {
      title: 'Set',
      dataIndex: 'name',
      render: (v) => <Typography.Text strong style={{ fontSize: 13 }}>{v}</Typography.Text>,
    },
    {
      title: 'Applies to',
      dataIndex: 'rootName',
      render: (v) => (v ? <Tag style={{ marginInlineEnd: 0 }}>{v}</Tag> : <Typography.Text type="secondary">Any category</Typography.Text>),
    },
    {
      title: 'Attributes',
      dataIndex: 'attributeIds',
      align: 'right',
      render: (ids) => (
        <span className="tabular">
          {ids.length} <Typography.Text type="secondary" style={{ fontSize: 12 }}>attribute{ids.length === 1 ? '' : 's'}</Typography.Text>
        </span>
      ),
    },
    {
      title: '', dataIndex: 'id', align: 'right', width: 92,
      render: (_v, row) => (
        <Space size={2}>
          <Tooltip title="Edit">
            <Button size="small" type="text" icon={<EditOutlined />} onClick={() => onEdit(row)} aria-label={`Edit ${row.name}`} />
          </Tooltip>
          <Tooltip title="Delete">
            <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => onDelete(row)} aria-label={`Delete ${row.name}`} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <Card
      size="small"
      title="Attribute sets"
      extra={
        <Button size="small" type="primary" ghost icon={<PlusOutlined />} onClick={onNew}>
          New set
        </Button>
      }
      styles={{ body: { paddingTop: 0 } }}
    >
      <Typography.Paragraph type="secondary" style={{ fontSize: 12, margin: '10px 0 12px' }}>
        Sets group attributes so a category can adopt them all at once.
      </Typography.Paragraph>
      <Table size="small" rowKey="id" pagination={false} loading={loading} dataSource={sets} columns={columns} />
    </Card>
  );
}
