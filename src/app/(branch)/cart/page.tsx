'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCart } from '@/lib/cart-context';
import { useLanguage } from '@/lib/language-context';
import { useBranches } from '@/lib/useFirestore';
import { useBranchContext } from '@/lib/branch-context';
import { addOrder, updateStock } from '@/lib/firestore';


// ======================== CART PAGE ========================

export default function CartPage() {
  const {
    cartItems,
    cartSubtotal,
    cartTotal,
    cartCount,
    updateQuantity,
    removeFromCart,
    clearCart,
    unitPriceFor,
  } = useCart();

  const { locale, t } = useLanguage();
  const { branches } = useBranches();
  const { branchId, setBranchId } = useBranchContext();

  const selectedBranch = branchId;
  function setSelectedBranch(id: string) { setBranchId(id); }

  // Set default branch once branches load
  useEffect(() => {
    if (branches.length > 0 && !branchId) {
      setBranchId(branches[0].id);
    }
  }, [branches, branchId]);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);

  async function handleSubmitOrder() {
    setShowConfirmModal(false);
    try {
      const branch = branches.find((b) => b.id === selectedBranch);
      const branchName = (locale === 'th' ? branch?.nameTh : branch?.nameEn) ?? '';
      const orderDocId = await addOrder({
        branchId: selectedBranch,
        branchName,
        status: 'new',
        items: cartItems.map((item) => {
          const unitPrice = unitPriceFor(item.product);
          return {
            productId: item.productId,
            nameTh: item.product.nameTh,
            nameEn: item.product.nameEn,
            quantity: item.quantity,
            unit: item.product.unit,
            unitPrice,
            total: unitPrice * item.quantity,
          };
        }),
        subtotal: cartSubtotal,
        vat: 0,
        deliveryFee: 0,
        total: cartTotal,
      });

      // Deduct stock for each ordered item (best-effort, don't block order confirmation)
      await Promise.all(
        cartItems.map((item) =>
          updateStock(item.productId, -item.quantity, `Order #${orderDocId.slice(0, 6)} · ${branchName}`).catch((err) => {
            console.error(`Failed to deduct stock for ${item.product.nameEn}:`, err);
          })
        )
      );
    } catch (err) {
      console.error('Failed to submit order:', err);
    }
    setOrderPlaced(true);
    clearCart();
  }

  // ---- Order placed success ----
  if (orderPlaced) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-green-600 text-4xl">check_circle</span>
        </div>
        <h2 className="font-headline font-bold text-xl text-on-surface mb-2">
          {t('order_sent_success')}
        </h2>
        <p className="text-on-surface-variant text-sm mb-6 max-w-xs">
          {t('order_sent_message')}
        </p>
        <Link
          href="/catalog"
          className="px-6 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          {t('back_to_catalog')}
        </Link>
      </div>
    );
  }

  // ---- Empty cart ----
  if (cartItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <span className="material-symbols-outlined text-on-surface-variant text-7xl mb-4">
          shopping_cart
        </span>
        <h2 className="font-headline font-bold text-xl text-on-surface mb-2">{t('cart_empty')}</h2>
        <p className="text-on-surface-variant text-sm mb-6">
          {t('cart_empty_message')}
        </p>
        <Link
          href="/catalog"
          className="px-6 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition-opacity inline-flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-base">storefront</span>
          {t('start_ordering')}
        </Link>
      </div>
    );
  }

  return (
    <div className="py-4 space-y-4 pb-52">
      {/* ---- Header ---- */}
      <div className="flex items-center gap-3">
        <h1 className="font-headline font-bold text-xl text-on-surface">{t('cart_title')}</h1>
        <span className="bg-primary text-on-primary text-xs font-bold px-2.5 py-1 rounded-full">
          {cartCount}
        </span>
      </div>

      {/* ---- Cart items ---- */}
      <div className="space-y-3">
        {cartItems.map((item) => {
          const unitPrice = unitPriceFor(item.product);
          const lineTotal = unitPrice * item.quantity;
          return (
            <div
              key={item.productId}
              className="bg-surface-container-lowest rounded-xl p-4 flex gap-3"
            >
              {/* Thumbnail */}
              <div className="w-[60px] h-[60px] rounded-lg bg-surface-container-high flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-on-surface-variant text-2xl">
                  inventory_2
                </span>
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-on-surface text-sm leading-tight truncate">
                      {locale === 'th' ? item.product.nameTh : item.product.nameEn}
                    </h3>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      ฿{unitPrice.toLocaleString()} / {locale === 'th' ? item.product.unitTh : item.product.unit}
                    </p>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.productId)}
                    className="text-error hover:opacity-70 transition-opacity shrink-0"
                    aria-label={t('remove_item')}
                  >
                    <span className="material-symbols-outlined text-xl">delete</span>
                  </button>
                </div>

                <div className="flex items-center justify-between mt-2">
                  {/* Quantity controls */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      className="w-7 h-7 rounded-lg bg-surface-container-high text-on-surface flex items-center justify-center text-sm font-bold hover:bg-surface-container-highest transition-colors"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) =>
                        updateQuantity(
                          item.productId,
                          Math.max(1, Number(e.target.value) || 1)
                        )
                      }
                      className="w-10 h-7 text-center rounded-lg border border-outline-variant text-xs bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                      className="w-7 h-7 rounded-lg bg-surface-container-high text-on-surface flex items-center justify-center text-sm font-bold hover:bg-surface-container-highest transition-colors"
                    >
                      +
                    </button>
                  </div>

                  {/* Line total */}
                  <p className="font-bold text-primary text-sm">
                    ฿{lineTotal.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ---- Order summary (sticky on mobile) ---- */}
      <div className="fixed bottom-16 inset-x-0 bg-surface-container-lowest border-t border-outline-variant p-4 space-y-3 z-40 md:static md:bottom-0 md:rounded-xl md:border md:border-outline-variant">
        {/* Summary rows */}
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between font-bold text-on-surface text-base">
            <span>{t('total')}</span>
            <span className="text-primary font-headline text-lg">
              ฿{cartTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <button className="flex-1 py-3 rounded-xl border border-outline-variant text-on-surface text-sm font-semibold hover:bg-surface-container-high transition-colors">
            {t('save_draft')}
          </button>
          <button
            onClick={() => setShowConfirmModal(true)}
            className="flex-1 py-3 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            {t('confirm_order')}
          </button>
        </div>
      </div>

      {/* ---- Confirmation modal ---- */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl">
            <h2 className="font-headline font-bold text-lg text-on-surface text-center">
              {t('confirm_order_title')}
            </h2>

            {/* Summary list */}
            <div className="max-h-48 overflow-y-auto space-y-2">
              {cartItems.map((item) => (
                <div key={item.productId} className="flex justify-between text-sm">
                  <span className="text-on-surface">
                    {locale === 'th' ? item.product.nameTh : item.product.nameEn} x{item.quantity}
                  </span>
                  <span className="text-on-surface-variant">
                    ฿{(unitPriceFor(item.product) * item.quantity).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-outline-variant pt-3 text-sm">
              <div className="flex justify-between font-bold text-on-surface text-base">
                <span>{t('total')}</span>
                <span className="text-primary font-headline">
                  ฿{cartTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-outline-variant text-on-surface text-sm font-semibold hover:bg-surface-container-high transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleSubmitOrder}
                className="flex-1 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                {t('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
