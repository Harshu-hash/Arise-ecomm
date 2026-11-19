import { WarningFilled } from '@ant-design/icons';
import { Checkbox, Collapse, Flex, Input, Space, Tag, Tooltip, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { ALL_PERMISSIONS } from '@core/rbac/catalog';
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

// Sections mirror the admin sidebar (src/admin/nav/navigation.js); each lists the
// `module.resource` catalog entries behind that menu's pages. Permission keys are
// unchanged, so catalog entries not listed here stay valid, just not editable here.
const SECTIONS = [
  { key: 'overview', label: 'Dashboard & Analytics', res: ['dashboard.dashboard', 'dashboard.finance_widgets', 'dashboard.action_center', 'reports.sales', 'reports.operations', 'reports.finance'] },
  { key: 'catalog', label: 'Catalog', res: ['catalog.product', 'catalog.category', 'catalog.brand', 'catalog.attribute', 'catalog.sizechart'] },
  { key: 'marketing', label: 'Marketing', res: ['marketing.campaign', 'ads.campaign', 'notifications.broadcast', 'marketing.coupon', 'marketing.deal', 'cms.banner', 'cms.home', 'cms.page'] },
  { key: 'orders', label: 'Orders', res: ['orders.order', 'orders.item', 'orders.return', 'logistics.shipment'] },
  { key: 'support', label: 'Support', res: ['support.ticket', 'reviews.review', 'reviews.qa'] },
  { key: 'sellers', label: 'Sellers', res: ['sellers.seller', 'sellers.application', 'sellers.kyc'] },
  { key: 'customers', label: 'Customers', res: ['customers.customer'] },
  { key: 'finance', label: 'Finance', res: ['finance.payment', 'finance.refund', 'finance.payout'] },
  { key: 'roles', label: 'Roles & Permissions', res: ['admin.role'] },
  { key: 'settings', label: 'Settings & Staff', res: ['admin.settings', 'admin.user'] },
];

const MODULES = SECTIONS.map((s) => {
  const rows = s.res.map((id) => ({
    id,
    perms: ALL_PERMISSIONS.filter((p) => `${p.moduleKey}.${p.resourceKey}` === id),
  }));
  const perms = rows.flatMap((r) => r.perms);
  const columns = [];
  for (const p of perms) if (!columns.some((c) => c.action === p.action)) columns.push({ action: p.action, label: p.actionLabel });
  return { ...s, rows, perms, columns };
});

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
    mod.perms.some(
      (p) => p.resourceLabel.toLowerCase().includes(needle) || p.actionLabel.toLowerCase().includes(needle),
    );

  const items = MODULES.filter(matches).map((mod) => {
    const perms = mod.perms;
    const granted = perms.filter((p) => selected.has(p.key)).length;
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
  const columns = mod.columns;
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
          {mod.rows.map((res) => {
            const byAction = new Map(res.perms.map((p) => [p.action, p]));
            return (
              <tr key={res.id}>
                <td style={cell()}>{res.perms[0]?.resourceLabel ?? res.id}</td>
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
