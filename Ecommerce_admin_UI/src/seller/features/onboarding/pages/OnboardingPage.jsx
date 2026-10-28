import { CheckCircleOutlined } from '@ant-design/icons';
import { App, Button, Card, Checkbox, Flex, Form, Input, Result, Select, Space, Steps, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authApi } from '@core/auth/authApi';
import { useSessionStore } from '@core/auth/sessionStore';
import FullPageSpinner from '@ui/components/FullPageSpinner';
import ErrorState from '@ui/components/ErrorState';
import { SELLER_ACCENT } from '@seller/theme';
import { onboardingApi, onboardingKeys } from '../api/onboarding.api';

const STEPS = [
  { key: 'business', title: 'Business' },
  { key: 'tax', title: 'GST & PAN' },
  { key: 'bank', title: 'Bank' },
  { key: 'pickup', title: 'Pickup' },
  { key: 'agreement', title: 'Agreement' },
  { key: 'review', title: 'Review' },
];

export default function OnboardingPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const patchUser = useSessionStore((s) => s.patchUser);
  const [current, setCurrent] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: onboardingKeys.current,
    queryFn: onboardingApi.get,
  });

  const initialValues = useMemo(
    () => ({
      storeName: data?.business?.storeName,
      legalName: data?.business?.legalName,
      category: data?.business?.category,
      gstin: data?.tax?.gstin,
      pan: data?.tax?.pan,
      accountName: data?.bank?.accountName,
      accountNumber: data?.bank?.accountNumber,
      ifsc: data?.bank?.ifsc,
      line1: data?.pickup?.line1,
      city: data?.pickup?.city,
      state: data?.pickup?.state,
      pincode: data?.pickup?.pincode,
      agree: Boolean(data?.agreementAcceptedAt),
    }),
    [data],
  );

  if (isLoading) return <FullPageSpinner label="Loading onboarding…" />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;

  if (data?.status === 'UNDER_REVIEW') {
    return (
      <div style={{ maxWidth: 640, margin: '40px auto', padding: '0 16px' }}>
        <Result
          status="success"
          title="Application submitted"
          subTitle="Your seller application is under review. We'll email you once it's approved — usually within 1–2 business days."
          extra={
            <Button onClick={() => navigate('/account')} type="default">
              View my account
            </Button>
          }
        />
      </div>
    );
  }

  const persist = async (patchForStep) => {
    const saved = await onboardingApi.save({ ...patchForStep, step: Math.max(data?.step ?? 0, current) });
    queryClient.setQueryData(onboardingKeys.current, saved);
    return saved;
  };

  const next = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const stepKey = STEPS[current].key;
      const patchByStep = {
        business: { business: { storeName: values.storeName, legalName: values.legalName, category: values.category } },
        tax: { tax: { gstin: values.gstin, pan: values.pan } },
        bank: { bank: { accountName: values.accountName, accountNumber: values.accountNumber, ifsc: values.ifsc } },
        pickup: { pickup: { line1: values.line1, city: values.city, state: values.state, pincode: values.pincode } },
        agreement: { agreementAccepted: values.agree === true },
        review: {},
      };
      await persist(patchByStep[stepKey]);
      setCurrent((c) => Math.min(c + 1, STEPS.length - 1));
    } catch (e) {
      if (e?.errorFields) return; // validation handled inline
      message.error('Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    setSaving(true);
    try {
      await onboardingApi.submit();
      await queryClient.invalidateQueries({ queryKey: onboardingKeys.current });
      // Keep the session's account status fresh.
      try {
        const me = await authApi.me();
        patchUser(me);
      } catch {
        /* non-fatal */
      }
      message.success('Application submitted for review.');
      refetch();
    } catch (e) {
      message.error(e?.message ?? 'Could not submit. Check the earlier steps.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 760, margin: '24px auto', padding: '0 16px' }}>
      <Flex align="center" gap={10} style={{ marginBottom: 20 }}>
        <div aria-hidden style={{ width: 30, height: 30, borderRadius: 8, background: `linear-gradient(135deg, ${SELLER_ACCENT}, #7C3AED)`, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700 }}>
          A
        </div>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            Set up your Arise store
          </Typography.Title>
          <Typography.Text type="secondary">Finish these steps to start selling.</Typography.Text>
        </div>
      </Flex>

      <Steps current={current} size="small" responsive items={STEPS.map((s) => ({ title: s.title }))} style={{ marginBottom: 24 }} />

      <Card>
        <Form form={form} layout="vertical" requiredMark={false} initialValues={initialValues} key={current}>
          {current === 0 && (
            <>
              <Form.Item name="storeName" label="Store name" rules={[{ required: true, message: 'Enter your store name.' }]}>
                <Input size="large" placeholder="e.g. Nova Essentials" />
              </Form.Item>
              <Form.Item name="legalName" label="Legal entity name" rules={[{ required: true, message: 'Enter the registered business name.' }]}>
                <Input size="large" placeholder="Registered company name" />
              </Form.Item>
              <Form.Item name="category" label="Primary category" rules={[{ required: true, message: 'Pick your main category.' }]}>
                <Select
                  size="large"
                  placeholder="Select a category"
                  options={['Fashion', 'Electronics', 'Home & Kitchen', 'Beauty', 'Grocery', 'Sports', 'Books'].map((c) => ({ value: c, label: c }))}
                />
              </Form.Item>
            </>
          )}

          {current === 1 && (
            <>
              <Form.Item name="gstin" label="GSTIN" rules={[{ required: true, message: 'Enter your 15-character GSTIN.' }, { len: 15, message: 'GSTIN is 15 characters.' }]}>
                <Input size="large" placeholder="22AAAAA0000A1Z5" maxLength={15} />
              </Form.Item>
              <Form.Item name="pan" label="PAN" rules={[{ required: true, message: 'Enter your PAN.' }, { len: 10, message: 'PAN is 10 characters.' }]}>
                <Input size="large" placeholder="AAAAA0000A" maxLength={10} />
              </Form.Item>
            </>
          )}

          {current === 2 && (
            <>
              <Form.Item name="accountName" label="Account holder name" rules={[{ required: true, message: 'Enter the account holder name.' }]}>
                <Input size="large" />
              </Form.Item>
              <Form.Item name="accountNumber" label="Account number" rules={[{ required: true, message: 'Enter your account number.' }]}>
                <Input size="large" />
              </Form.Item>
              <Form.Item name="ifsc" label="IFSC code" rules={[{ required: true, message: 'Enter the IFSC code.' }, { len: 11, message: 'IFSC is 11 characters.' }]}>
                <Input size="large" placeholder="HDFC0001234" maxLength={11} />
              </Form.Item>
            </>
          )}

          {current === 3 && (
            <>
              <Form.Item name="line1" label="Pickup address" rules={[{ required: true, message: 'Enter the pickup address.' }]}>
                <Input.TextArea rows={2} />
              </Form.Item>
              <Flex gap={12} wrap>
                <Form.Item name="city" label="City" rules={[{ required: true, message: 'City?' }]} style={{ flex: 1, minWidth: 160 }}>
                  <Input size="large" />
                </Form.Item>
                <Form.Item name="state" label="State" rules={[{ required: true, message: 'State?' }]} style={{ flex: 1, minWidth: 160 }}>
                  <Input size="large" />
                </Form.Item>
                <Form.Item name="pincode" label="PIN code" rules={[{ required: true, message: 'PIN?' }, { len: 6, message: '6 digits.' }]} style={{ flex: 1, minWidth: 140 }}>
                  <Input size="large" maxLength={6} />
                </Form.Item>
              </Flex>
            </>
          )}

          {current === 4 && (
            <Form.Item
              name="agree"
              valuePropName="checked"
              rules={[{ validator: (_, v) => (v ? Promise.resolve() : Promise.reject(new Error('You must accept the agreement to continue.'))) }]}
            >
              <Checkbox>
                I agree to the Arise Seller Agreement, commission schedule and shipping policies.
              </Checkbox>
            </Form.Item>
          )}

          {current === 5 && (
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Typography.Text type="secondary">Review your details, then submit for approval.</Typography.Text>
              <ReviewRow label="Store" value={data?.business?.storeName} />
              <ReviewRow label="Legal name" value={data?.business?.legalName} />
              <ReviewRow label="Category" value={data?.business?.category} />
              <ReviewRow label="GSTIN" value={data?.tax?.gstin} />
              <ReviewRow label="PAN" value={data?.tax?.pan} />
              <ReviewRow label="Bank a/c" value={data?.bank?.accountNumber} />
              <ReviewRow label="Pickup" value={data?.pickup?.line1 && `${data.pickup.line1}, ${data.pickup.city}`} />
              <ReviewRow label="Agreement" value={data?.agreementAcceptedAt ? 'Accepted' : 'Not accepted'} icon={data?.agreementAcceptedAt} />
            </Space>
          )}
        </Form>

        <Flex justify="space-between" style={{ marginTop: 20 }}>
          <Button disabled={current === 0 || saving} onClick={() => setCurrent((c) => Math.max(0, c - 1))}>
            Back
          </Button>
          {current < STEPS.length - 1 ? (
            <Button type="primary" loading={saving} onClick={next}>
              Save & continue
            </Button>
          ) : (
            <Button type="primary" loading={saving} onClick={submit}>
              Submit for review
            </Button>
          )}
        </Flex>
      </Card>
    </div>
  );
}

function ReviewRow({ label, value, icon }) {
  return (
    <Flex justify="space-between" style={{ borderBottom: '1px solid var(--ant-color-border-secondary)', padding: '6px 0' }}>
      <Typography.Text type="secondary">{label}</Typography.Text>
      <Typography.Text strong>
        {icon ? <CheckCircleOutlined style={{ color: 'var(--ant-color-success)', marginRight: 6 }} /> : null}
        {value || '—'}
      </Typography.Text>
    </Flex>
  );
}
