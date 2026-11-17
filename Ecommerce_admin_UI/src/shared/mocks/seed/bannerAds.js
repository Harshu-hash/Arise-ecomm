import { bannerAdPrice } from '@core/utils/bannerAds';
import { db, id, insert } from '../db/store';
import { mockNowIso } from '../engine/settings';

export function seedBannerAdPlacements() {
  return [
    ['Customer app shop banner', 'One responsive shop promotion slot', 150000, 1440, 480, 1080, 1080],
  ].map(([name, description, dailyRatePaise, desktopWidth, desktopHeight, mobileWidth, mobileHeight]) => insert('bannerAdPlacements', {
    id: id('BAP', 3), name, description, dailyRatePaise, desktopWidth, desktopHeight,
    mobileWidth, mobileHeight, enabled: true, updatedAt: mockNowIso(), version: 1,
  }));
}

export function seedBannerAdBookings() {
  const placement = db.bannerAdPlacements[0];
  const seller = db.sellers.find((row) => row.status === 'ACTIVE');
  if (!placement || !seller) return [];
  const price = bannerAdPrice({ startsOn: '2026-11-20', endsOn: '2026-11-24', dailyRatePaise: placement.dailyRatePaise });
  return [insert('bannerAdBookings', {
    id: id('BAD', 5), sellerId: seller.id, sellerName: seller.storeName,
    campaignName: 'Winter shop showcase', placementId: placement.id, placementName: placement.name,
    destinationType: 'SHOP', destinationValue: seller.id, startsOn: '2026-11-20', endsOn: '2026-11-24',
    desktopCreative: { mediaId: null, previewUrl: 'https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=1200&q=80', fileName: 'winter-desktop.jpg' },
    mobileCreative: { mediaId: null, previewUrl: 'https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=700&q=80', fileName: 'winter-mobile.jpg' },
    ...price, status: 'PENDING_REVIEW', paymentStatus: 'PAID', paymentReference: 'MOCK-PAY-1001',
    paidAt: mockNowIso(), submittedAt: mockNowIso(), rejectionReason: null, decidedAt: null,
    impressions: 0, clicks: 0, createdAt: mockNowIso(), version: 1,
  })];
}
