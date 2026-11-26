import { DollarOutlined, RiseOutlined, ShoppingOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { AUTH_CSS, card, muted } from '@ui/components/AuthShowcase';
import { SELLER_ACCENT } from '@seller/theme';

export const SELLER_CHIPS = [
  [<ShoppingOutlined key="a" />, 'List products'],
  [<ThunderboltOutlined key="b" />, 'Fast shipping'],
  [<DollarOutlined key="c" />, 'Weekly payouts'],
  [<RiseOutlined key="d" />, 'Growth tools'],
];

const ORDERS = [
  ['Wireless Earbuds', 'New', '#22C55E', '₹1,799'],
  ['Cotton Kurta Set', 'Packed', '#F59E0B', '₹1,249'],
  ['Steel Water Bottle', 'Shipped', '#38BDF8', '₹549'],
];

/** Decorative seller-dashboard collage (sample figures, not live data). */
export default function SellerShowcase() {
  return (
    <div aria-hidden style={{ position: 'relative', height: 430, margin: '8px 0' }}>
      <style>{AUTH_CSS}</style>
      <div className="ar-float" style={{ ...card, position: 'absolute', top: 40, left: 0, width: 330, padding: 18 }}>
        <div style={muted}>Your sales this week</div>
        <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.3 }}>
          ₹84,250 <span style={{ fontSize: 13, color: '#22C55E', fontWeight: 600 }}>▲ 24%</span>
        </div>
        <svg viewBox="0 0 300 80" width="100%" height="80" style={{ marginTop: 6 }}>
          {[28, 44, 36, 58, 50, 70, 78].map((h, i) => (
            <rect
              key={i}
              className="ar-anim"
              x={6 + i * 42}
              y={80 - h}
              width="26"
              height={h}
              rx="5"
              fill={SELLER_ACCENT}
              opacity={0.35 + i * 0.09}
              style={{ transformOrigin: `${19 + i * 42}px 80px`, animation: `ar-grow .8s ${0.2 + i * 0.1}s both` }}
            />
          ))}
        </svg>
      </div>

      <div className="ar-float" style={{ ...card, animationDelay: '.2s, 1s', position: 'absolute', top: 215, right: 0, width: 300, padding: 16 }}>
        <div style={{ ...muted, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="ar-live" style={{ width: 8, height: 8, borderRadius: 8, background: '#22C55E' }} />
          New orders
        </div>
        {ORDERS.map(([name, status, color, amt], i) => (
          <div
            key={name}
            className="ar-row"
            style={{ animationDelay: `${0.6 + i * 0.25}s`, display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderTop: '1px solid #27272A', fontSize: 13 }}
          >
            <span style={{ width: 8, height: 8, borderRadius: 8, background: color }} />
            <span style={{ flex: 1 }}>{name}</span>
            <span style={{ ...muted, color }}>{status}</span>
            <strong>{amt}</strong>
          </div>
        ))}
      </div>

      <div className="ar-float" style={{ ...card, animationDelay: '.4s, 2s', position: 'absolute', bottom: 8, left: 24, padding: '12px 16px' }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>★ 4.8 store rating</div>
        <div style={muted}>1,240 happy customers</div>
      </div>

      <div className="ar-float" style={{ ...card, animationDelay: '.6s, 3s', position: 'absolute', bottom: 0, right: 40, padding: '10px 14px', fontSize: 13 }}>
        <DollarOutlined style={{ color: SELLER_ACCENT, marginRight: 8 }} />
        Payout ₹62,400 on the way
      </div>
    </div>
  );
}
