import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const CartContext = createContext(null);

const MIN_QTY = 1;
const MAX_QTY = 10;

export const SEED_CART_ITEMS = [
  {
    id: 'c1',
    name: 'LIFE FIT radhe radhe Diary Collection Notebook | Free Stickers A5 Diary Unruled 150 Pages',
    variant: 'Multicolour',
    rating: 5.0,
    ratingCount: 3,
    assured: true,
    qty: 1,
    price: 298,
    mrp: 795,
    deliveryDate: 'Aug 28, Fri',
    image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=400&q=80',
  },
];

/**
 * Mounted at the app root so Cart and Checkout read the same items/coupon —
 * previously each screen kept its own local copy, so a coupon applied in
 * Checkout (or an item moved to Cart) never reflected back in the other screen.
 */
export const CartProvider = ({ children, initialItems = [] }) => {
  const [items, setItems] = useState(initialItems);
  const [savedForLater, setSavedForLater] = useState([]);
  const [appliedCoupon, setAppliedCoupon] = useState(null);

  const addItem = useCallback((item) => {
    setItems((prev) => (prev.some((i) => i.id === item.id) ? prev : [...prev, item]));
  }, []);

  const removeItem = useCallback((id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const changeQty = useCallback((id, delta) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, qty: Math.min(MAX_QTY, Math.max(MIN_QTY, item.qty + delta)) } : item
      )
    );
  }, []);

  const moveToSaved = useCallback((id) => {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item) setSavedForLater((saved) => (saved.some((s) => s.id === id) ? saved : [...saved, item]));
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const moveToCart = useCallback((id) => {
    setSavedForLater((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item) setItems((cartItems) => (cartItems.some((c) => c.id === id) ? cartItems : [...cartItems, item]));
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const applyCoupon = useCallback((coupon) => setAppliedCoupon(coupon), []);
  const clearCoupon = useCallback(() => setAppliedCoupon(null), []);

  const value = useMemo(
    () => ({
      items,
      savedForLater,
      appliedCoupon,
      addItem,
      removeItem,
      changeQty,
      moveToSaved,
      moveToCart,
      applyCoupon,
      clearCoupon,
    }),
    [items, savedForLater, appliedCoupon, addItem, removeItem, changeQty, moveToSaved, moveToCart, applyCoupon, clearCoupon]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => useContext(CartContext);
