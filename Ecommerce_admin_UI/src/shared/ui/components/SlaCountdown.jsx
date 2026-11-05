import { ClockCircleOutlined } from '@ant-design/icons';
import { Space, Tag, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';

function parts(ms) {
  const absolute = Math.abs(ms);
  const hours = Math.floor(absolute / 3_600_000);
  const minutes = Math.floor((absolute % 3_600_000) / 60_000);
  return `${hours}h ${minutes}m`;
}

export default function SlaCountdown({ dueAt, compact = false, now: fixedNow }) {
  const [, tick] = useState(0);
  useEffect(() => { if (fixedNow) return undefined; const timer = setInterval(() => tick((n) => n + 1), 60_000); return () => clearInterval(timer); }, [fixedNow]);
  const delta = useMemo(() => new Date(dueAt).getTime() - (fixedNow ? new Date(fixedNow).getTime() : Date.now()), [dueAt, fixedNow]);
  const breached = delta < 0;
  const label = breached ? `${parts(delta)} overdue` : `${parts(delta)} remaining`;
  if (compact) return <Tag color={breached ? 'red' : delta < 3_600_000 ? 'orange' : 'blue'} icon={<ClockCircleOutlined />}>{label}</Tag>;
  return <Space role="timer" aria-live="polite"><ClockCircleOutlined /><Typography.Text type={breached ? 'danger' : undefined} strong>{label}</Typography.Text></Space>;
}
