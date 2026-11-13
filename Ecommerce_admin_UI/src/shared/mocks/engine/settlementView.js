import { db, findById } from '../db/store';
import {
  computeChecks,
  deductionsTotal,
  isReturnOpen,
  quotedPaise,
  resolveState,
  settledPaise,
} from './settlementFlow';

/**
 * Turns a raw settlement line into the shape the settlement screens consume,
 * shared by the admin console and the seller's own view so both read one truth.
 */
export function enrichSettlement(line, now) {
  const item = findById('orderItems', line.orderItemId);
  const order = findById('orders', line.orderId);
  const seller = findById('sellers', line.sellerId);
  const returnOpen = isReturnOpen(db.returns, line.orderItemId);
  const checks = computeChecks({ line, item, seller, returnOpen, now });
  const state = resolveState(line, checks);

  return {
    // The whole settlement line verbatim (full fee/tax breakdown), so money
    // reconciliation reads the same fields it always did.
    ...line,
    qty: item?.qty ?? 1,
    customerName: order?.customerName ?? '',
    // Settlement flow.
    quotedPaise: quotedPaise(line),
    deductions: line.deductions ?? {},
    deductionsTotalPaise: deductionsTotal(line),
    settledPaise: settledPaise(line),
    reviewed: Boolean(line.reviewed),
    mode: line.mode ?? null,
    txnNo: line.txnNo ?? '',
    utr: line.utr ?? '',
    invoiceNo: line.invoiceNo ?? '',
    settledAt: line.settledAt ?? null,
    failureReason: line.failureReason ?? '',
    manualHold: Boolean(line.manualHold),
    returnWindowEndsAt: item?.returnWindowEndsAt ?? null,
    returnWindowDays: item?.returnWindowDays ?? 0,
    state,
    ready: checks.ready,
    settled: Boolean(line.settledAt),
    dots: checks.dots,
  };
}

/** The seller-facing settlement invoice for one settled line. */
export function buildSettlementInvoice(line) {
  const view = enrichSettlement(line, Date.now());
  return {
    invoiceNo: line.invoiceNo ?? '',
    orderId: line.orderId,
    orderItemId: line.orderItemId,
    sellerName: line.sellerName,
    productTitle: line.productTitle,
    sku: line.sku,
    qty: view.qty,
    deliveredAt: line.deliveredAt,
    paidAt: line.settledAt ?? null,
    paymentMethod: line.paymentMethod,
    fulfillmentType: line.fulfillmentType,
    money: {
      salePaise: line.salePaise,
      commissionPaise: line.commissionPaise,
      feesBeforeTaxPaise: line.feesBeforeTaxPaise,
      gstOnFeesPaise: line.gstOnFeesPaise,
      tcsPaise: line.tcsPaise,
      tdsPaise: line.tdsPaise,
    },
    quotedPaise: view.quotedPaise,
    deductions: view.deductions,
    deductionsTotalPaise: view.deductionsTotalPaise,
    settledPaise: view.settledPaise,
    txnNo: line.txnNo ?? '',
    utr: line.utr ?? '',
    mode: line.mode ?? null,
    bulkRef: line.bulkRef ?? '',
  };
}
