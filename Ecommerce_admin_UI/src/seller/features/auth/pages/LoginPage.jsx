import { ArrowRightOutlined, LockOutlined, ShopOutlined, UserOutlined } from '@ant-design/icons';
import { Alert, Button, Form, Input, Typography } from 'antd';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '@core/api/errors';
import { useSessionStore } from '@core/auth/sessionStore';
import { IS_MOCK } from '@core/config/env';
import { SELLER_ACCENT } from '@seller/theme';
import { sellerAuthApi } from '../api/auth.api';
import BackupCodesStep from '../components/BackupCodesStep';
import EnrolTwoFactorStep from '../components/EnrolTwoFactorStep';
import TwoFactorStep from '../components/TwoFactorStep';

/**
 * Credentials are followed by verification or first-time authenticator
 * enrolment. The challenge remains local state and cannot be bookmarked.
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuthenticated = useSessionStore((s) => s.setAuthenticated);
  const [stage, setStage] = useState('credentials');
  const [challenge, setChallenge] = useState(null);
  const [backupCodes, setBackupCodes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState(null);
  const [codeError, setCodeError] = useState(null);

  const finish = (payload) => {
    setAuthenticated(payload);
    const target = location.state?.from?.pathname ?? payload.user.defaultLanding ?? '/';
    navigate(payload.user.mustChangePassword ? '/change-password' : target, { replace: true });
  };

  const submit = async (values) => {
    setLoading(true);
    setFormError(null);
    try {
      const result = await sellerAuthApi.login({ emailOrPhone: values.identifier.trim(), password: values.password });
      // A challenge response carries `stage`; a session response never does.
      if (!result.stage) finish(result);
      else {
        setChallenge(result);
        setStage(result.stage);
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 403 && e.details?.applicationStatus) {
        const application = {
          applicationStatus: e.details.applicationStatus,
          rejectionReason: e.details.rejectionReason,
          email: e.details.email,
          storeName: e.details.storeName,
        };
        sessionStorage.setItem('sellerApplication', JSON.stringify(application));
        navigate('/application-status', { state: application });
        return;
      }
      setFormError(e instanceof ApiError ? e.message : 'Could not sign you in.');
    } finally {
      setLoading(false);
    }
  };

  const submitCode = async ({ code }) => {
    setLoading(true);
    setCodeError(null);
    try {
      finish(await sellerAuthApi.verify2fa({ challengeId: challenge.challengeId, code }));
    } catch (error) {
      setCodeError(error instanceof ApiError ? (error.fieldErrors?.code ?? error.message) : 'That did not work.');
      if (error instanceof ApiError && error.status === 401 && !error.fieldErrors) {
        setStage('credentials');
        setChallenge(null);
        setFormError(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const submitEnrolment = async ({ code }) => {
    setLoading(true);
    setCodeError(null);
    try {
      const payload = await sellerAuthApi.enrol2fa({ challengeId: challenge.challengeId, code });
      if (payload.backupCodes?.length) {
        setBackupCodes({ codes: payload.backupCodes, payload });
        setStage('backup_codes');
      } else finish(payload);
    } catch (error) {
      setCodeError(error instanceof ApiError ? (error.fieldErrors?.code ?? error.message) : 'That did not work.');
    } finally {
      setLoading(false);
    }
  };

  if (stage === 'verify_2fa') {
    return <TwoFactorStep challenge={challenge} loading={loading} error={codeError} onSubmit={submitCode} onBack={() => { setStage('credentials'); setChallenge(null); setCodeError(null); }} />;
  }

  if (stage === 'enrol_2fa') {
    return <EnrolTwoFactorStep challenge={challenge} loading={loading} error={codeError} onSubmit={submitEnrolment} />;
  }

  if (stage === 'backup_codes') {
    return <BackupCodesStep codes={backupCodes.codes} onContinue={() => finish(backupCodes.payload)} />;
  }

  return (
    <div>
      <h2 className="sl-title">Seller Sign In</h2>
      <div className="sl-sub">Manage your Arise store.</div>

      {formError && (
        <Alert type="error" showIcon message={formError} style={{ marginBottom: 16 }} closable onClose={() => setFormError(null)} />
      )}

      <Form layout="vertical" requiredMark={false} onFinish={submit} disabled={loading}>
        <Form.Item
          name="identifier"
          label="Email or phone"
          rules={[{ required: true, message: 'Enter your email or phone.' }]}
        >
          <Input autoFocus size="large" prefix={<UserOutlined />} placeholder="you@store.test or 10-digit phone" autoComplete="username" />
        </Form.Item>

        <Form.Item name="password" label="Password" rules={[{ required: true, message: 'Enter your password.' }]}>
          <Input.Password size="large" prefix={<LockOutlined />} placeholder="••••••••••••" autoComplete="current-password" />
        </Form.Item>

        <Button className="sl-primary ar-primary-btn" type="primary" size="large" htmlType="submit" block loading={loading} style={{ background: SELLER_ACCENT, borderColor: SELLER_ACCENT, color: '#fff' }}>
          Sign In <ArrowRightOutlined />
        </Button>
      </Form>

      <Link className="sl-forgot" to="/forgot-password">Forgot your password?</Link>

      <div className="sl-or">New to Arise?</div>
      <Link to="/register">
        <Button className="sl-secondary" block size="large" icon={<ShopOutlined />}>
          Create a seller account
        </Button>
      </Link>

      {IS_MOCK && (
        <Alert
          type="info"
          style={{ marginTop: 18 }}
          message="Demo accounts"
          description={
            <Typography.Text style={{ fontSize: 12 }}>
              Owner <Typography.Text code>owner@arise.test</Typography.Text>, sub-users{' '}
              <Typography.Text code>catalog@arise.test</Typography.Text> /{' '}
              <Typography.Text code>orders@arise.test</Typography.Text>. Pending applications cannot sign in. All passwords{' '}
              <Typography.Text code>Arise@123456</Typography.Text>.
            </Typography.Text>
          }
        />
      )}
    </div>
  );
}
