import { describe, expect, it } from 'vitest';
import { bannerAdDisplayStatus, bannerAdPrice } from './bannerAds';

describe('banner ad pricing', () => {
  it('charges every selected calendar day and adds GST in paise', () => {
    expect(bannerAdPrice({ startsOn: '2026-11-20', endsOn: '2026-11-22', dailyRatePaise: 150000 })).toEqual({
      days: 3, dailyRatePaise: 150000, subtotalPaise: 450000, gstPct: 18, gstPaise: 81000, totalPaise: 531000,
    });
  });

  it('rejects reversed ranges and derives approved schedule states', () => {
    expect(bannerAdPrice({ startsOn: '2026-11-22', endsOn: '2026-11-20', dailyRatePaise: 150000 })).toBeNull();
    const booking = { status: 'APPROVED', startsOn: '2026-11-20', endsOn: '2026-11-22' };
    expect(bannerAdDisplayStatus(booking, '2026-11-19')).toBe('SCHEDULED');
    expect(bannerAdDisplayStatus(booking, '2026-11-21')).toBe('LIVE');
    expect(bannerAdDisplayStatus(booking, '2026-11-23')).toBe('COMPLETED');
  });
});
