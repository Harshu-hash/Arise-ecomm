import { optionCards } from './optionCards';

const phone = (storage, colour, price, mrp, stock = 5) => ({ attributes: { storage }, color: colour, size: null, price, mrp, stock });
const storage = { code: 'storage', name: 'Storage', values: ['128 GB', '256 GB'] };
const variants = [
  phone('128 GB', 'Blue', 70999, 104999),
  phone('256 GB', 'Blue', 77999, 114999),
  phone('128 GB', 'Silver', 72999, 104999),
  phone('256 GB', 'Silver', 79999, 114999, 0),
];

describe('optionCards', () => {
  it('prices each value with its discount, for the colour picked', () => {
    const cards = optionCards(variants, storage, { selectedColor: 'Blue', options: [storage] });
    expect(cards).toEqual([
      { value: '128 GB', price: 70999, mrp: 104999, discountPct: 32, inStock: true },
      { value: '256 GB', price: 77999, mrp: 114999, discountPct: 32, inStock: true },
    ]);
  });

  it('follows the colour, and says when a value is out of stock', () => {
    const cards = optionCards(variants, storage, { selectedColor: 'Silver', options: [storage] });
    expect(cards.map(card => card.price)).toEqual([72999, 79999]);
    expect(cards[1].inStock).toBe(false);
  });

  it('takes the cheapest when several variants fit, and no discount when the price equals the MRP', () => {
    const two = [phone('128 GB', 'Blue', 90000, 90000), phone('128 GB', 'Blue', 85000, 90000)];
    expect(optionCards(two, storage, { options: [storage] })[0]).toMatchObject({ price: 85000, discountPct: 6 });
    expect(optionCards([phone('128 GB', 'Blue', 5000, 5000)], storage, { options: [storage] })[0].discountPct).toBe(0);
  });

  it('keeps a value nobody sells, without a price', () => {
    const cards = optionCards([phone('128 GB', 'Blue', 70999, 104999)], storage, { options: [storage] });
    expect(cards[1]).toEqual({ value: '256 GB', price: null, mrp: null, discountPct: 0, inStock: false });
  });

  it('respects the other options already picked', () => {
    const ram = { code: 'ram', name: 'RAM', values: ['8 GB', '12 GB'] };
    const both = [
      { attributes: { storage: '128 GB', ram: '8 GB' }, color: null, size: null, price: 50000, mrp: 60000, stock: 1 },
      { attributes: { storage: '128 GB', ram: '12 GB' }, color: null, size: null, price: 55000, mrp: 60000, stock: 1 },
    ];
    expect(optionCards(both, storage, { selectedOptions: { ram: '12 GB' }, options: [storage, ram] })[0].price).toBe(55000);
  });
});
