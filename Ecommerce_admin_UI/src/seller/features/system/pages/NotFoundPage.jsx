import { Button, Result, Space } from 'antd';
import { useNavigate } from 'react-router-dom';

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <Result
      status="404"
      title="Page not found"
      subTitle="The link may be out of date, or the page may have moved."
      extra={
        <Space>
          <Button type="primary" onClick={() => navigate('/')}>
            Back to dashboard
          </Button>
          <Button onClick={() => navigate(-1)}>Go back</Button>
        </Space>
      }
    />
  );
}
