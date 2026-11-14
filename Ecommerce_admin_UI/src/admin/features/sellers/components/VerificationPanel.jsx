import { CheckCircleFilled, CloseCircleFilled } from '@ant-design/icons';
import { App, Button, Card, Descriptions, Flex, Popconfirm, Space, Tag, Typography } from 'antd';
import { useMutation } from '@tanstack/react-query';
import { queryClient } from '@core/api/queryClient';
import MaskedValue from '@ui/components/MaskedValue';
import { sellerKeys, sellersApi } from '../api/sellers.api';

function ResultIcon({ ok }) {
  return ok ? (
    <CheckCircleFilled style={{ color: 'var(--ant-color-success)' }} />
  ) : (
    <CloseCircleFilled style={{ color: 'var(--ant-color-error)' }} />
  );
}

/** The verify/unverify control for one field, backed by `POST /sellers/:id/verify`. */
function VerifyButton({ sellerId, field, ok }) {
  const { message } = App.useApp();
  const mutation = useMutation({
    mutationFn: (nextOk) => sellersApi.verify(sellerId, field, nextOk),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sellerKeys.detail(sellerId) });
      queryClient.invalidateQueries({ queryKey: sellerKeys.all });
    },
    onError: (e) => message.error(e.message),
  });

  if (ok) {
    return (
      <Popconfirm title="Unmark as verified?" onConfirm={() => mutation.mutate(false)}>
        <Button size="small" loading={mutation.isPending}>
          Unmark verified
        </Button>
      </Popconfirm>
    );
  }
  return (
    <Button size="small" type="primary" loading={mutation.isPending} onClick={() => mutation.mutate(true)}>
      Mark verified
    </Button>
  );
}

/**
 * Manual KYC check.
 *
 * Arise has no GSTIN/PAN/bank verification integration, so a reviewer checks
 * each value against the uploaded documents (and, for the bank account, that
 * the holder name matches the business) and marks it verified by hand. This
 * is a judgement call recorded by a person, not an automated result.
 */
export default function VerificationPanel({ seller, bank }) {
  return (
    <Flex vertical gap={12}>
      <Card
        size="small"
        title={<Space><ResultIcon ok={seller.gstinOk} />GSTIN</Space>}
        extra={<VerifyButton sellerId={seller.id} field="gstin" ok={seller.gstinOk} />}
      >
        <Descriptions column={1} size="small">
          <Descriptions.Item label="GSTIN">
            <Typography.Text className="mono">{seller.gstin ?? '—'}</Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag color={seller.gstinOk ? 'green' : 'default'} style={{ marginInlineEnd: 0 }}>
              {seller.gstinOk ? 'Verified' : 'Not verified'}
            </Tag>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card
        size="small"
        title={<Space><ResultIcon ok={seller.panOk} />PAN</Space>}
        extra={<VerifyButton sellerId={seller.id} field="pan" ok={seller.panOk} />}
      >
        <Descriptions column={1} size="small">
          <Descriptions.Item label="PAN">
            <MaskedValue value={seller.pan} kind="pan" entityType="seller" entityId={seller.id} />
          </Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag color={seller.panOk ? 'green' : 'default'} style={{ marginInlineEnd: 0 }}>
              {seller.panOk ? 'Verified' : 'Not verified'}
            </Tag>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card
        size="small"
        title={<Space><ResultIcon ok={Boolean(bank) && seller.bankOk} />Bank account</Space>}
        extra={bank && <VerifyButton sellerId={seller.id} field="bank" ok={seller.bankOk} />}
      >
        {bank ? (
          <Descriptions column={1} size="small">
            <Descriptions.Item label="Holder">{bank.accountHolder}</Descriptions.Item>
            <Descriptions.Item label="Account number">
              <MaskedValue
                value={bank.accountNumber}
                kind="account"
                entityType="seller"
                entityId={seller.id}
                entityLabel={seller.storeName}
              />
            </Descriptions.Item>
            <Descriptions.Item label="IFSC">
              <Typography.Text className="mono">{bank.ifsc}</Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={seller.bankOk ? 'green' : 'default'} style={{ marginInlineEnd: 0 }}>
                {seller.bankOk ? 'Verified' : 'Not verified'}
              </Tag>
            </Descriptions.Item>
          </Descriptions>
        ) : (
          <Typography.Text type="secondary">No bank account on file yet.</Typography.Text>
        )}
      </Card>
    </Flex>
  );
}
