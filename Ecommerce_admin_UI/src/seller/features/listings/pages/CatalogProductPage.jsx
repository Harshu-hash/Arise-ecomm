/* eslint-disable max-lines */
import { ArrowLeftOutlined, CheckCircleOutlined } from '@ant-design/icons';
import {
  Alert,
  App,
  Avatar,
  Button,
  Card,
  Checkbox,
  Col,
  Descriptions,
  Flex,
  Input,
  InputNumber,
  List,
  Row,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import ErrorState from '@ui/components/ErrorState';
import FullPageSpinner from '@ui/components/FullPageSpinner';
import MoneyText from '@ui/components/MoneyText';
import PageHeader from '@ui/components/PageHeader';
import { listingKeys, listingsApi } from '../api/listings.api';

export default function CatalogProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const query = useQuery({
    queryKey: listingKeys.catalogProduct(id),
    queryFn: () => listingsApi.catalogProduct(id),
  });
  useEffect(() => {
    if (query.data?.variants)
      setRows(
        query.data.variants.map((variant) => ({
          ...variant,
          selected: !variant.alreadySelling,
          sellerSku: '',
          mrpPaise: variant.buyBoxPricePaise ?? 0,
          sellingPricePaise: variant.buyBoxPricePaise ?? 0,
          stock: 0,
        })),
      );
  }, [query.data]);
  const mutation = useMutation({
    mutationFn: () =>
      listingsApi.attachOffers(id, {
        offers: rows
          .filter((row) => row.selected && !row.alreadySelling)
          .map((row) => ({
            variantId: row.id,
            sellerSku: row.sellerSku,
            barcode: row.ean,
            mrpPaise: row.mrpPaise,
            sellingPricePaise: row.sellingPricePaise,
            stock: row.stock,
          })),
      }),
    onSuccess: (result) => {
      message.success(
        `${result.offers.length} offer${result.offers.length === 1 ? '' : 's'} created without changing canonical product content.`,
      );
      navigate(`/listings/${result.offers[0].id}`);
    },
    onError: (error) => message.error(error?.message ?? 'Could not create the offers.'),
  });
  const update = (variantId, patch) =>
    setRows((current) => current.map((row) => (row.id === variantId ? { ...row, ...patch } : row)));

  if (query.isLoading) return <FullPageSpinner label="Loading catalogue product…" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />;
  const { product } = query.data;
  const chosen = rows.filter((row) => row.selected && !row.alreadySelling);
  const invalid = chosen.some(
    (row) =>
      !row.sellerSku.trim() ||
      !(row.sellingPricePaise > 0) ||
      !(row.mrpPaise > 0) ||
      row.sellingPricePaise > row.mrpPaise,
  );

  return (
    <Flex vertical gap={16}>
      <PageHeader
        title={product.title}
        breadcrumbs={[
          { label: 'Listings', to: '/listings' },
          { label: 'Add listing', to: '/listings/new' },
          { label: product.id },
        ]}
        onBack={
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/listings/new')}
          />
        }
        tags={<Tag color="green">Customer-visible product</Tag>}
        subtitle="Create only your commercial offer. Title, media, attributes and variants remain canonical."
      />
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={9}>
          <Card title="Customer product content">
            <Flex gap={12}>
              <Avatar
                shape="square"
                size={112}
                src={
                  typeof product.images?.[0] === 'string'
                    ? product.images[0]
                    : product.images?.[0]?.previewUrl
                }
              >
                {product.title?.[0]}
              </Avatar>
              <Descriptions size="small" column={1}>
                <Descriptions.Item label="Product ID">{product.id}</Descriptions.Item>
                <Descriptions.Item label="Brand">{product.brandName}</Descriptions.Item>
                <Descriptions.Item label="Category">{product.categoryPath}</Descriptions.Item>
                <Descriptions.Item label="HSN / GST">
                  {product.hsnCode} / {product.gstRate}%
                </Descriptions.Item>
              </Descriptions>
            </Flex>
            <Typography.Paragraph style={{ marginTop: 12 }}>
              {product.description}
            </Typography.Paragraph>
            <List
              size="small"
              dataSource={product.highlights ?? []}
              renderItem={(item) => (
                <List.Item>
                  <CheckCircleOutlined
                    style={{ color: 'var(--ant-color-success)', marginRight: 8 }}
                  />
                  {item}
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} lg={15}>
          <Card
            title="Your offers"
            extra={
              <Button
                type="primary"
                disabled={!chosen.length || invalid}
                loading={mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                Create {chosen.length || ''} offer{chosen.length === 1 ? '' : 's'}
              </Button>
            }
          >
            <Alert
              type="info"
              showIcon
              message="Offer fields do not overwrite product content"
              description="Your SKU, barcode, price, stock and fulfilment are private to your seller offer. Customer content remains controlled by the canonical catalogue."
              style={{ marginBottom: 12 }}
            />
            <Table
              rowKey="id"
              pagination={false}
              scroll={{ x: 'max-content' }}
              dataSource={rows}
              columns={[
                {
                  title: '',
                  width: 48,
                  render: (_, row) => (
                    <Checkbox
                      checked={row.alreadySelling || row.selected}
                      disabled={row.alreadySelling}
                      onChange={(event) => update(row.id, { selected: event.target.checked })}
                    />
                  ),
                },
                {
                  title: 'Variant',
                  dataIndex: 'label',
                  width: 150,
                  render: (value, row) => (
                    <Space direction="vertical" size={0}>
                      <Typography.Text strong>{value}</Typography.Text>
                      {row.alreadySelling && <Tag color="green">Already selling</Tag>}
                    </Space>
                  ),
                },
                {
                  title: 'Seller SKU',
                  width: 150,
                  render: (_, row) => (
                    <Input
                      value={row.sellerSku}
                      disabled={row.alreadySelling || !row.selected}
                      onChange={(event) => update(row.id, { sellerSku: event.target.value })}
                    />
                  ),
                },
                {
                  title: 'MRP',
                  width: 120,
                  render: (_, row) => (
                    <InputNumber
                      min={1}
                      prefix="₹"
                      value={row.mrpPaise / 100 || null}
                      disabled={row.alreadySelling || !row.selected}
                      onChange={(value) =>
                        update(row.id, { mrpPaise: Math.round((value ?? 0) * 100) })
                      }
                    />
                  ),
                },
                {
                  title: 'Price',
                  width: 120,
                  render: (_, row) => (
                    <Space direction="vertical" size={0}>
                      <InputNumber
                        min={1}
                        prefix="₹"
                        status={row.sellingPricePaise > row.mrpPaise ? 'error' : undefined}
                        value={row.sellingPricePaise / 100 || null}
                        disabled={row.alreadySelling || !row.selected}
                        onChange={(value) =>
                          update(row.id, { sellingPricePaise: Math.round((value ?? 0) * 100) })
                        }
                      />
                      {row.buyBoxPricePaise && (
                        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                          Buy box <MoneyText paise={row.buyBoxPricePaise} />
                        </Typography.Text>
                      )}
                    </Space>
                  ),
                },
                {
                  title: 'Stock',
                  width: 100,
                  render: (_, row) => (
                    <InputNumber
                      min={0}
                      value={row.stock}
                      disabled={row.alreadySelling || !row.selected}
                      onChange={(value) => update(row.id, { stock: value ?? 0 })}
                    />
                  ),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </Flex>
  );
}
