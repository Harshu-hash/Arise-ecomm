import { Button, Result, Space, Tag, Typography } from 'antd';
import { Link, useLocation } from 'react-router-dom';

function savedApplication() {
  try { return JSON.parse(sessionStorage.getItem('sellerApplication') ?? 'null'); }
  catch { return null; }
}

/** Public application outcome page; applicants do not receive a session yet. */
export default function OnboardingStatusPage() {
  const location = useLocation();
  const data = location.state ?? savedApplication() ?? { applicationStatus: 'UNDER_REVIEW' };
  const status = String(data.applicationStatus ?? 'UNDER_REVIEW').toUpperCase();
  const rejected = status === 'REJECTED';
  const approved = ['APPROVED', 'ACTIVE'].includes(status);

  return <Result
    status={rejected ? 'error' : approved ? 'success' : 'info'}
    title={rejected ? 'Your application was not approved' : approved ? 'Your seller account is approved' : 'Application submitted for review'}
    subTitle={rejected ? 'Review the decision reason below. Contact seller support before applying again.' : approved ? 'You can now sign in and complete two-step security setup.' : 'Our team will review your shop and documents. Login remains locked until an admin approves the application.'}
    extra={<Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Tag color={rejected ? 'red' : approved ? 'green' : 'gold'}>{status.replaceAll('_', ' ')}</Tag>
      {data.applicationId && <Typography.Text type="secondary">Application ID: <Typography.Text copyable code>{data.applicationId}</Typography.Text></Typography.Text>}
      {data.storeName && <Typography.Text>{data.storeName} · {data.email}</Typography.Text>}
      {data.rejectionReason && <Typography.Paragraph type="danger" style={{ maxWidth: 520, margin: '0 auto' }}>{data.rejectionReason}</Typography.Paragraph>}
      <Link to="/login"><Button type="primary">Back to sign in</Button></Link>
    </Space>}
  />;
}
