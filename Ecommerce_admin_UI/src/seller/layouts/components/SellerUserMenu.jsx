import {
  DesktopOutlined,
  KeyOutlined,
  LogoutOutlined,
  MoonOutlined,
  SunOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Avatar, Dropdown, Flex, Space, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useThemeStore } from '@theme/themeStore';
import { useCurrentUser } from '@core/rbac/useCan';
import { avatarColor, initials } from '@core/utils/misc';
import useBreakpoint from '@ui/hooks/useBreakpoint';

export default function SellerUserMenu({ onSignOut }) {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const { isMobile } = useBreakpoint();
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);

  const items = [
    {
      key: 'header',
      type: 'group',
      label: (
        <div style={{ padding: '4px 0 2px' }}>
          <Typography.Text strong style={{ fontSize: 13 }}>
            {user?.name}
          </Typography.Text>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {user?.email}
            </Typography.Text>
          </div>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              {user?.roleName} · {user?.storeName}
            </Typography.Text>
          </div>
        </div>
      ),
    },
    { type: 'divider' },
    { key: '/account', icon: <UserOutlined />, label: 'My account' },
    { key: '/change-password', icon: <KeyOutlined />, label: 'Change password' },
    { type: 'divider' },
    {
      key: 'theme',
      icon: preference === 'dark' ? <MoonOutlined /> : preference === 'light' ? <SunOutlined /> : <DesktopOutlined />,
      label: 'Appearance',
      children: [
        { key: 'theme:system', icon: <DesktopOutlined />, label: 'Match system' },
        { key: 'theme:light', icon: <SunOutlined />, label: 'Light' },
        { key: 'theme:dark', icon: <MoonOutlined />, label: 'Dark' },
      ],
    },
    { type: 'divider' },
    { key: 'signout', icon: <LogoutOutlined />, label: 'Sign out', danger: true },
  ];

  return (
    <Dropdown
      trigger={['click']}
      placement="bottomRight"
      menu={{
        items,
        selectedKeys: [`theme:${preference}`],
        onClick: ({ key }) => {
          if (key === 'signout') onSignOut();
          else if (key.startsWith('theme:')) setPreference(key.split(':')[1]);
          else navigate(key);
        },
      }}
    >
      <Flex align="center" gap={8} style={{ cursor: 'pointer', padding: '0 4px' }}>
        <Avatar size={28} style={{ backgroundColor: avatarColor(user?.email), fontSize: 12 }}>
          {initials(user?.name)}
        </Avatar>
        {!isMobile && (
          <Space direction="vertical" size={0} style={{ lineHeight: 'normal' }}>
            <Typography.Text style={{ fontSize: 13, lineHeight: 1.2 }}>{user?.storeName}</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 11, lineHeight: 1.2 }}>
              {user?.roleName}
            </Typography.Text>
          </Space>
        )}
      </Flex>
    </Dropdown>
  );
}
