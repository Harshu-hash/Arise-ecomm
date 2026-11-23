import { inclusiveGst } from './orderMoney.js';

// Pure invoice maths. Prices already include GST, so taxable value = paid - GST; GST is split CGST+SGST inside one state
// and IGST across states (the supplier's state vs the delivery state).

const norm = (state) => String(state ?? '').trim().toLowerCase();
export const isIntraState = (supplierState, deliveryState) => !!norm(supplierState) && norm(supplierState) === norm(deliveryState);

/** Indian financial year (April-March) of a date in IST, e.g. "2026-27". */
export function financialYear(date) {
  const ist = new Date(date.getTime() + 19_800_000);
  const start = ist.getUTCMonth() >= 3 ? ist.getUTCFullYear() : ist.getUTCFullYear() - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}

/** One invoice line from what was paid for it (GST included). The CGST/SGST/IGST parts always add up to the GST. */
export function taxLine({ description, hsn, quantity = 1, paidPaise, gstRate, gstPaise = inclusiveGst(paidPaise, gstRate), intra }) {
  const half = Math.floor(gstPaise / 2);
  return {
    description, hsn, quantity, gstRate, paidPaise,
    taxablePaise: paidPaise - gstPaise,
    cgstPaise: intra ? half : 0,
    sgstPaise: intra ? gstPaise - half : 0,
    igstPaise: intra ? 0 : gstPaise,
  };
}

export function totalsOf(lines) {
  const sum = (key) => lines.reduce((total, line) => total + line[key], 0);
  return { taxablePaise: sum('taxablePaise'), cgstPaise: sum('cgstPaise'), sgstPaise: sum('sgstPaise'), igstPaise: sum('igstPaise'), totalPaise: sum('paidPaise') };
}
