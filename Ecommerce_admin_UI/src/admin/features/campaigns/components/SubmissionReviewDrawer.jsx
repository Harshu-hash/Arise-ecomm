import { CheckOutlined, CloseOutlined, EditOutlined } from '@ant-design/icons';
import { Alert, Button, Descriptions, Drawer, Flex, Space, Tag, Typography } from 'antd';
import { useState } from 'react';
import ActionReasonModal from '@ui/components/ActionReasonModal';
import DateText from '@ui/components/DateText';
import MoneyText from '@ui/components/MoneyText';
import StatusTag from '@ui/components/StatusTag';

const REJECT_REASONS = [
  { value: 'DISCOUNT_TOO_LOW', label: 'Discount below campaign minimum' },
  { value: 'IMAGE_QUALITY', label: 'Image quality / background issue' },
  { value: 'PRICE_INFLATED', label: 'MRP appears inflated' },
  { value: 'LOW_STOCK', label: 'Insufficient stock committed' },
  { value: 'POLICY', label: 'Violates campaign policy' },
  { value: 'OTHER', label: 'Other (explain in notes)' },
];

/**
 * Admin reviews one seller product entry. Approving it is what makes the
 * product appear in the campaign's section of the customer app.
 */
export default function SubmissionReviewDrawer({ open, submission, campaign, onClose, onDecide, loading }) {
  const [reasonModal, setReasonModal] = useState(null); // 'reject' | 'changes' | null

  if (!submission) return <Drawer open={open} onClose={onClose} width={480} />;

  const belowFloor = campaign && submission.discountPct < campaign.minDiscountPct;
  const pending = submission.status === 'PENDING';

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        width={480}
        title="Review product entry"
        extra={<StatusTag domain="campaignSubmission" code={submission.status} />}
        footer={
          pending ? (
            <Flex gap={8} justify="flex-end">
              <Button icon={<CloseOutlined />} danger onClick={() => setReasonModal('reject')} disabled={loading}>
                Reject
              </Button>
              <Button icon={<EditOutlined />} onClick={() => setReasonModal('changes')} disabled={loading}>
                Request changes
              </Button>
              <Button
                type="primary"
                icon={<CheckOutlined />}
                loading={loading}
                onClick={() => onDecide(submission, 'approve')}
              >
                Approve
              </Button>
            </Flex>
          ) : null
        }
      >
        <Flex vertical gap={16}>
          <div>
            <Typography.Text strong style={{ fontSize: 15 }}>{submission.productTitle}</Typography.Text>
            <div>
              <Typography.Text type="secondary">{submission.brand}</Typography.Text>
            </div>
          </div>

          {belowFloor && pending && (
            <Alert
              type="warning"
              showIcon
              message="Below the campaign discount floor"
              description={`This campaign requires at least ${campaign.minDiscountPct}% off. This entry offers ${submission.discountPct}%.`}
            />
          )}

          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Seller">{submission.sellerName}</Descriptions.Item>
            <Descriptions.Item label="MRP"><MoneyText paise={submission.mrpPaise} /></Descriptions.Item>
            <Descriptions.Item label="Campaign price">
              <Space size={8}>
                <MoneyText paise={submission.dealPricePaise} strong />
                <Tag color={belowFloor ? 'red' : 'green'} style={{ marginInlineEnd: 0 }}>
                  {submission.discountPct}% off
                </Tag>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="Stock committed">{submission.stockCommitted} units</Descriptions.Item>
            <Descriptions.Item label="Submitted"><DateText value={submission.submittedAt} /></Descriptions.Item>
            {submission.reviewedAt && (
              <Descriptions.Item label="Reviewed">
                <DateText value={submission.reviewedAt} /> · {submission.reviewer}
              </Descriptions.Item>
            )}
          </Descriptions>

          {submission.rejectionReason && (
            <Alert
              type={submission.status === 'REJECTED' ? 'error' : 'info'}
              showIcon
              message={submission.status === 'REJECTED' ? 'Rejection reason' : 'Change requested'}
              description={submission.rejectionReason}
            />
          )}

          {submission.status === 'APPROVED' && (
            <Alert
              type="success"
              showIcon
              message="Live in the customer app"
              description={`Showing in ${campaign ? campaign.name : 'this campaign'}.`}
            />
          )}
        </Flex>
      </Drawer>

      <ActionReasonModal
        open={reasonModal === 'reject'}
        title="Reject this entry"
        okText="Reject entry"
        reasonCodes={REJECT_REASONS}
        loading={loading}
        onCancel={() => setReasonModal(null)}
        onConfirm={({ reasonCode, notes }) => {
          onDecide(submission, 'reject', notes || REJECT_REASONS.find((r) => r.value === reasonCode)?.label);
          setReasonModal(null);
        }}
      />

      <ActionReasonModal
        open={reasonModal === 'changes'}
        title="Request changes"
        okText="Send back to seller"
        reasonCodes={REJECT_REASONS}
        loading={loading}
        onCancel={() => setReasonModal(null)}
        onConfirm={({ reasonCode, notes }) => {
          onDecide(submission, 'changes', notes || REJECT_REASONS.find((r) => r.value === reasonCode)?.label);
          setReasonModal(null);
        }}
      />
    </>
  );
}
