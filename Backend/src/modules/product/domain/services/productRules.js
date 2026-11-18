/**
 * Pure rules for turning a seller's "add product" request into the variant/offer
 * rows it will become. No I/O here — everything is unit-testable without Mongo.
 */

/** Simple-product fields live at the top level; a variant category sends `variants[]` instead. */
export function buildVariantSpecs(body) {
  if (Array.isArray(body.variants) && body.variants.length) {
    return body.variants.map((v) => ({
      attributes: v.attributes ?? {},
      label: v.label ?? null,
      sku: v.sku ? String(v.sku).trim() : null,
      sellerSku: (v.sellerSku ?? v.sku) ? String(v.sellerSku ?? v.sku).trim() : null,
      barcode: (v.barcode ?? v.ean) ? String(v.barcode ?? v.ean).trim() : null,
      taxCode: v.taxCode ? String(v.taxCode).trim() : null,
      mrpPaise: v.mrpPaise ?? null,
      sellingPricePaise: v.sellingPricePaise ?? null,
      stock: v.stock ?? 0,
      weightG: v.weightG ?? 500,
      dimsCm: v.dimsCm ?? { l: 20, w: 15, h: 5 },
      images: v.images ?? [],
    }));
  }
  return [
    {
      attributes: {},
      label: null,
      sku: null,
      sellerSku: null,
      barcode: body.barcode ? String(body.barcode).trim() : null,
      taxCode: null,
      mrpPaise: body.mrpPaise ?? null,
      sellingPricePaise: body.sellingPricePaise ?? null,
      stock: body.stock ?? 0,
      weightG: body.weightG ?? 500,
      dimsCm: body.dimsCm ?? { l: 20, w: 15, h: 5 },
      images: [],
    },
  ];
}

/** MRP/selling-price are required, and price may never exceed MRP — waived only for a draft. */
export function validatePricing(specs, isDraft) {
  if (isDraft) return {};
  const errors = {};
  specs.forEach((spec, i) => {
    const tag = specs.length > 1 ? ` (variant ${i + 1})` : '';
    if (!spec.mrpPaise || spec.mrpPaise <= 0) errors.mrpPaise = [`Enter the MRP${tag}.`];
    if (!spec.sellingPricePaise || spec.sellingPricePaise <= 0) errors.sellingPricePaise = [`Enter a selling price${tag}.`];
    if (spec.sellingPricePaise && spec.mrpPaise && spec.sellingPricePaise > spec.mrpPaise) {
      errors.sellingPricePaise = [`Selling price cannot exceed MRP${tag}.`];
    }
  });
  return errors;
}

export const variantDefiningCodes = (attributeDefs) => attributeDefs.filter((a) => a.variantDefining).map((a) => a.code);

/** Every spec must carry a value for each variant-defining attribute, and no two may collide. */
export function validateVariantCombinations(specs, variantCodes) {
  if (!variantCodes.length) return {};
  const seen = new Set();
  for (const [i, spec] of specs.entries()) {
    const missing = variantCodes.filter((code) => !spec.attributes?.[code]);
    if (missing.length) return { variants: [`Variant ${i + 1} is missing ${missing.join(', ')}.`] };
    const key = variantCodes.map((code) => spec.attributes[code]).join('|');
    if (seen.has(key)) return { variants: [`Variant ${i + 1} duplicates another variant's options.`] };
    seen.add(key);
  }
  return {};
}

/** A spec's attribute values must be among the category's active options for that attribute. */
export function validateVariantAttributeValues(specs, variantDefs) {
  const byCode = new Map(variantDefs.map((a) => [a.code, a]));
  for (const [i, spec] of specs.entries()) {
    for (const [code, raw] of Object.entries(spec.attributes ?? {})) {
      const def = byCode.get(code);
      if (!def) return { variants: [`Variant ${i + 1} has an attribute that is not part of this category.`] };
      const value = String(raw ?? '').trim();
      const allowed = (def.values ?? []).filter((v) => v.active).map((v) => v.value);
      if (allowed.length && !allowed.includes(value)) return { variants: [`Variant ${i + 1}: choose a valid ${def.name}.`] };
    }
  }
  return {};
}

/**
 * Plain (non-variant-defining) category attributes submitted at the product level.
 * Unknown codes and values outside a closed option list are rejected; everything
 * else is trimmed and kept as-is.
 */
export function validateProductAttributeValues(submitted, attributeDefs) {
  const byCode = new Map(attributeDefs.map((a) => [a.code, a]));
  const clean = {};
  for (const [code, raw] of Object.entries(submitted ?? {})) {
    const def = byCode.get(code);
    if (!def) return { errors: { attributes: [`"${code}" is not an attribute of this category.`] }, clean: null };
    const value = String(raw ?? '').trim();
    if (!value) continue;
    const allowed = (def.values ?? []).filter((v) => v.active).map((v) => v.value);
    if (allowed.length && !allowed.includes(value)) {
      return { errors: { attributes: [`Choose a valid ${def.name}.`] }, clean: null };
    }
    if (def.type === 'NUMBER' && Number.isNaN(Number(value))) {
      return { errors: { attributes: [`${def.name} must be a number.`] }, clean: null };
    }
    clean[code] = value;
  }
  return { errors: {}, clean };
}

/** `SKU-<productId>-<n>`, unless the seller supplied their own (still trimmed/upper-cased). */
export function generateSku({ custom, brandName, productId, index }) {
  if (custom) return custom.toUpperCase();
  const prefix = (brandName || 'SKU').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'SKU';
  return `${prefix}-${productId}-${index + 1}`;
}
