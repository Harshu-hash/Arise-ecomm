import { PlusOutlined, SearchOutlined, ShopOutlined } from '@ant-design/icons';
import {
  Avatar,
  Button,
  Card,
  Col,
  Empty,
  Flex,
  Input,
  Row,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import MoneyText from '@ui/components/MoneyText';
import PageHeader from '@ui/components/PageHeader';
import { listingKeys, listingsApi } from '../api/listings.api';

export default function AddProductPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const search = useQuery({
    queryKey: listingKeys.catalogSearch(query),
    queryFn: () => listingsApi.catalogSearch({ q: query }),
    enabled: query.trim().length >= 2,
  });

  return (
    <Flex vertical gap={16}>
      <PageHeader
        title="Add a listing"
        breadcrumbs={[{ label: 'Listings', to: '/listings' }, { label: 'Add listing' }]}
        onBack={() => navigate('/listings')}
        subtitle="Match an existing marketplace product when possible. Create canonical content only when the product is genuinely new."
      />
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title="Find an existing product">
            <Input.Search
              size="large"
              allowClear
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              prefix={<SearchOutlined />}
              placeholder="Search title, brand, GTIN / EAN / ISBN or product ID"
              enterButton="Search catalogue"
            />
            {query.trim().length < 2 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Enter at least two characters to search the customer-visible catalogue."
              />
            ) : search.isLoading ? (
              <Flex justify="center" style={{ padding: 40 }}>
                <Spin />
              </Flex>
            ) : (
              <Flex vertical gap={10} style={{ marginTop: 16 }}>
                {search.data?.map((product) => (
                  <Card
                    key={product.id}
                    size="small"
                    hoverable
                    onClick={() => navigate(`/catalog/products/${product.id}`)}
                  >
                    <Flex align="center" gap={12}>
                      <Avatar
                        shape="square"
                        size={64}
                        src={
                          typeof product.image === 'string'
                            ? product.image
                            : product.image?.previewUrl
                        }
                      >
                        {product.title?.[0]}
                      </Avatar>
                      <div style={{ flex: 1 }}>
                        <Typography.Text strong>{product.title}</Typography.Text>
                        <div>
                          <Typography.Text type="secondary">
                            {product.brandName} · {product.categoryPath} · {product.variantCount}{' '}
                            variant{product.variantCount === 1 ? '' : 's'}
                          </Typography.Text>
                        </div>
                        {product.minPricePaise != null && (
                          <Typography.Text type="secondary">
                            Customer price from <MoneyText paise={product.minPricePaise} />
                          </Typography.Text>
                        )}
                      </div>
                      {product.alreadySelling ? (
                        <Tag color="green">Already selling</Tag>
                      ) : (
                        <Button icon={<ShopOutlined />}>Sell this product</Button>
                      )}
                    </Flex>
                  </Card>
                ))}
                {search.data?.length === 0 && (
                  <Empty description="No matching customer-visible product found." />
                )}
              </Flex>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="Product not in the catalogue?">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Typography.Paragraph type="secondary">
                Create new canonical product content with category attributes, durable media,
                variants and compliance evidence. It will require admin QC.
              </Typography.Paragraph>
              <Button
                type="primary"
                block
                size="large"
                icon={<PlusOutlined />}
                onClick={() => navigate('/listings/new/create')}
              >
                Create a new product
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>
    </Flex>
  );
}
