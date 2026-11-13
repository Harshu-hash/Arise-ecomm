import { Button, Flex, Space, Table, Typography } from 'antd';

/** The "Attribute sets" block on the Attributes page: a small read/write list beneath the main table. */
export default function AttributeSetsTable({ sets, loading, onNew, onEdit, onDelete }) {
  const columns = [
    { title: 'Set', dataIndex: 'name' },
    { title: 'Applies to', dataIndex: 'rootName', render: (v) => v ?? 'Any category' },
    {
      title: 'Attributes', dataIndex: 'attributeIds',
      render: (ids) => `${ids.length} attribute${ids.length === 1 ? '' : 's'}`,
    },
    {
      title: '', dataIndex: 'id', align: 'right',
      render: (_v, row) => (
        <Space size={4}>
          <>
            <Button size="small" type="text" onClick={() => onEdit(row)}>Edit</Button>
          </>
          <>
            <Button size="small" type="text" danger onClick={() => onDelete(row)}>Delete</Button>
          </>
        </Space>
      ),
    },
  ];

  return (
    <Flex vertical gap={8}>
      <Flex justify="space-between" align="center">
        <div>
          <Typography.Title level={5} style={{ margin: 0, fontSize: 14 }}>
            Attribute sets
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Sets group attributes so a category can adopt them all at once.
          </Typography.Text>
        </div>
        <>
          <Button size="small" onClick={onNew}>New set</Button>
        </>
      </Flex>
      <Table size="small" rowKey="id" pagination={false} loading={loading} dataSource={sets} columns={columns} />
    </Flex>
  );
}
