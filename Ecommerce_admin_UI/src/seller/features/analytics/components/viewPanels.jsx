import { Col, Flex, Row, Table, Tag, Typography } from 'antd';
import { formatINRCompact, formatNumber, formatPercent } from '@core/utils/money';
import MoneyText from '@ui/components/MoneyText';
import { BarListChart, ChartCard, DonutChart, FunnelChart, StatTileRow as Tiles, TrendAreaChart } from '@ui/charts';
import { SELLER_ACCENT } from '@seller/theme';

const money = (p) => formatINRCompact(p);
const num = (v) => formatNumber(v);

const TRAFFIC_SERIES = [
  { key: 'impressions', label: 'Impressions', color: '#64748B', type: 'line', format: num },
  { key: 'productViews', label: 'Product views', color: SELLER_ACCENT, type: 'area', format: num },
  { key: 'addsToCart', label: 'Add to cart', color: '#26A541', type: 'line', format: num },
  { key: 'checkouts', label: 'Checkout', color: '#FFA41C', type: 'line', format: num },
];

/** One render function per seller analytics view, keyed by view name. */
export const VIEW_RENDERERS = {
  overview: (data, loading) => {
    const k = data?.kpis ?? {};
    const cmp = data?.comparison ?? {};
    return (
      <Flex vertical gap={16}>
        <Tiles
          loading={loading}
          items={[
            { label: 'GMV', valuePaise: k.gmvPaise, format: 'money', deltaPct: cmp.gmvPct },
            { label: 'Orders', value: k.orders, deltaPct: cmp.ordersPct },
            { label: 'Units', value: k.units },
            { label: 'Avg selling price', valuePaise: k.aspPaise, format: 'money' },
            { label: 'Discount given', valuePaise: k.discountPaise, format: 'money' },
            { label: 'Net earnings', valuePaise: k.netEarningsPaise, format: 'money' },
            { label: 'Cancellations', value: k.cancellations, invertDelta: true },
            { label: 'Returns', value: k.returns, invertDelta: true },
          ]}
        />

        <Row gutter={[12, 12]}>
          <Col xs={24} xl={16}>
            <ChartCard title="Traffic & conversion trend" loading={loading} isEmpty={!data?.series?.length}>
              <TrendAreaChart data={data?.series ?? []} series={TRAFFIC_SERIES} />
            </ChartCard>
          </Col>
          <Col xs={24} xl={8}>
            <ChartCard title="Conversion funnel" loading={loading} isEmpty={!data?.funnel?.length}>
              <FunnelChart stages={data?.funnel ?? []} color={SELLER_ACCENT} />
            </ChartCard>
          </Col>
        </Row>

        <Row gutter={[12, 12]}>
          <Col xs={24} lg={8}>
            <ChartCard title="Views by channel" loading={loading} isEmpty={!data?.breakdowns?.channel?.length}>
              <DonutChart data={data?.breakdowns?.channel ?? []} format={num} />
            </ChartCard>
          </Col>
          <Col xs={24} lg={8}>
            <ChartCard title="Views by category" loading={loading} isEmpty={!data?.breakdowns?.category?.length}>
              <BarListChart colorful data={data?.breakdowns?.category ?? []} format={num} />
            </ChartCard>
          </Col>
          <Col xs={24} lg={8}>
            <ChartCard title="Orders by state" loading={loading} isEmpty={!data?.breakdowns?.geography?.length}>
              <BarListChart data={data?.breakdowns?.geography ?? []} format={num} />
            </ChartCard>
          </Col>
        </Row>
      </Flex>
    );
  },

  products: (data, loading) => (
    <ChartCard title="Listing performance" loading={loading} isEmpty={!data?.rows?.length} bodyPadding={0}>
      <Table
        size="small"
        rowKey="id"
        dataSource={data?.rows ?? []}
        scroll={{ x: 900 }}
        pagination={{ pageSize: 15, hideOnSinglePage: true }}
        columns={[
          { title: 'Product', dataIndex: 'productTitle', width: 240, ellipsis: true, render: (v, r) => v ?? r.sku },
          { title: 'SKU', dataIndex: 'sku', width: 120 },
          { title: 'Impr.', dataIndex: 'impressions', align: 'right', render: (v) => <span className="tabular">{num(v)}</span> },
          { title: 'Views', dataIndex: 'productViews', align: 'right', render: (v) => <span className="tabular">{num(v)}</span> },
          { title: 'Orders', dataIndex: 'orders', align: 'right', render: (v) => <span className="tabular">{num(v)}</span> },
          { title: 'Conv.', dataIndex: 'conversionPct', align: 'right', render: (v) => <span className="tabular">{formatPercent(v)}</span> },
          { title: 'GMV', dataIndex: 'gmvPaise', align: 'right', render: (v) => <MoneyText paise={v} compact /> },
          { title: 'Net earnings', dataIndex: 'netEarningsPaise', align: 'right', render: (v) => <MoneyText paise={v} compact /> },
          { title: 'Buy box', dataIndex: 'buyBoxSharePct', align: 'right', render: (v) => <span className="tabular">{formatPercent(v, 0)}</span> },
          {
            title: 'Lost sales',
            dataIndex: 'lostSalesPaise',
            align: 'right',
            render: (v) => (v ? <MoneyText paise={v} compact type="danger" /> : <Typography.Text type="secondary">—</Typography.Text>),
          },
        ]}
      />
    </ChartCard>
  ),

  traffic: (data, loading) => {
    const ads = data?.ads ?? {};
    return (
      <Flex vertical gap={16}>
        <Tiles
          loading={loading}
          items={[
            { label: 'Ad impressions', value: ads.impressions },
            { label: 'Clicks', value: ads.clicks },
            { label: 'CTR', value: ads.ctrPct, format: 'percent' },
            { label: 'Ad spend', valuePaise: ads.spendPaise, format: 'money' },
            { label: 'Attributed revenue', valuePaise: ads.attributedRevenuePaise, format: 'money' },
            { label: 'ROAS', value: ads.roas, format: 'number' },
            { label: 'CPC', valuePaise: ads.cpcPaise, format: 'money' },
            { label: 'Ad conversion', value: ads.conversionPct, format: 'percent' },
          ]}
        />
        <Row gutter={[12, 12]}>
          <Col xs={24} xl={16}>
            <ChartCard title="Traffic trend" loading={loading} isEmpty={!data?.series?.length}>
              <TrendAreaChart data={data?.series ?? []} series={TRAFFIC_SERIES} />
            </ChartCard>
          </Col>
          <Col xs={24} xl={8}>
            <ChartCard title="Views by source" loading={loading} isEmpty={!data?.sources?.length}>
              <DonutChart
                data={(data?.sources ?? []).map((s) => ({ label: s.label, value: s.productViews }))}
                format={num}
              />
            </ChartCard>
          </Col>
        </Row>
      </Flex>
    );
  },

  operations: (data, loading) => {
    const k = data?.kpis ?? {};
    return (
      <Flex vertical gap={16}>
        <Tiles
          loading={loading}
          items={[
            { label: 'Dispatch within SLA', value: k.dispatchSlaPct, format: 'percent' },
            { label: 'NDR shipments', value: k.ndr, invertDelta: true },
            { label: 'RTO shipments', value: k.rto, invertDelta: true },
            { label: 'Returns', value: k.returns, invertDelta: true },
          ]}
        />
        <Row gutter={[12, 12]}>
          <Col xs={24} lg={10}>
            <ChartCard title="Return reasons" loading={loading} isEmpty={!data?.returnReasons?.length}>
              <DonutChart data={data?.returnReasons ?? []} format={num} />
            </ChartCard>
          </Col>
          <Col xs={24} lg={14}>
            <ChartCard title="Inventory ageing" loading={loading} isEmpty={!data?.inventoryAgeing?.length} bodyPadding={0}>
              <Table
                size="small"
                rowKey={(r) => `${r.sku}-${r.warehouseId ?? ''}`}
                dataSource={data?.inventoryAgeing ?? []}
                pagination={{ pageSize: 8, hideOnSinglePage: true }}
                columns={[
                  { title: 'SKU', dataIndex: 'sku', width: 120 },
                  { title: 'Product', dataIndex: 'productTitle', ellipsis: true },
                  { title: 'Available', dataIndex: 'available', align: 'right', render: (v) => <span className="tabular">{num(v)}</span> },
                  {
                    title: 'Age (days)',
                    dataIndex: 'ageDays',
                    align: 'right',
                    render: (v) => (
                      <Tag color={v > 90 ? 'red' : v > 45 ? 'orange' : 'green'} className="tabular">
                        {v}
                      </Tag>
                    ),
                  },
                ]}
              />
            </ChartCard>
          </Col>
        </Row>
      </Flex>
    );
  },

  finance: (data, loading) => {
    const k = data?.kpis ?? {};
    return (
      <Flex vertical gap={16}>
        <Tiles
          loading={loading}
          items={[
            { label: 'Gross sales', valuePaise: k.grossPaise, format: 'money' },
            { label: 'Fees', valuePaise: k.feesPaise, format: 'money' },
            { label: 'Tax (TCS/TDS)', valuePaise: k.taxPaise, format: 'money' },
            { label: 'Adjustments', valuePaise: k.adjustmentsPaise, format: 'money' },
            { label: 'Net earnings', valuePaise: k.netEarningsPaise, format: 'money' },
          ]}
        />
        <ChartCard title="Earnings breakdown" loading={loading} isEmpty={!k.grossPaise}>
          <DonutChart
            data={[
              { label: 'Net earnings', value: k.netEarningsPaise ?? 0 },
              { label: 'Fees', value: k.feesPaise ?? 0 },
              { label: 'Tax', value: k.taxPaise ?? 0 },
            ]}
            format={money}
          />
        </ChartCard>
        <ChartCard title="Settlement lines" loading={loading} isEmpty={!data?.rows?.length} bodyPadding={0}>
          <Table
            size="small"
            rowKey={(r) => r.id ?? r.orderItemId}
            dataSource={data?.rows ?? []}
            scroll={{ x: 640 }}
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            columns={[
              { title: 'Order item', dataIndex: 'orderItemId', width: 160, ellipsis: true },
              { title: 'Sale', dataIndex: 'salePaise', align: 'right', render: (v) => <MoneyText paise={v} compact /> },
              { title: 'Commission', dataIndex: 'commissionPaise', align: 'right', render: (v) => <MoneyText paise={v} compact type="danger" /> },
              { title: 'Fees', dataIndex: 'feesBeforeTaxPaise', align: 'right', render: (v) => <MoneyText paise={v} compact type="danger" /> },
              { title: 'Net', dataIndex: 'netPaise', align: 'right', render: (v) => <MoneyText paise={v} compact strong /> },
            ]}
          />
        </ChartCard>
      </Flex>
    );
  },
};
