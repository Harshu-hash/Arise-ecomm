/* eslint-disable max-lines */
import { CheckCircleOutlined } from '@ant-design/icons';
import { Alert, App, Button, Card, Checkbox, Flex, Form, Input, Result, Select, Space, Steps, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authApi } from '@core/auth/authApi';
import { useSessionStore } from '@core/auth/sessionStore';
import DocumentUpload from '@ui/components/DocumentUpload';
import ErrorState from '@ui/components/ErrorState';
import FullPageSpinner from '@ui/components/FullPageSpinner';
import { SELLER_ACCENT } from '@seller/theme';
import { onboardingApi, onboardingKeys } from '../api/onboarding.api';

const STEPS = [
  { key: 'business', title: 'Business' }, { key: 'tax', title: 'Registrations' },
  { key: 'signatory', title: 'Signatory' }, { key: 'bank', title: 'Bank' },
  { key: 'pickup', title: 'Pickup' }, { key: 'agreement', title: 'Agreement' },
  { key: 'review', title: 'Review' },
];

const TYPE_LABELS = {
  GST_CERTIFICATE: 'GST registration certificate', PAN_CARD: 'PAN card',
  SIGNATORY_ID: 'Authorized signatory identity proof', CANCELLED_CHEQUE: 'Cancelled cheque',
  ADDRESS_PROOF: 'Pickup address proof', CATEGORY_LICENSE: 'Category registration or licence',
};

export default function OnboardingPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const patchUser = useSessionStore((state) => state.patchUser);
  const [current, setCurrent] = useState(0);
  const [saving, setSaving] = useState(false);
  const [documents, setDocuments] = useState({});
  const [pincodeResult, setPincodeResult] = useState(null);
  const [form] = Form.useForm();
  const query = useQuery({ queryKey: onboardingKeys.current, queryFn: onboardingApi.get });
  const agreementQuery = useQuery({ queryKey: onboardingKeys.agreement, queryFn: onboardingApi.agreement, enabled: current === 5 });
  const data = query.data;

  useEffect(() => {
    if (!data?.documents) return;
    setDocuments(Object.fromEntries(data.documents.map((document) => [document.type, document])));
  }, [data?.documents]);

  const initialValues = useMemo(() => ({
    storeName: data?.business?.storeName, legalName: data?.business?.legalName,
    businessType: data?.business?.businessType, registeredAddress: data?.business?.registeredAddress,
    category: data?.business?.category, gstin: data?.tax?.gstin, pan: data?.tax?.pan,
    registrationNumber: data?.tax?.registrationNumber,
    signatoryName: data?.signatory?.name, signatoryEmail: data?.signatory?.email,
    signatoryPhone: data?.signatory?.phone, contactVerified: data?.signatory?.contactVerified,
    accountName: data?.bank?.accountName, accountNumber: data?.bank?.accountNumber,
    ifsc: data?.bank?.ifsc, bankName: data?.bank?.bankName,
    line1: data?.pickup?.line1, line2: data?.pickup?.line2, city: data?.pickup?.city,
    state: data?.pickup?.state, pincode: data?.pickup?.pincode,
    agree: Boolean(data?.agreementAcceptedAt),
  }), [data]);

  if (query.isLoading) return <FullPageSpinner label="Loading onboarding…" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />;
  if (['UNDER_REVIEW', 'CLARIFICATION_REQUIRED', 'REJECTED'].includes(data?.status)) {
    return <div style={{ maxWidth: 680, margin: '40px auto', padding: '0 16px' }}><Result
      status={data.status === 'UNDER_REVIEW' ? 'success' : 'warning'}
      title={data.status === 'UNDER_REVIEW' ? 'Application submitted' : 'Your application needs attention'}
      subTitle={data.status === 'UNDER_REVIEW' ? 'Your application is read-only while our onboarding team reviews it.' : 'Open the status page for the exact reason and resubmit only the affected section.'}
      extra={<Button type="primary" onClick={() => navigate('/onboarding/status')}>View application status</Button>}
    /></div>;
  }

  const documentValue = (type) => documents[type] ? [documents[type]] : [];
  const setDocument = (type, value) => setDocuments((currentDocs) => ({ ...currentDocs, [type]: value?.[0] ?? null }));
  const requireDocuments = (types) => {
    const missing = types.filter((type) => !documents[type]);
    if (missing.length) throw new Error(`Upload ${missing.map((type) => TYPE_LABELS[type]).join(' and ')}.`);
  };
  const persist = async (payload) => {
    const saved = await onboardingApi.save({ ...payload, sectionKey: STEPS[current].key, step: Math.max(data?.step ?? 0, current) });
    queryClient.setQueryData(onboardingKeys.current, saved);
  };

  const next = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const key = STEPS[current].key;
      if (key === 'tax') requireDocuments(['GST_CERTIFICATE', 'PAN_CARD']);
      if (key === 'signatory') requireDocuments(['SIGNATORY_ID']);
      if (key === 'bank') requireDocuments(['CANCELLED_CHEQUE']);
      if (key === 'pickup') requireDocuments(['ADDRESS_PROOF']);
      let payload = {};
      if (key === 'business') payload = { business: { storeName: values.storeName, legalName: values.legalName, businessType: values.businessType, registeredAddress: values.registeredAddress, category: values.category } };
      if (key === 'tax') payload = { tax: { gstin: values.gstin.toUpperCase(), pan: values.pan.toUpperCase(), registrationNumber: values.registrationNumber }, documents: { GST_CERTIFICATE: documents.GST_CERTIFICATE, PAN_CARD: documents.PAN_CARD, ...(documents.CATEGORY_LICENSE ? { CATEGORY_LICENSE: documents.CATEGORY_LICENSE } : {}) } };
      if (key === 'signatory') payload = { signatory: { name: values.signatoryName, email: values.signatoryEmail, phone: values.signatoryPhone, contactVerified: values.contactVerified === true }, documents: { SIGNATORY_ID: documents.SIGNATORY_ID } };
      if (key === 'bank') payload = { bank: { accountName: values.accountName, accountNumber: values.accountNumber, ifsc: values.ifsc.toUpperCase(), bankName: values.bankName }, documents: { CANCELLED_CHEQUE: documents.CANCELLED_CHEQUE } };
      if (key === 'pickup') {
        const serviceability = await onboardingApi.checkPincode(values.pincode);
        setPincodeResult(serviceability);
        if (!serviceability.serviceable) throw new Error(serviceability.message);
        payload = { pickup: { line1: values.line1, line2: values.line2, city: values.city, state: values.state, pincode: values.pincode, serviceable: true }, documents: { ADDRESS_PROOF: documents.ADDRESS_PROOF } };
      }
      if (key === 'agreement') {
        const acceptance = await onboardingApi.acceptAgreement(agreementQuery.data.version);
        payload = { agreementAccepted: true, agreementReceipt: acceptance.receiptNumber };
      }
      await persist(payload);
      setCurrent((step) => Math.min(step + 1, STEPS.length - 1));
    } catch (error) {
      if (!error?.errorFields) message.error(error?.message ?? 'Could not save. Please try again.');
    } finally { setSaving(false); }
  };

  const submit = async () => {
    setSaving(true);
    try {
      await onboardingApi.submit();
      await queryClient.invalidateQueries({ queryKey: onboardingKeys.current });
      try { patchUser(await authApi.me()); } catch { /* status page can refresh the session */ }
      message.success('Application submitted for review.');
      navigate('/onboarding/status');
    } catch (error) { message.error(error?.message ?? 'Could not submit. Check the earlier sections.'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ maxWidth: 880, margin: '24px auto', padding: '0 16px' }}>
      <Flex align="center" gap={10} style={{ marginBottom: 20 }}><div aria-hidden style={{ width: 30, height: 30, borderRadius: 8, background: `linear-gradient(135deg, ${SELLER_ACCENT}, #7C3AED)`, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700 }}>A</div><div><Typography.Title level={4} style={{ margin: 0 }}>Set up your Arise store</Typography.Title><Typography.Text type="secondary">Your progress is saved section by section.</Typography.Text></div></Flex>
      <Steps current={current} size="small" responsive items={STEPS.map((step) => ({ title: step.title }))} style={{ marginBottom: 24 }} onChange={(step) => step <= (data?.step ?? 0) && setCurrent(step)} />
      <Card>
        <Form form={form} layout="vertical" requiredMark={false} initialValues={initialValues} key={`${current}-${data?.updatedAt}`}>
          {current === 0 && <BusinessFields />}
          {current === 1 && <><TaxFields /><DocumentField type="GST_CERTIFICATE" value={documentValue('GST_CERTIFICATE')} onChange={(value) => setDocument('GST_CERTIFICATE', value)} /><DocumentField type="PAN_CARD" value={documentValue('PAN_CARD')} onChange={(value) => setDocument('PAN_CARD', value)} /><DocumentField type="CATEGORY_LICENSE" required={false} value={documentValue('CATEGORY_LICENSE')} onChange={(value) => setDocument('CATEGORY_LICENSE', value)} /></>}
          {current === 2 && <><SignatoryFields /><DocumentField type="SIGNATORY_ID" value={documentValue('SIGNATORY_ID')} onChange={(value) => setDocument('SIGNATORY_ID', value)} /></>}
          {current === 3 && <><BankFields /><DocumentField type="CANCELLED_CHEQUE" value={documentValue('CANCELLED_CHEQUE')} onChange={(value) => setDocument('CANCELLED_CHEQUE', value)} /></>}
          {current === 4 && <><PickupFields />{pincodeResult && <Alert type={pincodeResult.serviceable ? 'success' : 'error'} showIcon message={pincodeResult.message} style={{ marginBottom: 16 }} />}<DocumentField type="ADDRESS_PROOF" value={documentValue('ADDRESS_PROOF')} onChange={(value) => setDocument('ADDRESS_PROOF', value)} /></>}
          {current === 5 && <AgreementFields agreement={agreementQuery.data} loading={agreementQuery.isLoading} />}
          {current === 6 && <Review data={data} documents={documents} />}
        </Form>
        <Flex justify="space-between" style={{ marginTop: 20 }}><Button disabled={current === 0 || saving} onClick={() => setCurrent((step) => Math.max(0, step - 1))}>Back</Button>{current < STEPS.length - 1 ? <Button type="primary" loading={saving} onClick={next}>Save & continue</Button> : <Button type="primary" loading={saving} onClick={submit}>Submit for review</Button>}</Flex>
      </Card>
    </div>
  );
}

function BusinessFields() { return <><Form.Item name="storeName" label="Public store name" rules={[{ required: true }]}><Input size="large" /></Form.Item><Form.Item name="legalName" label="Registered legal name" rules={[{ required: true }]}><Input size="large" /></Form.Item><Form.Item name="businessType" label="Business type" rules={[{ required: true }]}><Select size="large" options={['Proprietorship', 'Partnership', 'Private Limited', 'LLP', 'Public Limited'].map((value) => ({ value, label: value }))} /></Form.Item><Form.Item name="registeredAddress" label="Registered address" rules={[{ required: true }]}><Input.TextArea rows={3} /></Form.Item><Form.Item name="category" label="Primary category" rules={[{ required: true }]}><Select size="large" options={['Fashion', 'Electronics', 'Home & Kitchen', 'Beauty', 'Grocery', 'Sports', 'Books'].map((value) => ({ value, label: value }))} /></Form.Item></>; }
function TaxFields() { return <><Form.Item name="gstin" label="GSTIN" rules={[{ required: true }, { pattern: /^[0-9A-Z]{15}$/, message: 'Enter a valid 15-character GSTIN.' }]}><Input size="large" maxLength={15} /></Form.Item><Form.Item name="pan" label="PAN" rules={[{ required: true }, { pattern: /^[A-Z]{5}[0-9]{4}[A-Z]$/, message: 'Enter a valid PAN.' }]}><Input size="large" maxLength={10} /></Form.Item><Form.Item name="registrationNumber" label="Category registration number (when applicable)"><Input /></Form.Item></>; }
function SignatoryFields() { return <><Form.Item name="signatoryName" label="Authorized signatory" rules={[{ required: true }]}><Input size="large" /></Form.Item><Form.Item name="signatoryEmail" label="Verified email" rules={[{ required: true }, { type: 'email' }]}><Input size="large" /></Form.Item><Form.Item name="signatoryPhone" label="Verified mobile" rules={[{ required: true }, { pattern: /^\+?[0-9 ]{10,15}$/ }]}><Input size="large" /></Form.Item><Form.Item name="contactVerified" valuePropName="checked" rules={[{ validator: (_, value) => value ? Promise.resolve() : Promise.reject(new Error('Confirm contact verification.')) }]}><Checkbox>I confirm the email and mobile verification codes were completed.</Checkbox></Form.Item></>; }
function BankFields() { return <><Form.Item name="accountName" label="Account holder name" rules={[{ required: true }]}><Input size="large" /></Form.Item><Form.Item name="accountNumber" label="Account number" rules={[{ required: true }]}><Input size="large" /></Form.Item><Form.Item name="ifsc" label="IFSC" rules={[{ required: true }, { pattern: /^[A-Z]{4}0[A-Z0-9]{6}$/, message: 'Enter a valid IFSC.' }]}><Input size="large" maxLength={11} /></Form.Item><Form.Item name="bankName" label="Bank name" rules={[{ required: true }]}><Input size="large" /></Form.Item></>; }
function PickupFields() { return <><Form.Item name="line1" label="Pickup address" rules={[{ required: true }]}><Input.TextArea rows={2} /></Form.Item><Form.Item name="line2" label="Address line 2"><Input /></Form.Item><Flex gap={12} wrap><Form.Item name="city" label="City" rules={[{ required: true }]} style={{ flex: 1 }}><Input /></Form.Item><Form.Item name="state" label="State" rules={[{ required: true }]} style={{ flex: 1 }}><Input /></Form.Item><Form.Item name="pincode" label="PIN code" rules={[{ required: true }, { pattern: /^\d{6}$/ }]} style={{ flex: 1 }}><Input maxLength={6} /></Form.Item></Flex></>; }
function DocumentField({ type, value, onChange, required = true }) { return <Form.Item label={`${TYPE_LABELS[type]}${required ? '' : ' (optional)'}`} required={required}><DocumentUpload value={value} onChange={onChange} maxCount={1} label={TYPE_LABELS[type]} /></Form.Item>; }
function AgreementFields({ agreement, loading }) { if (loading || !agreement) return <FullPageSpinner label="Loading agreement…" />; return <><Alert type="info" showIcon message={`${agreement.title} · version ${agreement.version}`} description={`Effective ${new Date(agreement.effectiveAt).toLocaleDateString('en-IN')}`} style={{ marginBottom: 12 }} /><nav aria-label="Agreement sections"><Space wrap>{agreement.sections.map((section) => <a key={section.id} href={`#${section.id}`}>{section.title}</a>)}</Space></nav><div style={{ maxHeight: 320, overflow: 'auto', marginBlock: 16, padding: 16, border: '1px solid var(--ant-color-border)', borderRadius: 8 }}>{agreement.sections.map((section) => <section key={section.id} id={section.id}><Typography.Title level={5}>{section.title}</Typography.Title><Typography.Paragraph>{section.text}</Typography.Paragraph></section>)}</div><Form.Item name="agree" valuePropName="checked" rules={[{ validator: (_, value) => value ? Promise.resolve() : Promise.reject(new Error('Accept the agreement to continue.')) }]}><Checkbox>I have reviewed and accept this version of the seller agreement.</Checkbox></Form.Item></>; }
function Review({ data, documents }) { return <Space direction="vertical" style={{ width: '100%' }}><Typography.Text type="secondary">Review the application. Submission locks every section until a reviewer asks for a correction.</Typography.Text><ReviewRow label="Public store" value={data.business?.storeName} /><ReviewRow label="Legal entity" value={data.business?.legalName} /><ReviewRow label="GSTIN / PAN" value={`${data.tax?.gstin} / ${data.tax?.pan}`} /><ReviewRow label="Authorized signatory" value={data.signatory?.name} /><ReviewRow label="Bank account" value={data.bank?.accountNumber} /><ReviewRow label="Pickup" value={`${data.pickup?.line1}, ${data.pickup?.city}`} /><ReviewRow label="Documents" value={`${Object.values(documents).filter(Boolean).length} uploaded`} /><ReviewRow label="Agreement" value={data.agreementAcceptance ? `Accepted · ${data.agreementAcceptance.receiptNumber}` : 'Not accepted'} icon={Boolean(data.agreementAcceptance)} /></Space>; }
function ReviewRow({ label, value, icon }) { return <Flex justify="space-between" gap={16} style={{ borderBottom: '1px solid var(--ant-color-border-secondary)', padding: '7px 0' }}><Typography.Text type="secondary">{label}</Typography.Text><Typography.Text strong style={{ textAlign: 'right' }}>{icon && <CheckCircleOutlined style={{ color: 'var(--ant-color-success)', marginRight: 6 }} />}{value || '—'}</Typography.Text></Flex>; }
