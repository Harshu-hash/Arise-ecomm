import { TagFilled } from '@ant-design/icons';
import { Tag, Tooltip } from 'antd';
import { formatINR } from '@core/utils/money';

/** Marks a product/variant whose current selling price comes from a running campaign. `campaign` = { name, extraOffPct, pricePaise } or null. */
export default function CampaignTag({ campaign }) {
  if (!campaign) return null;
  return (
    <Tooltip title={`Customers currently pay ${formatINR(campaign.pricePaise)} because of this campaign.`}>
      <Tag color="magenta" icon={<TagFilled />} style={{ marginInlineEnd: 0 }}>
        Extra {campaign.extraOffPct}% off · {campaign.name} · {formatINR(campaign.pricePaise)}
      </Tag>
    </Tooltip>
  );
}
