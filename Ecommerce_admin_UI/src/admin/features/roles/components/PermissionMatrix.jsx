import { WarningFilled } from '@ant-design/icons';
import { Checkbox, Collapse, Flex, Input, Space, Tag, Tooltip, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { ALL_PERMISSIONS, PERMISSION_MODULES, moduleActionColumns } from '@core/rbac/catalog';
import { toggleKeys } from './permissionSelection';

/**
 * The permission matrix: every catalog module is a collapsible panel of
 * resources (rows) × actions (checkboxes). It is a controlled field — `value`
 * is the array of granted permission keys, so it drops straight into a
 * Form.Item.
 *
 * Selecting an action pulls in the `view` it implies; clearing `view` clears
 * the actions that depend on it, so the selection the editor shows is always
 * one the server will accept unchanged.
 */

const PERMS_BY_MODULE = PERMISSION_MODULES.reduce((acc, mod) => {
  acc[mod.key] = ALL_PERMISSIONS.filter((p) => p.moduleKey === mod.key);
  return acc;
}, {});

export default function PermissionMatrix({ value, onChange, disabled = false }) {
  const [q, setQ] = useState('');
  // A role may store the literal '*' (Super Admin); show it as everything on.
  const selected = useMemo(
    () => new Set(value?.includes('*') ? ALL_PERMISSIONS.map((p) => p.key) : (value ?? [])),
    [value],
  );

  const setKeys = (keys, on) => onChange?.(toggleKeys(Array.from(selected), keys, on));

  const needle = q.trim().toLowerCase();
  const matches = (mod) =>
    !needle ||
    mod.label.toLowerCase().includes(needle) ||
    PERMS_BY_MODULE[mod.key].some(
      (p) => p.resourceLabel.toLowerCase().includes(needle) || p.actionLabel.toLowerCase().includes(needle),
    );

  const grantedIn = (moduleKey) => PERMS_BY_MODULE[moduleKey].filter((p) => selected.has(p.key)).length;

  const items = PERMISSION_MODULES.filter(matches).map((mod) => {
    const perms = PERMS_BY_MODULE[mod.key];
    const granted = grantedIn(mod.key);
    return {
      key: mod.key,
      label: (
        <Flex justify="space-between" align="center" gap={8} style={{ width: '100%' }}>
          <Typography.Text strong>{mod.label}</Typography.Text>
          <Space size={8} onClick={(e) => e.stopPropagation()}>
            {granted > 0 && <Tag color="blue" style={{ marginInlineEnd: 0 }}>{granted} / {perms.length}</Tag>}
            <Checkbox
              disabled={disabled}
              checked={granted === perms.length}
              indeterminate={granted > 0 && granted < perms.length}
              onChange={(e) => setKeys(perms.map((p) => p.key), e.target.checked)}
            >
              All
            </Checkbox>
          </Space>
        </Flex>
      ),
      children: <ModuleGrid mod={mod} selected={selected} onToggle={setKeys} disabled={disabled} />,
    };
  });

  return (
    <Flex vertical gap={10}>
      <Input.Search
        allowClear
        placeholder="Filter modules, resources or actions"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ maxWidth: 360 }}
      />
      <Collapse items={items} defaultActiveKey={needle ? items.map((i) => i.key) : []} />
      {items.length === 0 && (
        <Typography.Text type="secondary">No permissions match “{q}”.</Typography.Text>
      )}
    </Flex>
  );
}

function ModuleGrid({ mod, selected, onToggle, disabled }) {
  const columns = moduleActionColumns(mod.key);
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="perm-grid" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            <th style={cell(true)}>Resource</th>
            {columns.map((c) => (
              <th key={c.action} style={{ ...cell(true), textAlign: 'center' }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {mod.resources.map((res) => {
            const byAction = new Map(
              ALL_PERMISSIONS.filter((p) => p.moduleKey === mod.key && p.resourceKey === res.key).map(
                (p) => [p.action, p],
              ),
            );
            return (
              <tr key={res.key}>
                <td style={cell()}>{res.label}</td>
                {columns.map((c) => {
                  const perm = byAction.get(c.action);
                  return (
                    <td key={c.action} style={{ ...cell(), textAlign: 'center' }}>
                      {perm ? (
                        <Space size={4}>
                          <Checkbox
                            disabled={disabled}
                            checked={selected.has(perm.key)}
                            onChange={(e) => onToggle([perm.key], e.target.checked)}
                          />
                          {perm.sensitive && (
                            <Tooltip title={`Sensitive${perm.mc ? ' · needs a second approver' : ''}`}>
                              <WarningFilled style={{ color: 'var(--ant-color-warning)', fontSize: 11 }} />
                            </Tooltip>
                          )}
                        </Space>
                      ) : (
                        <Typography.Text type="secondary">—</Typography.Text>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const cell = (head = false) => ({
  padding: '6px 10px',
  borderBottom: '1px solid var(--ant-color-border-secondary)',
  textAlign: 'left',
  whiteSpace: 'nowrap',
  ...(head ? { color: 'var(--ant-color-text-secondary)', fontWeight: 500 } : {}),
});
