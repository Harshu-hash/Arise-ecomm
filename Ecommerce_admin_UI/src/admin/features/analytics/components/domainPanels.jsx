import { Col, Flex, Row, Table, Typography } from 'antd';
import { formatINRCompact, formatNumber, formatPercent } from '@core/utils/money';
import { BarListChart, ChartCard, DonutChart, StatTileRow as Tiles } from '@ui/charts';

const money = (p) => formatINRCompact(p);
const num = (v) => formatNumber(v);

/** One render function per analytics domain, keyed by domain name. */
export const DOMAIN_RENDERERS = {
  sales: (t, data, loading) => (
    <Flex vertical gap={16}>
      <Tiles
        loading={loading}
        items={[
          { label: 'GMV', valuePaise: t.gmvPaise, format: 'money' },
          { label: 'Orders', value: t.orders },
          { label: 'Units', value: t.units },
          { label: 'AOV', valuePaise: t.aovPaise, format: 'money' },
        ]}
      />
      <Row gutter={[12, 12]}>
        <Col xs={24} lg={12}>
          <ChartCard title="GMV by category" loading={loading} isEmpty={!data?.byCategory?.length}>
            <BarListChart
              data={(data?.byCategory ?? []).map((r) => ({ label: r.label, value: r.gmvPaise, secondary: r.units }))}
              format={money}
              secondaryFormat={(v) => `${num(v)} units`}
            />
          </ChartCard>
        </Col>
        <Col xs={24} lg={12}>
          <ChartCard title="Orders by channel" loading={loading} isEmpty={!data?.byChannel?.length}>
            <DonutChart data={(data?.byChannel ?? []).map((r) => ({ label: r.label, value: r.orders }))} format={num} />
          </ChartCard>
        </Col>
      </Row>
      <ChartCard title="Top cities by GMV" loading={loading} isEmpty={!data?.byCity?.length}>
        <BarListChart
          colorful
          data={(data?.byCity ?? []).map((r) => ({ label: r.label, value: r.gmvPaise, secondary: r.orders }))}
          format={money}
          secondaryFormat={(v) => `${num(v)} orders`}
        />
      </ChartCard>
    </Flex>
  ),

  customers: (t, data, loading) => (
    <Flex vertical gap={16}>
      <Tiles
        loading={loading}
        items={[
          { label: 'New customers', value: t.newCustomers },
          { label: 'Returning customers', value: t.returningCustomers },
          { label: 'Total customers', value: t.totalCustomers },
          { label: 'Avg lifetime GMV', valuePaise: t.avgGmvPaise, format: 'money' },
        ]}
      />
      <ChartCard title="Top cities by customers" loading={loading} isEmpty={!data?.topCities?.length}>
        <BarListChart
          colorful
          data={(data?.topCities ?? []).map((r) => ({ label: r.label, value: r.count, secondary: r.gmvPaise }))}
          format={num}
          secondaryFormat={money}
        />
      </ChartCard>
    </Flex>
  ),

  catalog: (t, data, loading) => (
    <Flex vertical gap={16}>
      <Tiles
        loading={loading}
        items={[
          { label: 'Live listings', value: t.liveListings },
          { label: 'In QC queue', value: t.qcQueueSize },
          { label: 'High-priority QC', value: t.qcHighPriority },
          { label: 'Out of stock', value: t.outOfStockPct, format: 'percent' },
        ]}
      />
      <ChartCard title="Live listings by category" loading={loading} isEmpty={!data?.byCategory?.length}>
        <BarListChart data={(data?.byCategory ?? []).map((r) => ({ label: r.label, value: r.count }))} format={num} />
      </ChartCard>
    </Flex>
  ),

  sellers: (t, data, loading) => (
    <Flex vertical gap={16}>
      <Tiles
        loading={loading}
        items={[
          { label: 'Active sellers', value: t.activeSellers },
          { label: 'Avg rating', value: t.avgRating, format: 'number' },
          { label: 'Avg cancellation', value: t.avgCancellationPct, format: 'percent' },
        ]}
      />
      <Row gutter={[12, 12]}>
        <Col xs={24} lg={12}>
          <ChartCard title="Sellers by status" loading={loading} isEmpty={!data?.onboardingFunnel?.length}>
            <DonutChart data={(data?.onboardingFunnel ?? []).map((r) => ({ label: r.label, value: r.count }))} format={num} />
          </ChartCard>
        </Col>
        <Col xs={24} lg={12}>
          <ChartCard title="Active sellers by tier" loading={loading} isEmpty={!data?.byTier?.length}>
            <BarListChart colorful data={(data?.byTier ?? []).map((r) => ({ label: r.label, value: r.count }))} format={num} />
          </ChartCard>
        </Col>
      </Row>
    </Flex>
  ),

  fulfilment: (t, data, loading) => (
    <Flex vertical gap={16}>
      <Tiles
        loading={loading}
        items={[
          { label: 'Shipments', value: t.shipments },
          { label: 'Delivered', value: t.deliveredPct, format: 'percent' },
          { label: 'NDR rate', value: t.ndrPct, format: 'percent' },
          { label: 'RTO rate', value: t.rtoPct, format: 'percent' },
        ]}
      />
      <ChartCard title="Shipments by courier" loading={loading} isEmpty={!data?.byCourier?.length} bodyPadding={0}>
        <Table
          size="small"
          pagination={false}
          rowKey="label"
          dataSource={data?.byCourier ?? []}
          columns={[
            { title: 'Courier', dataIndex: 'label' },
            { title: 'Shipments', dataIndex: 'count', align: 'right', render: (v) => <span className="tabular">{num(v)}</span> },
            { title: 'Undelivered (NDR)', dataIndex: 'ndrCount', align: 'right', render: (v) => <span className="tabular">{num(v)}</span> },
            {
              title: 'NDR %',
              align: 'right',
              render: (_, r) => <span className="tabular">{formatPercent(r.count ? (r.ndrCount / r.count) * 100 : 0)}</span>,
            },
          ]}
        />
      </ChartCard>
    </Flex>
  ),

  returns: (t, data, loading) => (
    <Flex vertical gap={16}>
      <Tiles
        loading={loading}
        items={[
          { label: 'Total returns', value: t.totalReturns },
          { label: 'Return rate', value: t.returnRatePct, format: 'percent' },
          { label: 'QC fail rate', value: t.qcFailPct, format: 'percent' },
          { label: 'Closed', value: t.closedCount },
        ]}
      />
      <Row gutter={[12, 12]}>
        <Col xs={24} lg={12}>
          <ChartCard title="Returns by reason" loading={loading} isEmpty={!data?.byReason?.length}>
            <BarListChart data={(data?.byReason ?? []).map((r) => ({ label: r.label, value: r.count }))} format={num} />
          </ChartCard>
        </Col>
        <Col xs={24} lg={12}>
          <ChartCard title="Returns by seller" loading={loading} isEmpty={!data?.bySeller?.length}>
            <BarListChart colorful data={(data?.bySeller ?? []).map((r) => ({ label: r.label, value: r.count }))} format={num} />
          </ChartCard>
        </Col>
      </Row>
    </Flex>
  ),

  finance: (t, _data, loading) => (
    <Flex vertical gap={16}>
      <Tiles
        loading={loading}
        items={[
          { label: 'Net revenue', valuePaise: t.netRevenuePaise, format: 'money' },
          { label: 'Commission', valuePaise: t.commissionPaise, format: 'money' },
          { label: 'Fees', valuePaise: t.feesPaise, format: 'money' },
          { label: 'Ads revenue', valuePaise: t.adsRevenuePaise, format: 'money' },
          { label: 'Refunds', valuePaise: t.refundsPaise, format: 'money' },
          { label: 'Payouts paid', valuePaise: t.payoutsPaidPaise, format: 'money' },
          { label: 'COD outstanding', valuePaise: t.codOutstandingPaise, format: 'money' },
        ]}
      />
      <ChartCard title="Revenue composition" loading={loading} isEmpty={!t.netRevenuePaise}>
        <DonutChart
          data={[
            { label: 'Commission', value: t.commissionPaise ?? 0 },
            { label: 'Fees', value: t.feesPaise ?? 0 },
            { label: 'Ads', value: t.adsRevenuePaise ?? 0 },
          ]}
          format={money}
        />
      </ChartCard>
    </Flex>
  ),

  marketing: (t, data, loading) => (
    <Flex vertical gap={16}>
      <Tiles
        loading={loading}
        items={[
          { label: 'Coupon redemptions', value: t.couponRedemptions },
          { label: 'Discount given', valuePaise: t.couponDiscountGivenPaise, format: 'money' },
          { label: 'Coupon-driven GMV', valuePaise: t.couponNetGmvPaise, format: 'money' },
          { label: 'Flash sale GMV', valuePaise: t.flashSaleGmvPaise, format: 'money' },
        ]}
      />
      <Row gutter={[12, 12]}>
        <Col xs={24} lg={16}>
          <ChartCard title="Campaign performance" loading={loading} isEmpty={!data?.campaignPerformance?.length} bodyPadding={0}>
            <Table
              size="small"
              pagination={false}
              rowKey="label"
              dataSource={data?.campaignPerformance ?? []}
              columns={[
                { title: 'Campaign', dataIndex: 'label' },
                { title: 'Sent', dataIndex: 'sent', align: 'right', render: (v) => <span className="tabular">{num(v)}</span> },
                { title: 'Open rate', dataIndex: 'openRatePct', align: 'right', render: (v) => <span className="tabular">{formatPercent(v)}</span> },
                { title: 'Click rate', dataIndex: 'clickRatePct', align: 'right', render: (v) => <span className="tabular">{formatPercent(v)}</span> },
              ]}
            />
          </ChartCard>
        </Col>
        <Col xs={24} lg={8}>
          <ChartCard title="Referral funnel" loading={loading} isEmpty={!data?.referralFunnel?.length}>
            <DonutChart data={(data?.referralFunnel ?? []).map((r) => ({ label: r.label, value: r.count }))} format={num} />
          </ChartCard>
        </Col>
      </Row>
    </Flex>
  ),

  support: (t, data, loading) => (
    <Flex vertical gap={16}>
      <Tiles
        loading={loading}
        items={[
          { label: 'Ticket volume', value: t.ticketVolume },
          { label: 'Avg first response (min)', value: t.avgFirstResponseMins, format: 'number' },
          { label: 'Avg resolution (hrs)', value: t.avgResolutionHrs, format: 'number' },
          { label: 'Avg CSAT', value: t.avgCsat ?? 0, format: 'number' },
          { label: 'Contact rate', value: t.contactRatePct, format: 'percent' },
        ]}
      />
      <ChartCard title="Tickets by channel" loading={loading} isEmpty={!data?.byChannel?.length}>
        <DonutChart data={(data?.byChannel ?? []).map((r) => ({ label: r.label, value: r.count }))} format={num} />
      </ChartCard>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        First response is shown in minutes; resolution in hours.
      </Typography.Text>
    </Flex>
  ),
};
