/**
 * The cards under a variant option (storage, RAM/ROM, ...): one per value, showing what the shopper would pay for it.
 * Each card prices the variant that value gives with everything else already picked (colour, size, the other options);
 * if several sellers' variants fit, the cheapest. A value no variant fits is still listed, without a price.
 */
export function optionCards(variants, option, { selectedOptions = {}, selectedColor = null, selectedSize = null, options = [] } = {}) {
  return option.values.map(value => {
    const fits = variants.filter(
      v =>
        v.attributes?.[option.code] === value &&
        options.every(other => other.code === option.code || v.attributes?.[other.code] === selectedOptions[other.code]) &&
        (!v.color || !selectedColor || v.color === selectedColor) &&
        (!selectedSize || !v.size || v.size === selectedSize),
    );
    const best = fits.reduce((cheapest, v) => (!cheapest || v.price < cheapest.price ? v : cheapest), null);
    if (!best) return { value, price: null, mrp: null, discountPct: 0, inStock: false };
    return {
      value,
      price: best.price,
      mrp: best.mrp,
      discountPct: best.mrp > best.price ? Math.round(((best.mrp - best.price) / best.mrp) * 100) : 0,
      inStock: fits.some(v => v.stock > 0),
    };
  });
}
