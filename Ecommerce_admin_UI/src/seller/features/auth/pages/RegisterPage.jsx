import { BankOutlined, CheckCircleFilled, EnvironmentOutlined, FileProtectOutlined, LockOutlined, MailOutlined, PhoneOutlined, ShopOutlined, UploadOutlined, UserOutlined } from '@ant-design/icons';
import { Alert, Button, Col, Form, Input, Row, Space, Steps, Typography, Upload } from 'antd';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '@core/api/errors';
import { IS_MOCK } from '@core/config/env';
import { sellerAuthApi } from '../api/auth.api';

const STEP_FIELDS = [
  ['name', 'shopName', 'email', 'phone', 'password', 'confirmPassword'],
  ['locality', 'pincode', 'city', 'state', 'address'],
  ['gstin', 'pan', 'bankAccountHolder', 'bankAccountNumber', 'bankIfsc', 'tradeLicense', 'gstCertificate', 'idProof'],
];
const uploadValue = (event) => (Array.isArray(event) ? event : event?.fileList);

/** Public three-step application from the reference quick-commerce project. */
export default function RegisterPage() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState(null);
  const [verification, setVerification] = useState({ email: {}, phone: {} });

  const sendOtp = async (kind) => {
    try {
      await form.validateFields([kind]);
      const value = form.getFieldValue(kind).trim();
      setFormError(null);
      const { exists } = await sellerAuthApi.checkRegistrationExists({ kind, value });
      if (exists) {
        form.setFields([{ name: kind, errors: [`This ${kind} is already registered.`] }]);
        return;
      }
      const result = await sellerAuthApi.sendRegistrationOtp({ kind, value });
      setVerification((current) => ({ ...current, [kind]: { ...result, value, code: '' } }));
    } catch (error) {
      if (error instanceof ApiError) setFormError(error.message);
    }
  };

  const verifyOtp = async (kind) => {
    const item = verification[kind];
    if (!item.code) return;
    try {
      const result = await sellerAuthApi.verifyRegistrationOtp({ challengeId: item.challengeId, code: item.code });
      setVerification((current) => ({ ...current, [kind]: { ...current[kind], ...result, verified: true } }));
    } catch (error) {
      setVerification((current) => ({ ...current, [kind]: { ...current[kind], error: error?.message ?? 'Verification failed.' } }));
    }
  };

  const next = async () => {
    try {
      await form.validateFields(STEP_FIELDS[step]);
      if (step === 0) {
        const errors = [];
        if (!verification.email.verified) errors.push({ name: 'email', errors: ['Verify your business email.'] });
        if (!verification.phone.verified) errors.push({ name: 'phone', errors: ['Verify your contact number.'] });
        if (errors.length) { form.setFields(errors); return; }
      }
      setStep((value) => value + 1);
      setFormError(null);
    } catch { /* Ant Form describes the invalid field. */ }
  };

  const submit = async () => {
    setLoading(true);
    setFormError(null);
    try {
      const values = await form.validateFields();
      const payload = new FormData();
      [
        'name', 'shopName', 'email', 'phone', 'password', 'locality', 'pincode', 'city', 'state', 'address',
        'gstin', 'pan', 'bankAccountHolder', 'bankAccountNumber', 'bankIfsc',
      ].forEach((key) => payload.append(key, String(values[key] ?? '').trim()));
      payload.append('emailVerificationToken', verification.email.verificationToken);
      payload.append('phoneVerificationToken', verification.phone.verificationToken);
      ['tradeLicense', 'gstCertificate', 'idProof'].forEach((key) => {
        const file = values[key]?.[0];
        payload.append(key, file?.originFileObj ?? file);
      });
      const result = await sellerAuthApi.register(payload);
      sessionStorage.setItem('sellerApplication', JSON.stringify(result));
      navigate('/application-status', { replace: true, state: result });
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) {
        form.setFields(Object.entries(error.fieldErrors).map(([name, message]) => ({ name, errors: [message] })));
      }
      if (error instanceof ApiError) setFormError(error.message);
    } finally { setLoading(false); }
  };

  const onValuesChange = (changed) => {
    ['email', 'phone'].forEach((kind) => {
      if (kind in changed && verification[kind].value !== changed[kind]) {
        setVerification((current) => ({ ...current, [kind]: {} }));
      }
    });
  };

  return (
    <div>
      <Typography.Title level={3} style={{ margin: 0 }}>Apply to sell on Arise</Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginTop: 4 }}>Complete all three steps. Your login unlocks after admin approval.</Typography.Paragraph>
      <Steps size="small" current={step} style={{ margin: '20px 0 24px' }} items={[{ title: 'Account' }, { title: 'Shop location' }, { title: 'Business & documents' }]} />
      {formError && <Alert type="error" showIcon message={formError} closable onClose={() => setFormError(null)} style={{ marginBottom: 16 }} />}

      <Form form={form} layout="vertical" requiredMark={false} disabled={loading} onValuesChange={onValuesChange}>
        <div hidden={step !== 0}>
          <Row gutter={12}>
            <Col xs={24} md={12}><Form.Item name="name" label="Owner name" rules={[{ required: true, message: 'Enter the owner name.' }, { pattern: /^[A-Za-z ]+$/, message: 'Use letters and spaces only.' }, { max: 50 }]}><Input autoFocus prefix={<UserOutlined />} placeholder="Full name" /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="shopName" label="Shop / business name" rules={[{ required: true, message: 'Enter your shop name.' }]}><Input prefix={<ShopOutlined />} placeholder="e.g. Nova Essentials" /></Form.Item></Col>
          </Row>
          <VerifiedContact kind="email" label="Business email" icon={<MailOutlined />} state={verification.email} onSend={() => sendOtp('email')} onCode={(code) => setVerification((current) => ({ ...current, email: { ...current.email, code, error: null } }))} onVerify={() => verifyOtp('email')} />
          <VerifiedContact kind="phone" label="Contact number" icon={<PhoneOutlined />} state={verification.phone} onSend={() => sendOtp('phone')} onCode={(code) => setVerification((current) => ({ ...current, phone: { ...current.phone, code, error: null } }))} onVerify={() => verifyOtp('phone')} />
          <Row gutter={12}>
            <Col xs={24} md={12}><Form.Item name="password" label="Password" rules={[{ required: true }, { min: 8, message: 'Use at least 8 characters.' }, { pattern: /^(?=.*[A-Za-z])(?=.*\d)/, message: 'Include a letter and a number.' }]}><Input.Password prefix={<LockOutlined />} autoComplete="new-password" /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="confirmPassword" label="Confirm password" dependencies={['password']} rules={[{ required: true }, ({ getFieldValue }) => ({ validator(_, value) { return !value || getFieldValue('password') === value ? Promise.resolve() : Promise.reject(new Error('Passwords do not match.')); } })]}><Input.Password prefix={<LockOutlined />} autoComplete="new-password" /></Form.Item></Col>
          </Row>
        </div>

        <div hidden={step !== 1}>
          <Alert type="info" showIcon icon={<EnvironmentOutlined />} message="Shop location" description="Enter your shop's address. This maps directly to the backend location record." style={{ marginBottom: 16 }} />
          <Row gutter={12}>
            <Col xs={24} md={12}><Form.Item name="locality" label="Locality / area" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="pincode" label="Pincode" rules={[{ required: true }, { pattern: /^\d{6}$/, message: 'Enter a 6-digit pincode.' }]}><Input maxLength={6} inputMode="numeric" /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="city" label="City" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="state" label="State" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={24}><Form.Item name="address" label="Full address" rules={[{ required: true }]}><Input.TextArea rows={2} /></Form.Item></Col>
          </Row>
        </div>

        <div hidden={step !== 2}>
          <Alert type="info" showIcon icon={<BankOutlined />} message="Business & bank details" description="Used to verify GSTIN, PAN and your payout account before approval." style={{ marginBottom: 16 }} />
          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item name="gstin" label="GSTIN" normalize={(v) => v?.toUpperCase()} rules={[{ required: true }, { pattern: /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, message: 'Enter a valid 15-character GSTIN.' }]}>
                <Input maxLength={15} placeholder="22AAAAA0000A1Z5" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="pan" label="PAN" normalize={(v) => v?.toUpperCase()} rules={[{ required: true }, { pattern: /^[A-Z]{5}\d{4}[A-Z]$/, message: 'Enter a valid 10-character PAN.' }]}>
                <Input maxLength={10} placeholder="AAAAA0000A" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="bankAccountHolder" label="Bank account holder name" rules={[{ required: true, message: 'Enter the account holder name.' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="bankAccountNumber" label="Bank account number" rules={[{ required: true }, { pattern: /^\d{9,18}$/, message: 'Enter a valid account number.' }]}>
                <Input inputMode="numeric" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="bankIfsc" label="IFSC code" normalize={(v) => v?.toUpperCase()} rules={[{ required: true }, { pattern: /^[A-Z]{4}0[A-Z\d]{6}$/, message: 'Enter a valid 11-character IFSC code.' }]}>
                <Input maxLength={11} placeholder="HDFC0001234" />
              </Form.Item>
            </Col>
          </Row>

          <Alert type="info" showIcon icon={<FileProtectOutlined />} message="Upload all mandatory documents" description="PDF, JPG or PNG; one file per document. The backend receives multipart uploads." style={{ marginTop: 8, marginBottom: 16 }} />
          <Row gutter={12}><DocumentField name="tradeLicense" label="Trade license" /><DocumentField name="gstCertificate" label="GST certificate" /><DocumentField name="idProof" label="Owner ID proof" /></Row>
        </div>

        <Space style={{ width: '100%', justifyContent: 'space-between', marginTop: 8 }}>
          <Button disabled={step === 0} onClick={() => setStep((value) => value - 1)}>Back</Button>
          {step < 2 ? <Button type="primary" onClick={next}>Continue</Button> : <Button type="primary" loading={loading} onClick={submit}>Submit application</Button>}
        </Space>
      </Form>
      <div style={{ textAlign: 'center', marginTop: 18 }}><Typography.Text type="secondary">Already applied? <Link to="/login">Sign in</Link></Typography.Text></div>
      {IS_MOCK && <Alert type="success" showIcon message="Mock OTP" description="The generated four-digit code appears beside each OTP field." style={{ marginTop: 16 }} />}
    </div>
  );
}

function VerifiedContact({ kind, label, icon, state, onSend, onCode, onVerify }) {
  const email = kind === 'email';
  return <div>
    <Form.Item name={kind} label={label} rules={email ? [{ required: true }, { type: 'email', message: 'Enter a valid email.' }] : [{ required: true }, { pattern: /^\d{10}$/, message: 'Enter exactly 10 digits.' }]}>
      <Input prefix={icon} maxLength={email ? undefined : 10} inputMode={email ? undefined : 'numeric'} addonAfter={state.verified ? <CheckCircleFilled style={{ color: '#16a34a' }} /> : <Button type="link" size="small" onClick={onSend}>{state.challengeId ? 'Resend OTP' : 'Send OTP'}</Button>} />
    </Form.Item>
    {state.challengeId && !state.verified && <Form.Item validateStatus={state.error ? 'error' : undefined} help={state.error} style={{ marginTop: -12 }}><Space.Compact block><Input value={state.code} onChange={(event) => onCode(event.target.value.replace(/\D/g, '').slice(0, 4))} maxLength={4} inputMode="numeric" placeholder="4-digit OTP" /><Button onClick={onVerify} disabled={state.code?.length !== 4}>Verify{state.devHint?.code ? ` (${state.devHint.code})` : ''}</Button></Space.Compact></Form.Item>}
  </div>;
}

function DocumentField({ name, label }) {
  return <Col xs={24} md={8}><Form.Item name={name} label={label} valuePropName="fileList" getValueFromEvent={uploadValue} rules={[{ required: true, message: `Upload ${label.toLowerCase()}.` }]}><Upload.Dragger beforeUpload={() => false} maxCount={1} accept=".pdf,.jpg,.jpeg,.png"><UploadOutlined style={{ fontSize: 22 }} /><div style={{ marginTop: 8 }}>Choose file</div></Upload.Dragger></Form.Item></Col>;
}
