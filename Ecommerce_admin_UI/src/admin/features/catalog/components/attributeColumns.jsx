import { CheckCircleFilled, DeleteOutlined, EditOutlined, MinusOutlined } from '@ant-design/icons';
import { Button, Space, Tag, Tooltip, Typography } from 'antd';

/** Colour-code the type so the column scans at a glance without reading. */
const TYPE_COLORS = {
  TEXT: 'default',
  NUMBER: 'blue',
  SINGLE_SELECT: 'geekblue',
  MULTI_SELECT: 'purple',
  BOOLEAN: 'gold',
  COLOUR: 'magenta',
  SIZE: 'cyan',
  DATE: 'green',
};

/** A consistent yes/no cell: a success tick or a muted dash, always centred. */
function BoolCell({ on }) {
  return on ? (
    <CheckCircleFilled style={{ color: 'var(--ant-color-success)', fontSize: 16 }} />
  ) : (
    <MinusOutlined style={{ color: 'var(--ant-color-text-quaternary)' }} />
  );
}

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
      render: (t) => (
        <Tag color={TYPE_COLORS[t] ?? 'default'} style={{ marginInlineEnd: 0, textTransform: 'capitalize' }}>
          {t.replace(/_/g, ' ').toLowerCase()}
        </Tag>
      ),
    },
    {
      key: 'unit', title: 'Unit', dataIndex: 'unit', priority: 3,
      render: (v) => (v ? <span className="tabular">{v}</span> : <Typography.Text type="secondary">—</Typography.Text>),
    },
    {
      key: 'values', title: 'Values', dataIndex: 'values', priority: 2,
      render: (values) =>
        values.length ? (
          <Space size={[4, 4]} wrap>
            {values.slice(0, 3).map((v) => (
              <Tag key={v.value} style={{ marginInlineEnd: 0 }}>{v.value}</Tag>
            ))}
            {values.length > 3 && (
              <Tooltip title={values.slice(3).map((v) => v.value).join(', ')}>
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>+{values.length - 3} more</Typography.Text>
              </Tooltip>
            )}
          </Space>
        ) : (
          <Typography.Text type="secondary" style={{ fontSize: 12, fontStyle: 'italic' }}>Free text</Typography.Text>
        ),
    },
    {
      key: 'variantDefining', title: 'Variants', dataIndex: 'variantDefining', priority: 1, align: 'center',
      render: (v) => (
        <Tooltip title={v ? 'Creates SKUs' : 'Not variant-defining'}>
          <span><BoolCell on={v} /></span>
        </Tooltip>
      ),
    },
    {
      key: 'filterable', title: 'App filter', dataIndex: 'filterable', priority: 2, align: 'center',
      render: (v) => (
        <Tooltip title={v ? 'Shown as an app filter' : 'Not a filter'}>
          <span><BoolCell on={v} /></span>
        </Tooltip>
      ),
    },
    {
      key: 'usedInCategories', title: 'Categories', dataIndex: 'usedInCategories', sorter: true, align: 'right', priority: 2,
      render: (v) =>
        v > 0 ? (
          <span className="tabular">{v}</span>
        ) : (
          <Typography.Text type="secondary" className="tabular">0</Typography.Text>
        ),
    },
    {
      key: 'actions', title: '', align: 'right', priority: 1, width: 92,
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
}
