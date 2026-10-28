import { Card, Flex, Table, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import MoneyText from '@ui/components/MoneyText';
import PageHeader from '@ui/components/PageHeader';
import StatusTag from '@ui/components/StatusTag';
import { promotionsApi, promotionsKeys } from '../api/promotions.api';

export default function NominationsPage() {
  const navigate = useNavigate();
  const { data = [], isLoading } = useQuery({ queryKey: promotionsKeys.nominations, queryFn: promotionsApi.nominations });

  return (
    <Flex vertical gap={12}>
      <PageHeader title="My Flash Sale Nominations" breadcrumbs={[{ label: 'Growth & Ads' }, { label: 'Flash Sales', to: '/promotions' }, { label: 'My nominations' }]} onBack={() => navigate('/promotions')} />
      <Card styles={{ body: { padding: 0 } }}>
        <Table
          rowKey="id"
          scroll={{ x: 'max-content' }}
          loading={isLoading}
          dataSource={data}
          pagination={{ pageSize: 20 }}
          locale={{ emptyText: 'No nominations yet.' }}
          columns={[
            { title: 'Flash sale', dataIndex: 'flashSaleName' },
            { title: 'Product', dataIndex: 'productTitle', ellipsis: true },
            { title: 'Flash price', dataIndex: 'flashPricePaise', align: 'right', render: (p) => <MoneyText paise={p} /> },
            { title: 'Discount', dataIndex: 'discountPct', align: 'right', width: 90, render: (v) => `${v}%` },
            { title: 'Units sold', dataIndex: 'unitsSold', align: 'right', width: 100 },
            { title: 'Status', dataIndex: 'status', render: (s, r) => (
              <Flex vertical gap={2}><StatusTag domain="flashSaleNomination" code={s} />{r.rejectReason && <Typography.Text type="secondary" style={{ fontSize: 11 }}>{r.rejectReason}</Typography.Text>}</Flex>
            ) },
          ]}
        />
      </Card>
    </Flex>
  );
}
