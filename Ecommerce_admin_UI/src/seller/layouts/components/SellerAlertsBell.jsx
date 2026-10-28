import { BellOutlined } from '@ant-design/icons';
import { Badge, Button, Dropdown, Empty, Flex, Typography } from 'antd';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@core/api/axiosInstance';
import { queryClient } from '@core/api/queryClient';
import DateText from '@ui/components/DateText';

const SEVERITY_COLOR = {
  error: 'var(--ant-color-error)',
  warning: 'var(--ant-color-warning)',
  info: 'var(--ant-color-info)',
};

/**
 * Derived alerts for the seller account — low stock, an overdue dispatch, a
 * failed payout, a penalty, a rejected campaign. Mirrors the admin shell's
 * AlertsBell so the two headers feel like one product.
 */
export default function SellerAlertsBell() {
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ['seller', 'dashboard', 'alerts'],
    queryFn: () => api.get('/dashboard/alerts'),
    refetchInterval: 60_000,
  });

  const markRead = useMutation({
    mutationFn: (id) => api.post(`/dashboard/alerts/${id}/read`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['seller', 'dashboard', 'alerts'] }),
  });

  const alerts = data?.data ?? [];
  const unread = data?.meta?.unread ?? 0;

  const panel = (
    <div style={{ width: 360, maxHeight: 420, overflowY: 'auto', background: 'var(--ant-color-bg-elevated)', borderRadius: 8, boxShadow: '0 6px 16px rgba(0,0,0,0.12)' }}>
      <Flex justify="space-between" align="center" style={{ padding: '10px 14px' }}>
        <Typography.Text strong style={{ fontSize: 13 }}>Alerts</Typography.Text>
        {unread > 0 && <Typography.Text type="secondary" style={{ fontSize: 12 }}>{unread} unread</Typography.Text>}
      </Flex>

      {alerts.length === 0 ? (
        <Empty description="Nothing needs your attention" style={{ padding: 24 }} />
      ) : (
        alerts.map((a) => (
          <div
            key={a.id}
            role="button"
            tabIndex={0}
            onClick={() => { if (!a.read) markRead.mutate(a.id); if (a.link) navigate(a.link); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && a.link) navigate(a.link); }}
            style={{
              padding: '10px 14px',
              borderTop: '1px solid var(--ant-color-border-secondary)',
              cursor: 'pointer',
              background: a.read ? 'transparent' : 'var(--ant-color-primary-bg)',
            }}
          >
            <Flex gap={8} align="flex-start">
              <span aria-hidden style={{ width: 6, height: 6, borderRadius: 3, marginTop: 6, flexShrink: 0, background: SEVERITY_COLOR[a.severity] ?? SEVERITY_COLOR.info }} />
              <div style={{ minWidth: 0 }}>
                <Typography.Text strong style={{ fontSize: 13 }}>{a.title}</Typography.Text>
                <div><Typography.Text type="secondary" style={{ fontSize: 12 }}>{a.body}</Typography.Text></div>
                <DateText value={a.at} />
              </div>
            </Flex>
          </div>
        ))
      )}
    </div>
  );

  return (
    <Dropdown trigger={['click']} dropdownRender={() => panel} placement="bottomRight">
      <Badge count={unread} size="small" offset={[-2, 2]}>
        <Button type="text" icon={<BellOutlined />} aria-label={`Alerts, ${unread} unread`} />
      </Badge>
    </Dropdown>
  );
}
