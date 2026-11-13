import { Menu } from 'antd';
import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LAYOUT } from '@theme/tokens';
import { NAV_GROUPS } from '@seller/nav/navigation';
import { SELLER_ACCENT } from '@seller/theme';
import { NAV_ICONS } from './navIcons';

/**
 * Seller navigation. Every signed-in user sees the full menu — the panel no
 * longer filters items by permission.
 */
export default function SellerSidebar({ collapsed, onNavigate }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const { items, openKeys } = useMemo(() => {
    const built = [];
    let activeGroup = null;
    let currentSection = null;

    for (const group of NAV_GROUPS) {
      const groupItems = group.items;
      if (!groupItems.length) continue;

      // Emit an uppercase section divider whenever the section changes.
      if (group.section && group.section !== currentSection) {
        currentSection = group.section;
        built.push({
          key: `section:${currentSection}`,
          type: 'group',
          label: <span className="arise-nav-section">{currentSection}</span>,
        });
      }

      if (groupItems.some((i) => isActive(pathname, i.path))) activeGroup = group.key;

      const children = groupItems.map((i) => ({
        key: i.path,
        label: <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.label}</span>,
      }));

      if (!group.label) {
        built.push({ key: groupItems[0].path, icon: NAV_ICONS[group.icon], label: groupItems[0].label });
        continue;
      }
      built.push({ key: group.key, icon: NAV_ICONS[group.icon], label: group.label, children });
    }

    return { items: built, openKeys: activeGroup ? [activeGroup] : [] };
  }, [pathname]);

  const selected = useMemo(() => {
    const paths = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.path));
    const match = paths.filter((p) => isActive(pathname, p)).sort((a, b) => b.length - a.length)[0];
    return match ? [match] : [];
  }, [pathname]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        className="arise-brand"
        style={{ height: LAYOUT.headerHeight, padding: collapsed ? '0 22px' : '0 20px' }}
      >
        <div aria-hidden className="arise-brand-mark" style={{ background: SELLER_ACCENT, color: '#fff' }}>
          A
        </div>
        {!collapsed && <span className="arise-brand-name">Arise Seller</span>}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '12px 0 16px' }}>
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
