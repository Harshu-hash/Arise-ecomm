import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, Divider, Flex, Input, Modal, Select, Space, Typography } from 'antd';
import { useEffect, useState } from 'react';

const COL_WIDTH = 132;

const blankChart = () => ({
  name: '',
  unit: 'in',
  categoryId: null,
  columns: ['Size', 'Measurement'],
  rows: [['', '']],
});

/**
 * Build or edit a size chart: name, unit, optional category, then a grid of
 * columns and rows. Columns and rows stay the same width, so a row can never
 * end up with the wrong number of cells.
 */
export default function SizeChartEditorModal({ open, editing, categories = [], onCancel, onSubmit, loading }) {
  const { message } = App.useApp();
  const [chart, setChart] = useState(blankChart());

  useEffect(() => {
    if (!open) return;
    setChart(
      editing
        ? {
            name: editing.name ?? '',
            unit: editing.unit ?? 'in',
            categoryId: editing.categoryId ?? null,
            columns: [...(editing.columns ?? ['Size', 'Measurement'])],
            rows: (editing.rows ?? []).map((r) => [...r]),
          }
        : blankChart(),
    );
  }, [open, editing]);

  const setCol = (ci, val) =>
    setChart((c) => ({ ...c, columns: c.columns.map((x, i) => (i === ci ? val : x)) }));

  const setCell = (ri, ci, val) =>
    setChart((c) => ({
      ...c,
      rows: c.rows.map((r, i) => (i === ri ? r.map((x, j) => (j === ci ? val : x)) : r)),
    }));

  const addColumn = () =>
    setChart((c) => ({ ...c, columns: [...c.columns, ''], rows: c.rows.map((r) => [...r, '']) }));

  const removeColumn = (ci) =>
    setChart((c) =>
      c.columns.length <= 2
        ? c
        : { ...c, columns: c.columns.filter((_, i) => i !== ci), rows: c.rows.map((r) => r.filter((_, i) => i !== ci)) },
    );

  const addRow = () => setChart((c) => ({ ...c, rows: [...c.rows, c.columns.map(() => '')] }));
  const removeRow = (ri) =>
    setChart((c) => (c.rows.length <= 1 ? c : { ...c, rows: c.rows.filter((_, i) => i !== ri) }));

  const submit = () => {
    const name = chart.name.trim();
    const columns = chart.columns.map((c) => c.trim());
    if (!name) return message.error('Give the size chart a name.');
    if (columns.some((c) => !c)) return message.error('Every column needs a heading.');
    onSubmit({ name, unit: chart.unit.trim() || 'in', categoryId: chart.categoryId ?? null, columns, rows: chart.rows });
  };

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      onOk={submit}
      confirmLoading={loading}
      width={720}
      title={editing ? `Edit "${editing.name}"` : 'New size chart'}
      okText={editing ? 'Save' : 'Create'}
      destroyOnHidden
    >
      <Flex gap={12} wrap style={{ marginBottom: 8 }}>
        <div style={{ flex: '1 1 260px' }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>Name</Typography.Text>
          <Input value={chart.name} onChange={(e) => setChart((c) => ({ ...c, name: e.target.value }))} placeholder="e.g. Women's Kurtas (inches)" />
        </div>
        <div style={{ width: 90 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>Unit</Typography.Text>
          <Input value={chart.unit} onChange={(e) => setChart((c) => ({ ...c, unit: e.target.value }))} placeholder="in / cm" />
        </div>
        <div style={{ flex: '1 1 200px' }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>Category (optional)</Typography.Text>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ width: '100%' }}
            placeholder="Attach to a category"
            value={chart.categoryId ?? undefined}
            onChange={(v) => setChart((c) => ({ ...c, categoryId: v ?? null }))}
            options={categories}
          />
        </div>
      </Flex>

      <Divider style={{ margin: '8px 0' }} />
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        First column is the size label. Measurement columns show the unit on the product page.
      </Typography.Text>

      <div style={{ overflowX: 'auto', paddingTop: 8 }}>
        {/* Column headings */}
        <Flex gap={6} style={{ marginBottom: 6 }}>
          {chart.columns.map((col, ci) => (
            <div key={ci} style={{ width: COL_WIDTH, flex: 'none' }}>
              <Input
                size="small"
                value={col}
                onChange={(e) => setCol(ci, e.target.value)}
                placeholder={ci === 0 ? 'Size' : 'Heading'}
                suffix={
                  chart.columns.length > 2 ? (
                    <DeleteOutlined style={{ cursor: 'pointer', opacity: 0.5 }} onClick={() => removeColumn(ci)} />
                  ) : null
                }
              />
            </div>
          ))}
          <div style={{ width: 32, flex: 'none' }} />
        </Flex>

        {/* Data rows */}
        {chart.rows.map((row, ri) => (
          <Flex gap={6} key={ri} style={{ marginBottom: 6 }}>
            {row.map((cell, ci) => (
              <div key={ci} style={{ width: COL_WIDTH, flex: 'none' }}>
                <Input size="small" value={cell} onChange={(e) => setCell(ri, ci, e.target.value)} />
              </div>
            ))}
            <Button
              size="small"
              type="text"
              icon={<DeleteOutlined />}
              disabled={chart.rows.length <= 1}
              onClick={() => removeRow(ri)}
              aria-label="Remove row"
            />
          </Flex>
        ))}
      </div>

      <Space style={{ marginTop: 8 }}>
        <Button size="small" icon={<PlusOutlined />} onClick={addRow}>Add row</Button>
        <Button size="small" icon={<PlusOutlined />} onClick={addColumn}>Add column</Button>
      </Space>
    </Modal>
  );
}
