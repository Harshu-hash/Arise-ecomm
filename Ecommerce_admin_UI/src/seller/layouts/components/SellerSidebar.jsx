import { Menu, Tag, Typography } from 'antd';
import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LAYOUT } from '@theme/tokens';
import { useCan } from '@core/rbac/useCan';
import { CURRENT_PHASE, NAV_GROUPS } from '@seller/nav/navigation';
import { SELLER_ACCENT } from '@seller/theme';
import { NAV_ICONS } from './navIcons';

/**
 * Permission-filtered seller navigation. A group disappears when the signed-in
 * user (owner or sub-user) holds none of its items, so a Catalog Manager does
 * not see a Payments section they cannot open.
 */
export default function SellerSidebar({ collapsed, onNavigate }) {
  const can = useCan();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const { items, openKeys } = useMemo(() => {
    const built = [];
    let activeGroup = null;

    for (const group of NAV_GROUPS) {
      const allowed = group.items.filter((i) => can(i.perm));
      if (!allowed.length) continue;
      if (allowed.some((i) => isActive(pathname, i.path))) activeGroup = group.key;

      const children = allowed.map((i) => ({
        key: i.path,
        label: (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.label}</span>
            {i.phase > CURRENT_PHASE && (
              <Tag bordered={false} style={{ margin: 0, fontSize: 10, lineHeight: '16px', padding: '0 4px', opacity: 0.75 }}>
                Soon
              </Tag>
            )}
          </span>
        ),
      }));

      if (!group.label) {
        built.push({ key: allowed[0].path, icon: NAV_ICONS[group.icon], label: allowed[0].label });
        continue;
      }
      built.push({ key: group.key, icon: NAV_ICONS[group.icon], label: group.label, children });
    }

    return { items: built, openKeys: activeGroup ? [activeGroup] : [] };
  }, [can, pathname]);

  const selected = useMemo(() => {
    const paths = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.path));
    const match = paths.filter((p) => isActive(pathname, p)).sort((a, b) => b.length - a.length)[0];
    return match ? [match] : [];
  }, [pathname]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          height: LAYOUT.headerHeight,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: collapsed ? '0 20px' : '0 16px',
          flexShrink: 0,
        }}
      >
        <div
          aria-hidden
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            background: `linear-gradient(135deg, ${SELLER_ACCENT}, #6366F1)`,
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          A
        </div>
        {!collapsed && (
          <Typography.Text strong style={{ color: '#fff', fontSize: 15, whiteSpace: 'nowrap' }}>
            Arise Seller
          </Typography.Text>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingBottom: 16 }}>
        <Menu
          theme="dark"
          mode="inline"
          items={items}
          selectedKeys={selected}
          defaultOpenKeys={openKeys}
          onClick={({ key }) => {
            if (key.startsWith('/')) {
              navigate(key);
              onNavigate?.();
            }
          }}
          style={{ borderInlineEnd: 'none', background: 'transparent' }}
        />
      </div>
    </div>
  );
}

function isActive(pathname, path) {
  if (path === '/') return pathname === '/';
  return pathname === path || pathname.startsWith(`${path}/`);
}
