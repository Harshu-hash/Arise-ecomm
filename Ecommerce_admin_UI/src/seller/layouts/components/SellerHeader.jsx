import { MenuOutlined, MoonOutlined, QuestionCircleOutlined, StarFilled, SunOutlined } from '@ant-design/icons';
import { Button, Flex, Layout, Space, Tag, Tooltip, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useThemeStore } from '@theme/themeStore';
import { useCurrentUser } from '@core/rbac/useCan';
import { ENV } from '@core/config/env';
import useBreakpoint from '@ui/hooks/useBreakpoint';
import SellerAlertsBell from './SellerAlertsBell';
import SellerUserMenu from './SellerUserMenu';

export default function SellerHeader({ onToggleSidebar, onSignOut }) {
  const { isMobile } = useBreakpoint();
  const navigate = useNavigate();
  const resolved = useThemeStore((s) => s.resolved);
  const toggle = useThemeStore((s) => s.toggle);
  const user = useCurrentUser();

  return (
    <Layout.Header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        padding: '0 12px',
        borderBottom: '1px solid var(--ant-color-border-secondary)',
        background: 'var(--ant-color-bg-container)',
      }}
    >
      <Flex align="center" justify="space-between" gap={8} style={{ height: '100%' }}>
        <Flex align="center" gap={8} style={{ minWidth: 0 }}>
          <Button type="text" icon={<MenuOutlined />} onClick={onToggleSidebar} aria-label="Toggle navigation" />
          {!isMobile && user?.tier && (
            <Tag bordered={false} color="purple" style={{ margin: 0, fontWeight: 600 }}>
              {user.tier}
            </Tag>
          )}
          {!isMobile && user?.rating && (
            <Space size={4}>
              <StarFilled style={{ color: '#FFA41C', fontSize: 12 }} />
              <Typography.Text style={{ fontSize: 12 }}>{user.rating}</Typography.Text>
            </Space>
          )}
          {ENV.label && (
            <Tag bordered={false} color={ENV.mode === 'live' ? 'red' : 'geekblue'} style={{ margin: 0, fontSize: 10, fontWeight: 600 }}>
              {ENV.label}
            </Tag>
          )}
        </Flex>

        <Flex align="center" gap={isMobile ? 0 : 4}>
          <Tooltip title="Help & support">
            <Button type="text" icon={<QuestionCircleOutlined />} aria-label="Help" onClick={() => navigate('/support')} />
          </Tooltip>
          <SellerAlertsBell />
          <Tooltip title={resolved === 'dark' ? 'Switch to light' : 'Switch to dark'}>
            <Button
              type="text"
              icon={resolved === 'dark' ? <SunOutlined /> : <MoonOutlined />}
              onClick={toggle}
              aria-label="Toggle dark mode"
            />
          </Tooltip>
          <SellerUserMenu onSignOut={onSignOut} />
        </Flex>
      </Flex>
    </Layout.Header>
  );
}
