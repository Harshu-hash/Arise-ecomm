/* eslint-disable max-lines */
import {
  CheckCircleTwoTone,
  CloseCircleTwoTone,
  EditOutlined,
  ExclamationCircleTwoTone,
  RedoOutlined,
  SendOutlined,
} from '@ant-design/icons';
import {
  App,
  Avatar,
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Flex,
  Input,
  List,
  Modal,
  Progress,
  Row,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import ErrorState from '@ui/components/ErrorState';
import FullPageSpinner from '@ui/components/FullPageSpinner';
import CampaignTag from '@ui/components/CampaignTag';
import MoneyText from '@ui/components/MoneyText';
import PageHeader from '@ui/components/PageHeader';
import StatusTag from '@ui/components/StatusTag';
import { listingKeys, listingsApi } from '../api/listings.api';
import EditListingModal from '../components/EditListingModal';

const CHECK_ICON = {
  PASS: <CheckCircleTwoTone twoToneColor="#26A541" />,
  WARN: <ExclamationCircleTwoTone twoToneColor="#FFA41C" />,
  FAIL: <CloseCircleTwoTone twoToneColor="#FF4D4F" />,
};

export default function ListingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [lifecycleAction, setLifecycleAction] = useState(null);
  const [reason, setReason] = useState('');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: listingKeys.detail(id),
    queryFn: () => listingsApi.detail(id),
  });

  const { data: feePreview } = useQuery({
    queryKey: ['seller', 'listings', id, 'fee-preview', data?.sellingPricePaise],
    queryFn: () =>
      listingsApi.feePreview({
        pricePaise: data.sellingPricePaise,
        categoryId: data.product.categoryId,
        variantId: data.variantId,
      }),
    enabled: Boolean(data?.sellingPricePaise && data?.product?.categoryId),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: listingKeys.detail(id) });
    queryClient.invalidateQueries({ queryKey: ['seller', 'listings', 'list'] });
  };

  const resubmitMut = useMutation({
    mutationFn: () => listingsApi.resubmit(id),
    onSuccess: () => {
      message.success('Resubmitted for QC review.');
      invalidate();
    },
    onError: (e) => message.error(e?.message ?? 'Could not resubmit.'),
  });
  const submitDraftMut = useMutation({
    mutationFn: () => listingsApi.update(id, { submitForQc: true }),
    onSuccess: () => {
      message.success('Submitted for QC review.');
      invalidate();
    },
    onError: (e) => message.error(e?.message ?? 'Could not submit.'),
  });
  const lifecycleMut = useMutation({
    mutationFn: () => listingsApi.lifecycle(id, lifecycleAction, { reason }),
    onSuccess: () => {
      message.success(`Listing ${lifecycleAction} completed.`);
      setLifecycleAction(null);
      setReason('');
      invalidate();
    },
    onError: (e) =>
      message.error(e?.fieldErrors?.reason ?? e?.message ?? 'Could not update the listing.'),
  });
  if (isLoading) return <FullPageSpinner label="Loading listing…" />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;

  const { product, variant, submission } = data;

  return (
    <Flex vertical gap={16}>
      <PageHeader
        title={data.productTitle}
        breadcrumbs={[{ label: 'Listings', to: '/listings' }, { label: data.productTitle }]}
        onBack={() => navigate('/listings')}
        tags={<StatusTag domain="listing" code={data.status} />}
        actions={
          <Space>
            {data.status === 'DRAFT' && (
              <>
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  loading={submitDraftMut.isPending}
                  onClick={() => submitDraftMut.mutate()}
                >
                  Submit for QC
                </Button>
              </>
            )}
            {data.needsChanges && (
              <>
                <Button
                  type="primary"
                  icon={<RedoOutlined />}
                  loading={resubmitMut.isPending}
                  onClick={() => resubmitMut.mutate()}
                >
                  Resubmit for QC
                </Button>
              </>
            )}
            <>
              <Button icon={<EditOutlined />} onClick={() => setEditOpen(true)}>
                Edit product
              </Button>
            </>
            {data.productStatus === 'LIVE' && data.status === 'LIVE' && (
              <Button danger onClick={() => setLifecycleAction('deactivate')}>
                Deactivate offer
              </Button>
            )}
            {data.productStatus === 'LIVE' && ['INACTIVE', 'ARCHIVED'].includes(data.status) && (
              <Button onClick={() => setLifecycleAction('relist')}>Relist offer</Button>
            )}
            {data.status !== 'ARCHIVED' && (
              <Button onClick={() => setLifecycleAction('archive')}>Archive offer</Button>
            )}
            {data.status === 'ARCHIVED' && (
              <Button danger onClick={() => setLifecycleAction('delete')}>
                Delete offer
              </Button>
            )}
          </Space>
        }
      />

      {submission?.status === 'NEEDS_CHANGES' && (
        <Alert
          type="warning"
          showIcon
          message="QC has requested changes"
          description={
            submission.issues?.length ? (
              <ul style={{ margin: '4px 0 0 16px' }}>
                {submission.issues.map((iss, i) => (
                  <li key={i}>{typeof iss === 'string' ? iss : (iss.message ?? iss.detail)}</li>
                ))}
              </ul>
            ) : (
              'Review the automated checks below, make the changes, then resubmit.'
            )
          }
        />
      )}
      {submission?.status === 'QC_PENDING' && (
        <Alert
          type="info"
          showIcon
          message="In QC review"
          description={`Submitted ${submission.ageHours ?? 0}h ago. Most listings are reviewed within 24 hours.`}
        />
      )}

      <Row gutter={16}>
        <Col xs={24} lg={16}>
          <Card title="Product" style={{ marginBottom: 16 }}>
            <Flex gap={16} wrap>
              <Avatar
                shape="square"
                size={96}
                src={data.productImage}
                style={{ background: '#f0f0f0' }}
              >
                {data.productTitle?.[0]}
              </Avatar>
              <div style={{ flex: 1, minWidth: 220 }}>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Brand">{data.brandName ?? '—'}</Descriptions.Item>
                  <Descriptions.Item label="Category">{data.categoryPath}</Descriptions.Item>
                  <Descriptions.Item label="Variant">
                    {data.variantLabel ?? 'Default'}
                  </Descriptions.Item>
                  <Descriptions.Item label="SKU">{variant?.sku}</Descriptions.Item>
                  <Descriptions.Item label="Seller SKU">{data.sellerSku ?? '—'}</Descriptions.Item>
                  <Descriptions.Item label="Barcode / EAN">{variant?.ean ?? '—'}</Descriptions.Item>
                  <Descriptions.Item label="HSN">{product?.hsnCode ?? '—'}</Descriptions.Item>
                </Descriptions>
              </div>
            </Flex>
            {product?.description && (
              <>
                <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 4 }}>
                  Description
                </Typography.Paragraph>
                <Typography.Paragraph>{product.description}</Typography.Paragraph>
              </>
            )}
            {product?.imageUrls?.length > 1 && (
              <Space wrap style={{ marginBottom: 12 }}>
                {product.imageUrls.map((url) => (
                  <Avatar key={url} shape="square" size={64} src={url} />
                ))}
              </Space>
            )}
            {product?.highlights?.length > 0 && (
              <>
                <Typography.Paragraph type="secondary" style={{ marginBottom: 4 }}>
                  Highlights
                </Typography.Paragraph>
                <ul style={{ marginTop: 0 }}>
                  {product.highlights.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              </>
            )}
            <Descriptions column={{ xs: 1, sm: 2 }} size="small" bordered style={{ marginBottom: 12 }}>
              {Object.entries(product?.attributes ?? {}).map(([k, v]) => (
                <Descriptions.Item key={k} label={k}>
                  {Array.isArray(v) ? v.join(', ') : String(v)}
                </Descriptions.Item>
              ))}
              {[
                ['Fit', product?.fit],
                ['Care', product?.care],
                ['Model info', product?.modelInfo],
                ['Manufacturer', product?.manufacturer],
                ['Country of origin', product?.countryOfOrigin],
                ['Product code', product?.productCode],
                ['GST', product?.gstRate != null ? `${product.gstRate}%` : null],
                [
                  'Returns',
                  product?.returnPolicy
                    ? `${product.returnPolicy.type} · ${product.returnPolicy.windowDays} days`
                    : null,
                ],
              ]
                .filter(([, v]) => v)
                .map(([label, v]) => (
                  <Descriptions.Item key={label} label={label}>
                    {v}
                  </Descriptions.Item>
                ))}
            </Descriptions>
          </Card>

          {data.variants?.length > 0 && (
            <Card title={`Variants (${data.variants.length})`} style={{ marginBottom: 16 }}>
              <Table
                size="small"
                rowKey="offerId"
                pagination={false}
                scroll={{ x: true }}
                dataSource={data.variants}
                onRow={(v) => ({ onClick: () => v.offerId !== id && navigate(`/listings/${v.offerId}`) })}
                rowClassName={(v) => (v.offerId === id ? 'ant-table-row-selected' : '')}
                columns={[
                  {
                    title: 'Variant',
                    render: (_, v) => (
                      <Flex gap={8} align="center">
                        <Avatar shape="square" size={36} src={v.imageUrls?.[0]} />
                        <div>
                          <Typography.Text strong>{v.label ?? 'Default'}</Typography.Text>
                          <div>
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                              {v.sku}
                            </Typography.Text>
                          </div>
                        </div>
                      </Flex>
                    ),
                  },
                  {
                    title: 'Price',
                    align: 'right',
                    render: (_, v) => (
                      <>
                        <MoneyText paise={v.sellingPricePaise} strong />
                        <div><CampaignTag campaign={v.campaign} /></div>
                        {v.mrpPaise > v.sellingPricePaise && (
                          <div>
                            <Typography.Text delete type="secondary" style={{ fontSize: 11 }}>
                              <MoneyText paise={v.mrpPaise} type="secondary" />
                            </Typography.Text>
                          </div>
                        )}
                      </>
                    ),
                  },
                  { title: 'Stock', dataIndex: 'stock', align: 'right' },
                  { title: 'EAN', dataIndex: 'ean', render: (e) => e ?? '—' },
                  {
                    title: 'Weight / size',
                    render: (_, v) =>
                      `${v.weightG} g · ${v.dimsCm?.l}×${v.dimsCm?.w}×${v.dimsCm?.h} cm`,
                  },
                  { title: 'Status', dataIndex: 'status', render: (s) => <StatusTag domain="listing" code={s} /> },
                ]}
              />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Click a variant to edit its price, stock and details.
              </Typography.Text>
            </Card>
          )}

          {submission?.autoChecks?.length > 0 && (
            <Card title="QC auto-checks" size="small">
              <List
                dataSource={submission.autoChecks}
                renderItem={(c) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={CHECK_ICON[c.result]}
                      title={c.label}
                      description={c.detail ?? undefined}
                    />
                    <Tag
                      color={c.result === 'PASS' ? 'green' : c.result === 'WARN' ? 'gold' : 'red'}
                    >
                      {c.result}
                    </Tag>
                  </List.Item>
                )}
              />
            </Card>
          )}

          <Card title="Customer preview" style={{ marginTop: 16 }}>
            <Flex gap={16} wrap>
              <Avatar
                shape="square"
                size={88}
                src={data.preview?.images?.[0]?.previewUrl ?? data.preview?.images?.[0]}
              >
                {data.preview?.title?.[0]}
              </Avatar>
              <div>
                <Typography.Title level={5}>{data.preview?.title}</Typography.Title>
                <Typography.Text type="secondary">{data.preview?.brandName}</Typography.Text>
                <br />
                <Tag color={data.preview?.visible ? 'green' : 'default'}>
                  {data.preview?.visible ? 'Customer visible' : 'Not customer visible'}
                </Tag>
              </div>
            </Flex>
            <Typography.Paragraph style={{ marginTop: 12 }}>
              {data.preview?.description}
            </Typography.Paragraph>
            <Space wrap>
              {data.preview?.variants?.map((item) => (
                <Tag key={item.id} color={item.available ? 'blue' : 'default'}>
                  {item.label} · {item.available ? 'Available' : 'Unavailable'}
                </Tag>
              ))}
            </Space>
          </Card>

          <Card title="Version history" style={{ marginTop: 16 }}>
            <List
              size="small"
              dataSource={data.revisions ?? []}
              locale={{ emptyText: 'No revisions yet' }}
              renderItem={(revision) => (
                <List.Item>
                  <List.Item.Meta
                    title={`Version ${revision.version ?? '—'}`}
                    description={
                      <>
                        <Typography.Text type="secondary">
                          {revision.status} · {revision.changes?.length ?? 0} changed fields
                        </Typography.Text>
                        {revision.changes?.map((change, index) => (
                          <div key={`${change.field}-${index}`}>
                            <Typography.Text code>{change.field}</Typography.Text>{' '}
                            {String(change.from ?? change.before ?? '—')} →{' '}
                            {String(change.to ?? change.after ?? '—')}
                          </div>
                        ))}
                      </>
                    }
                  />
                  <Tag>{revision.status}</Tag>
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="On this listing" size="small">
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Flex justify="space-between">
                <Typography.Text type="secondary">Buy box</Typography.Text>
                <Typography.Text strong>
                  {data.buyBoxWinner ? 'Winning' : 'Not winning'}
                </Typography.Text>
              </Flex>
              <Flex justify="space-between">
                <Typography.Text type="secondary">Other sellers on this variant</Typography.Text>
                <Typography.Text strong>{data.competingOffers}</Typography.Text>
              </Flex>
              <Flex justify="space-between">
                <Typography.Text type="secondary">Fulfilment</Typography.Text>
                <Tag
                  color={data.fulfillmentType === 'ARISE' ? 'geekblue' : 'default'}
                  style={{ margin: 0 }}
                >
                  {data.fulfillmentType === 'ARISE' ? 'By Arise' : 'Self-ship'}
                </Tag>
              </Flex>
            </Space>
          </Card>

          <Card title="Listing quality" size="small" style={{ marginTop: 16 }}>
            <Progress
              percent={data.quality?.score ?? 0}
              status={(data.quality?.score ?? 0) >= 70 ? 'normal' : 'exception'}
            />
            <List
              size="small"
              dataSource={data.quality?.recommendations ?? []}
              renderItem={(item) => <List.Item>{item.message}</List.Item>}
            />
          </Card>

          {feePreview && (
            <Card title="Fee preview" size="small" style={{ marginTop: 16 }}>
              <Descriptions size="small" column={1}>
                <Descriptions.Item label="Commission">
                  <MoneyText paise={feePreview.commissionPaise} />
                </Descriptions.Item>
                <Descriptions.Item label="Closing fee">
                  <MoneyText paise={feePreview.closingFeePaise} />
                </Descriptions.Item>
                <Descriptions.Item label="Expected net">
                  <MoneyText paise={feePreview.netPaise} strong />
                </Descriptions.Item>
                <Descriptions.Item label="Buy-box price">
                  {feePreview.buyBoxCompetitive ? 'Competitive' : 'Above competitor'}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          )}
        </Col>
      </Row>

      <EditListingModal
        data={data}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          setEditOpen(false);
          invalidate();
        }}
      />
      <Modal
        title={`${lifecycleAction ?? ''} listing offer`}
        open={Boolean(lifecycleAction)}
        onCancel={() => {
          setLifecycleAction(null);
          setReason('');
        }}
        onOk={() => lifecycleMut.mutate()}
        confirmLoading={lifecycleMut.isPending}
        okButtonProps={{
          disabled: ['deactivate', 'archive', 'delete'].includes(lifecycleAction) && !reason.trim(),
        }}
      >
        {['deactivate', 'archive', 'delete'].includes(lifecycleAction) ? (
          <>
            <Typography.Paragraph>
              Give a reason. The canonical customer product is preserved.
            </Typography.Paragraph>
            <Input.TextArea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
            />
          </>
        ) : (
          <Typography.Paragraph>
            This restores only your offer on the live canonical product.
          </Typography.Paragraph>
        )}
      </Modal>
    </Flex>
  );
}
