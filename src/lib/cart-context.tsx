'use client';

import { createContext, useContext, useReducer, useCallback, type ReactNode } from 'react';
import type { Product } from '@/data/mock-data';
import { effectivePrice, type CustomerType } from './firestore';
import { useBranches } from './useFirestore';
import { useBranchContext } from './branch-context';

// ======================== TYPES ========================

export interface CartItem {
  productId: string;
  product: Product;
  quantity: number;
}

interface CartState {
  items: CartItem[];
}

type CartAction =
  | { type: 'ADD_TO_CART'; product: Product; quantity: number }
  | { type: 'REMOVE_FROM_CART'; productId: string }
  | { type: 'UPDATE_QUANTITY'; productId: string; quantity: number }
  | { type: 'CLEAR_CART' };

interface CartContextValue {
  cartItems: CartItem[];
  cartTotal: number;
  cartSubtotal: number;
  cartVat: number;
  cartCount: number;
  customerType: CustomerType;
  unitPriceFor: (product: Product) => number;
  addToCart: (product: Product, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getItemQuantity: (productId: string) => number;
  isInCart: (productId: string) => boolean;
}

// ======================== REDUCER ========================

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_TO_CART': {
      const existing = state.items.find((i) => i.productId === action.product.id);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.productId === action.product.id
              ? { ...i, quantity: i.quantity + action.quantity }
              : i
          ),
        };
      }
      return {
        items: [
          ...state.items,
          { productId: action.product.id, product: action.product, quantity: action.quantity },
        ],
      };
    }
    case 'REMOVE_FROM_CART':
      return { items: state.items.filter((i) => i.productId !== action.productId) };
    case 'UPDATE_QUANTITY': {
      if (action.quantity <= 0) {
        return { items: state.items.filter((i) => i.productId !== action.productId) };
      }
      return {
        items: state.items.map((i) =>
          i.productId === action.productId ? { ...i, quantity: action.quantity } : i
        ),
      };
    }
    case 'CLEAR_CART':
      return { items: [] };
    default:
      return state;
  }
}

// ======================== CONTEXT ========================

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [] });

  const addToCart = useCallback(
    (product: Product, quantity: number) =>
      dispatch({ type: 'ADD_TO_CART', product, quantity }),
    []
  );

  const removeFromCart = useCallback(
    (productId: string) => dispatch({ type: 'REMOVE_FROM_CART', productId }),
    []
  );

  const updateQuantity = useCallback(
    (productId: string, quantity: number) =>
      dispatch({ type: 'UPDATE_QUANTITY', productId, quantity }),
    []
  );

  const clearCart = useCallback(() => dispatch({ type: 'CLEAR_CART' }), []);

  const getItemQuantity = useCallback(
    (productId: string) => {
      const item = state.items.find((i) => i.productId === productId);
      return item?.quantity ?? 0;
    },
    [state.items]
  );

  const isInCart = useCallback(
    (productId: string) => state.items.some((i) => i.productId === productId),
    [state.items]
  );

  // Resolve current branch's customer type so we can charge the right
  // tier. Falls back to 'internal' for legacy branches without the flag.
  const { branchId } = useBranchContext();
  const { branches } = useBranches();
  const currentBranch = branches.find((b) => b.id === branchId);
  const customerType: CustomerType =
    currentBranch?.customerType === 'external' ? 'external' : 'internal';

  const unitPriceFor = useCallback(
    (product: Product) => effectivePrice(product, customerType),
    [customerType],
  );

  const cartSubtotal = state.items.reduce(
    (sum, item) => sum + effectivePrice(item.product, customerType) * item.quantity,
    0
  );
  const cartVat = cartSubtotal * 0.07;
  const cartTotal = cartSubtotal + cartVat;
  const cartCount = state.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cartItems: state.items,
        cartTotal,
        cartSubtotal,
        cartVat,
        cartCount,
        customerType,
        unitPriceFor,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        getItemQuantity,
        isInCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
