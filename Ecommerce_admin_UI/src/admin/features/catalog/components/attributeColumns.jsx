import { Button, Space, Tag, Typography } from 'antd';
import { Can } from '@core/rbac/Can';

/** Column set for the main Attributes DataTable, incl. the row-level edit/delete actions. */
export function makeAttributeColumns({ onEdit, onDelete }) {
  return [
    {
      key: 'name', title: 'Attribute', dataIndex: 'name', sorter: true, alwaysVisible: true,
      render: (name, row) => (
        <div>
          <Typography.Text strong style={{ fontSize: 13 }}>{name}</Typography.Text>
          <div>
            <Typography.Text className="mono" type="secondary" style={{ fontSize: 11 }}>{row.code}</Typography.Text>
          </div>
        </div>
      ),
    },
    {
      key: 'type', title: 'Type', dataIndex: 'type', sorter: true, priority: 1,
      render: (t) => <Tag style={{ marginInlineEnd: 0 }}>{t.replace(/_/g, ' ').toLowerCase()}</Tag>,
    },
    { key: 'unit', title: 'Unit', dataIndex: 'unit', priority: 3, render: (v) => v ?? '—' },
    {
      key: 'values', title: 'Values', dataIndex: 'values', priority: 2,
      render: (values) =>
        values.length ? (
          <Space size={[4, 4]} wrap>
            {values.slice(0, 4).map((v) => (
              <Tag key={v.value} style={{ marginInlineEnd: 0 }}>{v.value}</Tag>
            ))}
            {values.length > 4 && (
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>+{values.length - 4}</Typography.Text>
            )}
          </Space>
        ) : (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>Free text</Typography.Text>
        ),
    },
    {
      key: 'variantDefining', title: 'Defines variants', dataIndex: 'variantDefining', priority: 1,
      render: (v) => (v ? <Tag color="blue" style={{ marginInlineEnd: 0 }}>Yes</Tag> : <Typography.Text type="secondary" style={{ fontSize: 12 }}>No</Typography.Text>),
    },
    {
      key: 'filterable', title: 'Filterable in app', dataIndex: 'filterable', priority: 2,
      render: (v) => (v ? <Tag color="green" style={{ marginInlineEnd: 0 }}>Yes</Tag> : <Typography.Text type="secondary" style={{ fontSize: 12 }}>No</Typography.Text>),
    },
    {
      key: 'usedInCategories', title: 'Categories', dataIndex: 'usedInCategories', sorter: true, align: 'right', priority: 2,
      render: (v) => <span className="tabular">{v}</span>,
    },
    {
      key: 'actions', title: '', align: 'right', priority: 1,
      render: (_v, row) => (
        <Space size={4}>
          <Can perm="catalog.attribute.edit">
            <Button size="small" type="text" onClick={() => onEdit(row)}>Edit</Button>
          </Can>
          <Can perm="catalog.attribute.delete">
            <Button size="small" type="text" danger onClick={() => onDelete(row)}>Delete</Button>
          </Can>
        </Space>
      ),
    },
  ];
}
