const DAY_MS = 86_400_000;

function utcDay(value) {
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function bannerAdPrice({ startsOn, endsOn, dailyRatePaise, gstPct = 18 }) {
  const start = utcDay(startsOn);
  const end = utcDay(endsOn);
  const rate = Number(dailyRatePaise);
  if (start === null || end === null || end < start || !Number.isInteger(rate) || rate <= 0) return null;
  const days = Math.floor((end - start) / DAY_MS) + 1;
  const subtotalPaise = days * rate;
  const gstPaise = Math.round(subtotalPaise * (gstPct / 100));
  return { days, dailyRatePaise: rate, subtotalPaise, gstPct, gstPaise, totalPaise: subtotalPaise + gstPaise };
}

export function bannerAdDisplayStatus(booking, today = new Date().toISOString().slice(0, 10)) {
  if (booking.status !== 'APPROVED') return booking.status;
  if (today < booking.startsOn) return 'SCHEDULED';
  if (today > booking.endsOn) return 'COMPLETED';
  return 'LIVE';
}
