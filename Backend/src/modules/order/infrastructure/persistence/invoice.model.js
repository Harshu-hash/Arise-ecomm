import mongoose from 'mongoose';

// A tax document is a legal snapshot: written once, never edited. An INVOICE is the seller's invoice (kind GOODS, one per
// parcel) or Arise's invoice for its platform fee (kind PLATFORM_FEE, one per order). A CREDIT_NOTE reverses one invoice.
// A wrong invoice is superseded (credit note + a new invoice), never changed. `key` makes issuing idempotent.
const invoiceSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, immutable: true },
    docType: { type: String, enum: ['INVOICE', 'CREDIT_NOTE'], required: true },
    kind: { type: String, enum: ['GOODS', 'PLATFORM_FEE'], required: true },
    number: { type: String, required: true, immutable: true },
    supplierKey: { type: String, required: true }, // the seller id, or ARISE: numbers are unique and gapless per supplier
    fy: String,
    taxable: { type: Boolean, default: true }, // false = bill of supply (supplier has no GSTIN, no GST is charged)
    orderId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    orderNumber: String,
    subOrderId: { type: mongoose.Schema.Types.ObjectId, default: null },
    sellerId: { type: String, default: null },
    customerId: { type: String, required: true, index: true },
    issuedAt: { type: Date, default: Date.now },
    supplier: { name: String, gstin: String, address: String, state: String },
    buyer: { name: String, address: String, state: String, pincode: String },
    intraState: Boolean,
    lines: [{ _id: false, description: String, hsn: String, quantity: Number, gstRate: Number, paidPaise: Number, taxablePaise: Number, cgstPaise: Number, sgstPaise: Number, igstPaise: Number }],
    totals: { taxablePaise: Number, cgstPaise: Number, sgstPaise: Number, igstPaise: Number, totalPaise: Number },
    refInvoiceId: { type: mongoose.Schema.Types.ObjectId, default: null }, // credit notes: the invoice reversed
    refNumber: { type: String, default: null },
    reason: { type: String, default: null },
    supersededBy: { type: mongoose.Schema.Types.ObjectId, default: null }, // invoices: the replacement issued after a correction
  },
  { collection: 'invoices', timestamps: true, versionKey: false },
);

invoiceSchema.index({ supplierKey: 1, number: 1 }, { unique: true });
invoiceSchema.index({ sellerId: 1, issuedAt: -1 });
invoiceSchema.index({ subOrderId: 1 });

const counterSchema = new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } }, { collection: 'counters', versionKey: false });

export const Invoice = mongoose.models.Invoice ?? mongoose.model('Invoice', invoiceSchema);
export const Counter = mongoose.models.Counter ?? mongoose.model('Counter', counterSchema);
