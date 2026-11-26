import {
  CarOutlined,
  CheckCircleFilled,
  SafetyCertificateOutlined,
  ShopOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { CHROME } from '@theme/tokens';

const CSS = `
@keyframes ar-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-10px) } }
@keyframes ar-grow { from { transform: scaleY(0) } to { transform: scaleY(1) } }
@keyframes ar-in { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }
@keyframes ar-draw { from { stroke-dashoffset: 700 } to { stroke-dashoffset: 0 } }
@keyframes ar-spin { to { transform: rotate(360deg) } }
@keyframes ar-pulse { 0% { box-shadow: 0 0 0 0 rgba(34,197,94,.6) } 100% { box-shadow: 0 0 0 9px rgba(34,197,94,0) } }
@keyframes ar-glow { 0%,100% { opacity: .55; transform: scale(1) } 50% { opacity: .95; transform: scale(1.12) } }
@keyframes ar-orb { 0%,100% { transform: translate(0,0) } 50% { transform: translate(40px,-30px) } }
@keyframes ar-shine { from { transform: translateX(-120%) } to { transform: translateX(220%) } }
.ar-float { animation: ar-in .7s both, ar-float 6s ease-in-out infinite; }
.ar-live { animation: ar-pulse 1.6s infinite; }
.ar-row { animation: ar-in .5s both; }
.ar-primary-btn { position: relative; overflow: hidden; }
.ar-primary-btn::after { content: ''; position: absolute; inset: 0; width: 40%; background: linear-gradient(100deg, transparent, rgba(255,255,255,.55), transparent); animation: ar-shine 3.2s ease-in-out infinite; pointer-events: none; }
@media (prefers-reduced-motion: reduce) { .ar-float, .ar-row, .ar-live, .ar-primary-btn::after, .ar-anim { animation: none !important } }
`;

export const card = {
  background: 'rgba(24,24,27,0.82)',
  border: `1px solid ${CHROME.border}`,
  borderRadius: 14,
  backdropFilter: 'blur(8px)',
  boxShadow: '0 20px 50px rgba(0,0,0,0.45)',
  color: '#fff',
};
export const AUTH_CSS = CSS;
export const muted = { color: CHROME.text, fontSize: 12 };

const ORDERS = [
  ['#AR-20418', 'Shipped', '#22C55E', '₹2,499'],
  ['#AR-20417', 'Packed', CHROME.accent, '₹899'],
  ['#AR-20416', 'Delivered', '#38BDF8', '₹5,120'],
];

const CHIPS = [
  [<ShopOutlined key="s" />, 'Sellers'],
  [<CarOutlined key="c" />, 'Fulfilment'],
  [<WalletOutlined key="w" />, 'Payouts'],
  [<SafetyCertificateOutlined key="x" />, 'Audit logs'],
];

/** Decorative marketplace dashboard collage (sample figures, not live data). */
export default function AuthShowcase() {
  return (
    <div aria-hidden style={{ position: 'relative', height: 430, margin: '8px 0' }}>
      <style>{CSS}</style>
      {/* revenue card */}
      <div className="ar-float" style={{ ...card, position: 'absolute', top: 40, left: 0, width: 330, padding: 18 }}>
        <div style={muted}>Today&apos;s GMV</div>
        <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.3 }}>
          ₹12.4L <span style={{ fontSize: 13, color: '#22C55E', fontWeight: 600 }}>▲ 18.2%</span>
        </div>
        <svg viewBox="0 0 300 80" width="100%" height="80" style={{ marginTop: 6 }}>
          <defs>
            <linearGradient id="gmv" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={CHROME.accent} stopOpacity="0.45" />
              <stop offset="1" stopColor={CHROME.accent} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0 62 C30 58 40 30 70 38 S110 66 140 44 S190 8 220 22 S270 30 300 6 V80 H0Z" fill="url(#gmv)" />
          <path d="M0 62 C30 58 40 30 70 38 S110 66 140 44 S190 8 220 22 S270 30 300 6" fill="none" stroke={CHROME.accent} strokeWidth="2.5" strokeLinecap="round" strokeDasharray="700" className="ar-anim" style={{ animation: 'ar-draw 2.2s ease-out both' }} />
        </svg>
      </div>

      {/* orders card */}
      <div className="ar-float" style={{ ...card, animationDelay: '.2s, 1s', position: 'absolute', top: 215, right: 0, width: 300, padding: 16 }}>
        <div style={{ ...muted, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}><span className="ar-live" style={{ width: 8, height: 8, borderRadius: 8, background: '#22C55E' }} />Live orders</div>
        {ORDERS.map(([id, status, color, amt], i) => (
          <div key={id} className="ar-row" style={{ animationDelay: `${0.6 + i * 0.25}s`, display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderTop: `1px solid ${CHROME.border}`, fontSize: 13 }}>
            <span style={{ width: 8, height: 8, borderRadius: 8, background: color }} />
            <span style={{ flex: 1 }}>{id}</span>
            <span style={{ ...muted, color }}>{status}</span>
            <strong>{amt}</strong>
          </div>
        ))}
      </div>

      {/* sellers pill */}
      <div className="ar-float" style={{ ...card, animationDelay: '.4s, 2s', position: 'absolute', bottom: 8, left: 24, padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'center' }}>
        <CheckCircleFilled style={{ fontSize: 24, color: '#22C55E' }} />
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>128 sellers verified</div>
          <div style={muted}>3 awaiting approval</div>
        </div>
      </div>

      {/* payout chip */}
      <div className="ar-float" style={{ ...card, animationDelay: '.6s, 3s', position: 'absolute', bottom: 0, right: 40, padding: '10px 14px', fontSize: 13 }}>
        <WalletOutlined style={{ color: CHROME.accent, marginRight: 8 }} />
        Payout ₹4.8L settled
      </div>
    </div>
  );
}

export function FeatureChips({ items = CHIPS }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {items.map(([icon, label]) => (
        <span key={label} style={{ padding: '6px 12px', borderRadius: 999, fontSize: 13, color: '#E4E4E7', border: `1px solid ${CHROME.border}`, background: 'rgba(255,255,255,0.04)' }}>
          <span style={{ color: CHROME.accent, marginRight: 6 }}>{icon}</span>
          {label}
        </span>
      ))}
    </div>
  );
}
