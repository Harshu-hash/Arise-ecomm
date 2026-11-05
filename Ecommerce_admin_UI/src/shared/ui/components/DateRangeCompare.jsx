import { Checkbox, DatePicker, Space } from 'antd';
import dayjs from 'dayjs';

export default function DateRangeCompare({ value, onChange, allowCompare = true, presets }) {
  const range = value?.from && value?.to ? [dayjs(value.from), dayjs(value.to)] : null;
  return (
    <Space wrap>
      <DatePicker.RangePicker value={range} presets={presets} allowClear={false} onChange={(dates) => { if (!dates) return; onChange?.({ ...value, from: dates[0].startOf('day').toISOString(), to: dates[1].endOf('day').toISOString() }); }} />
      {allowCompare && <Checkbox checked={Boolean(value?.compare)} onChange={(event) => onChange?.({ ...value, compare: event.target.checked })}>Compare previous period</Checkbox>}
    </Space>
  );
}
