import {
  AuditOutlined, BankOutlined, CreditCardOutlined, CustomerServiceOutlined, GiftOutlined, LockOutlined,
  PercentageOutlined, RollbackOutlined, SafetyOutlined, SettingOutlined, ShopOutlined, ShoppingOutlined, TagOutlined,
} from '@ant-design/icons';
import { App, Button, Card, Flex, Menu, Tag, Typography } from 'antd';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ApiError } from '@core/api/errors';
import ConfirmActionModal from '@ui/components/ConfirmActionModal';
import DateText from '@ui/components/DateText';
import ErrorState from '@ui/components/ErrorState';
import FullPageSpinner from '@ui/components/FullPageSpinner';
import PageHeader from '@ui/components/PageHeader';
import useBreakpoint from '@ui/hooks/useBreakpoint';
import SettingsSectionForm from '../components/SettingsSectionForm';
import { settingsApi, settingsKeys } from '../api/settings.api';

const SENSITIVE_IDS = ['fees', 'approvalThresholds', 'security'];
const LINE = '1px solid var(--ant-color-border-secondary)';

// What each section is for, so the list reads as a menu of areas rather than bare names.
const SECTION_INFO = {
  general: { icon: <SettingOutlined />, hint: 'Name, contact and legal details' },
  orders: { icon: <ShoppingOutlined />, hint: 'Timeouts, SLAs and limits' },
  returns: { icon: <RollbackOutlined />, hint: 'Return windows and refund timing' },
  fees: { icon: <PercentageOutlined />, hint: 'Platform, delivery and COD fees' },
  payments: { icon: <CreditCardOutlined />, hint: 'Payment methods and wallet use' },
  referral: { icon: <GiftOutlined />, hint: 'Refer & Earn rewards and rules' },
  tax: { icon: <TagOutlined />, hint: 'Invoice series and GST defaults' },
  sellerPolicies: { icon: <ShopOutlined />, hint: 'Rules for sellers' },
  settlement: { icon: <BankOutlined />, hint: 'Seller payouts and deductions' },
  approvalThresholds: { icon: <AuditOutlined />, hint: 'When a second admin must approve' },
  security: { icon: <SafetyOutlined />, hint: 'Sign-in and access controls' },
  support: { icon: <CustomerServiceOutlined />, hint: 'Support hours and chat' },
};

/** Platform settings (M17.5): ten independently saved, versioned sections; three route edits through maker-checker. */
export default function PlatformSettingsPage() {
  const { message } = App.useApp();
  const { isMobile } = useBreakpoint();
  const query = useQuery({ queryKey: settingsKeys.sections, queryFn: () => settingsApi.sections() });
  const [activeId, setActiveId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [confirming, setConfirming] = useState(false);

  // The For You header colour and image are edited on Home layout > Category tabs, so they are not listed here.
  const sections = (query.data?.data ?? []).filter((s) => s.id !== 'homeHeader');
  const active = sections.find((s) => s.id === activeId) ?? sections[0];

  useEffect(() => {
    if (active && draft === null) setDraft(active.values);
  }, [active, draft]);

  const save = useMutation({
    mutationFn: ({ sectionId, values, reason }) => settingsApi.updateSection(sectionId, { values, reason }),
    onSuccess: () => {
      query.refetch();
      setConfirming(false);
      message.success('Saved');
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : 'Could not save'),
  });

  const saveSensitive = useMutation({
    mutationFn: ({ sectionId, values, reason }) => settingsApi.updateSection(sectionId, { values, reason }),
    onSuccess: () => {
      query.refetch();
      setConfirming(false);
      message.success('Saved');
    },
    onError: (e) => {
      // Mock mode still routes sensitive sections through maker-checker (202).
      if (e instanceof ApiError && e.needsApproval) message.info('Sent for approval. The change applies once another admin agrees.');
      else message.error(e instanceof ApiError ? e.message : 'Could not save');
    },
  });

  if (query.isLoading) return <FullPageSpinner />;
  if (query.error) return <ErrorState error={query.error} onRetry={query.refetch} />;

  const dirty = active && JSON.stringify(draft) !== JSON.stringify(active.values);
  const sensitive = active && SENSITIVE_IDS.includes(active.id);

  return (
    <>
      <PageHeader
        title="Platform settings"
        breadcrumbs={[{ label: 'Administration' }, { label: 'Platform settings' }]}
        subtitle="Fees, approval thresholds and security changes need a reason and are audited; everything else saves immediately."
      />

      <Flex gap={24} vertical={isMobile} align="flex-start" style={{ marginTop: 16 }}>
        <Menu
          mode={isMobile ? 'horizontal' : 'vertical'}
          selectedKeys={active ? [active.id] : []}
          onClick={({ key }) => { setActiveId(key); setDraft(sections.find((s) => s.id === key)?.values ?? null); }}
          items={sections.map((s) => ({
            key: s.id,
            icon: SECTION_INFO[s.id]?.icon ?? <SettingOutlined />,
            label: isMobile ? s.label : (
              <Flex vertical style={{ lineHeight: 1.25, padding: '6px 0' }}>
                <span>{s.label}</span>
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>{SECTION_INFO[s.id]?.hint}</Typography.Text>
              </Flex>
            ),
            // a flex row keeps the icon beside the two-line label instead of above it
            style: isMobile ? undefined : { height: 'auto', lineHeight: 'normal', margin: '2px 0', display: 'flex', alignItems: 'center' },
          }))}
          style={
            isMobile
              ? { width: '100%', overflowX: 'auto', borderInlineEnd: 'none', borderBottom: LINE }
              : { width: 270, flexShrink: 0, borderInlineEnd: 'none', background: 'transparent' }
          }
        />

        {active && draft && (
          <Card style={{ flex: 1, minWidth: 0, width: '100%' }} styles={{ body: { padding: 0 } }}>
            <Flex justify="space-between" align="flex-start" gap={12} wrap style={{ padding: '20px 24px', borderBottom: LINE }}>
              <Flex vertical gap={2}>
                <Flex gap={8} align="center">
                  <Typography.Title level={4} style={{ margin: 0 }}>{active.label}</Typography.Title>
                  {sensitive && <Tag icon={<LockOutlined />} color="gold" style={{ marginInlineEnd: 0 }}>Needs a reason</Tag>}
                </Flex>
                <Typography.Text type="secondary">{SECTION_INFO[active.id]?.hint}</Typography.Text>
              </Flex>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Last updated <DateText value={active.updatedAt} /> by {active.updatedByName}
              </Typography.Text>
            </Flex>

            <div style={{ padding: '4px 24px' }}>
              <SettingsSectionForm values={draft} onChange={setDraft} disabled={save.isPending} />
            </div>

            <Flex
              justify="space-between" align="center" gap={12} wrap
              style={{ padding: '12px 24px', borderTop: LINE, position: 'sticky', bottom: 0, background: 'var(--ant-color-bg-container)', borderRadius: '0 0 8px 8px' }}
            >
              <Typography.Text type={dirty ? 'warning' : 'secondary'} style={{ fontSize: 12 }}>
                {dirty ? 'You have unsaved changes' : 'All changes saved'}
              </Typography.Text>
              <Flex gap={8}>
                <Button disabled={!dirty || save.isPending} onClick={() => setDraft(active.values)}>Discard</Button>
                <Button
                  type="primary" disabled={!dirty} loading={save.isPending}
                  onClick={() => (sensitive ? setConfirming(true) : save.mutate({ sectionId: active.id, values: draft }))}
                >
                  Save changes
                </Button>
              </Flex>
            </Flex>
          </Card>
        )}
      </Flex>

      <ConfirmActionModal
        open={confirming}
        onCancel={() => setConfirming(false)}
        onConfirm={(v) => saveSensitive.mutate({ sectionId: active.id, values: draft, reason: v.reason })}
        loading={saveSensitive.isPending}
        title={`Change ${active?.label}`}
        impact="This section affects every order or seller on the platform the moment you save."
        reasonRequired
        reasonLabel="Why is this changing?"
        showNote={false}
        confirmLabel="Save changes"
      />
    </>
  );
}
