import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface CartItem { id: string; name: string; price: number; image_url?: string; quantity: number; }
interface CartCtx { items: CartItem[]; add: (item: Omit<CartItem,"quantity">) => void; remove: (id: string) => void; update: (id: string, qty: number) => void; clear: () => void; total: number; count: number; }

const CartContext = createContext<CartCtx>({} as CartCtx);
export const useCart = () => useContext(CartContext);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try { return JSON.parse(localStorage.getItem("shopping_cart") || "[]"); } catch { return []; }
  });

  useEffect(() => { localStorage.setItem("shopping_cart", JSON.stringify(items)); }, [items]);

  const add = (item: Omit<CartItem,"quantity">) =>
    setItems(prev => prev.find(i => i.id === item.id) ? prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity+1 } : i) : [...prev, { ...item, quantity: 1 }]);

  const remove  = (id: string)            => setItems(prev => prev.filter(i => i.id !== id));
  const update  = (id: string, qty: number) => setItems(prev => prev.map(i => i.id === id ? { ...i, quantity: Math.max(0, qty) } : i).filter(i => i.quantity > 0));
  const clear   = ()                      => setItems([]);
  const total   = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const count   = items.reduce((s, i) => s + i.quantity, 0);

  return <CartContext.Provider value={{ items, add, remove, update, clear, total, count }}>{children}</CartContext.Provider>;
}
