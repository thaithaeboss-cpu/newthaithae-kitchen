'use client';

import { useState, useMemo, useEffect } from 'react';
import { type ProductCategory, type Product, type ProductCategoryInfo } from '@/data/mock-data';
import { useCart } from '@/lib/cart-context';
import { useLanguage } from '@/lib/language-context';
import type { TranslationKey } from '@/lib/i18n';
import { useProducts } from '@/lib/useFirestore';
import { useBranchContext } from '@/lib/branch-context';
import { toggleBranchFavorite } from '@/lib/firestore';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ======================== STATIC DATA ========================

const productCategories: ProductCategoryInfo[] = [
  { key: 'glass', nameTh: 'แก้ว/จาน', nameEn: 'Glass & Plates', icon: '' },
  { key: 'meat', nameTh: 'เนื้อสัตว์', nameEn: 'Meat', icon: '' },
  { key: 'curry', nameTh: 'แกง', nameEn: 'Curry', icon: '' },
  { key: 'sauce', nameTh: 'ซอส/ผง', nameEn: 'Sauce & Powder', icon: '' },
  { key: 'dessert', nameTh: 'ของหวาน', nameEn: 'Dessert', icon: '' },
  { key: 'filling', nameTh: 'ไส้/ท็อปปิ้ง', nameEn: 'Filling', icon: '' },
];

// ======================== CONSTANTS ========================

type SortOption = 'name' | 'price_asc' | 'price_desc' | 'stock';


const categoryKeyMap: Record<ProductCategory, TranslationKey> = {
  glass: 'cat_glass',
  meat: 'cat_meat',
  curry: 'cat_curry',
  sauce: 'cat_sauce',
  dessert: 'cat_dessert',
  filling: 'cat_filling',
};

// ======================== HELPERS ========================

function getStockLevel(stock: number, minStock: number) {
  if (stock === 0) return 'out_of_stock';
  if (stock <= minStock) return 'low_stock';
  return 'in_stock';
}

// ======================== PRODUCT CARD ========================

function ProductCard({ product, isFavorite, onToggleFavorite }: { product: Product; isFavorite: boolean; onToggleFavorite: () => void }) {
  const { addToCart, updateQuantity, getItemQuantity, isInCart } = useCart();
  const { locale, t } = useLanguage();
  const inCart = isInCart(product.id);
  const currentQty = getItemQuantity(product.id);
  const [qty, setQty] = useState(0);

  const stockLevel = getStockLevel(product.stock, product.minStock);
  const stockColor =
    stockLevel === 'out_of_stock'
      ? 'bg-error'
      : stockLevel === 'low_stock'
        ? 'bg-yellow-500'
        : 'bg-green-500';
  const stockLabel =
    stockLevel === 'out_of_stock'
      ? t('out_of_stock')
      : stockLevel === 'low_stock'
        ? t('low_stock')
        : t('in_stock');

  const categoryInfo = productCategories.find((c) => c.key === product.category);

  function handleAdd() {
    if (qty < 1) return;
    addToCart(product, qty);
    setQty(0);
  }

  const displayQty = inCart ? currentQty : qty;
  const setDisplayQty = inCart
    ? (v: number) => updateQuantity(product.id, v)
    : setQty;
  const categoryLabel = categoryKeyMap[product.category] ? t(categoryKeyMap[product.category]) : (locale === 'th' ? categoryInfo?.nameTh : categoryInfo?.nameEn) ?? product.category;

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-row items-center gap-3 p-3">
      {/* Thumbnail */}
      <div className="w-20 h-20 shrink-0 rounded-lg bg-surface-container-high flex items-center justify-center relative">
        {product.image ? (
          <img src={product.image} alt="" className="w-full h-full object-cover rounded-lg" />
        ) : (
          <span className="material-symbols-outlined text-on-surface-variant text-3xl">
            inventory_2
          </span>
        )}
        {/* Favorite heart button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          className="absolute -top-1.5 -right-1.5 w-7 h-7 rounded-full bg-white shadow-md flex items-center justify-center hover:scale-110 transition-transform"
        >
          <span
            className="material-symbols-outlined text-[18px]"
            style={{
              color: isFavorite ? '#e11d48' : '#9ca3af',
              fontVariationSettings: isFavorite ? "'FILL' 1" : "'FILL' 0",
            }}
          >
            favorite
          </span>
        </button>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-on-surface-variant">{categoryLabel}</p>
        <h3 className="font-bold text-on-surface text-sm leading-tight line-clamp-1">
          {locale === 'th' ? product.nameTh : product.nameEn}
        </h3>
        <p className="font-headline font-bold text-primary text-base mt-0.5">
          ฿{product.price.toLocaleString()} <span className="text-xs font-normal text-on-surface-variant">/ {product.unit}</span>
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={`w-1.5 h-1.5 rounded-full ${stockColor} shrink-0`} />
          <span className="text-[10px] text-on-surface-variant">
            {stockLabel} ({product.stock})
          </span>
        </div>
      </div>

      {/* Quantity controls */}
      <div className="shrink-0 flex flex-col items-center gap-1.5">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setDisplayQty(Math.max(0, displayQty - 1))}
            className="w-8 h-8 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center text-lg font-bold hover:bg-surface-container-highest transition-colors"
          >
            −
          </button>
          <input
            type="number"
            min={0}
            value={displayQty === 0 ? '' : displayQty}
            placeholder="0"
            onChange={(e) => setDisplayQty(Math.max(0, Number(e.target.value) || 0))}
            className="w-10 h-8 text-center rounded-lg border border-outline-variant/50 text-sm bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            onClick={() => setDisplayQty(displayQty + 1)}
            className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center text-lg font-bold hover:opacity-90 transition-opacity"
          >
            +
          </button>
        </div>
        {inCart ? (
          <span className="text-[10px] font-semibold text-primary flex items-center gap-0.5">
            <span className="material-symbols-outlined text-xs">check_circle</span>
            {t('in_cart')}
          </span>
        ) : (
          <button
            onClick={handleAdd}
            className="px-3 py-1 rounded-full bg-primary text-on-primary text-[10px] font-semibold hover:opacity-90 transition-opacity flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-xs">add_shopping_cart</span>
            {t('add_to_cart')}
          </button>
        )}
      </div>
    </div>
  );
}

// ======================== CATALOG PAGE ========================

export default function CatalogPage() {
  const { locale, t } = useLanguage();
  const { products, loading } = useProducts();
  const { branchId } = useBranchContext();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | ProductCategory | 'favorites'>('all');
  const [sort, setSort] = useState<SortOption>('name');
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

  // Subscribe to branch's favorite product IDs
  useEffect(() => {
    if (!branchId) {
      setFavoriteIds([]);
      return;
    }
    const unsub = onSnapshot(doc(db, 'branches', branchId), (snap) => {
      if (snap.exists()) {
        setFavoriteIds(snap.data().favoriteProductIds ?? []);
      } else {
        setFavoriteIds([]);
      }
    });
    return () => unsub();
  }, [branchId]);

  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  async function handleToggleFavorite(productId: string) {
    if (!branchId) {
      alert(locale === 'th'
        ? 'กรุณาเลือกสาขาก่อนเพิ่มรายการโปรด (ที่หน้าหลัก)'
        : 'Please select a branch first (on home page)');
      return;
    }
    const isFav = favoriteSet.has(productId);
    // Optimistic update
    setFavoriteIds((prev) => isFav ? prev.filter((id) => id !== productId) : [...prev, productId]);
    try {
      await toggleBranchFavorite(branchId, productId, isFav);
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
      // Revert on error
      setFavoriteIds((prev) => isFav ? [...prev, productId] : prev.filter((id) => id !== productId));
    }
  }


  const categoryTabs: { key: 'all' | ProductCategory | 'favorites'; labelKey: TranslationKey | null; label?: string; icon?: string }[] = [
    { key: 'all', labelKey: 'all_categories' },
    { key: 'favorites', labelKey: 'favorites', icon: 'favorite' },
    ...productCategories.map((c) => ({
      key: c.key,
      labelKey: categoryKeyMap[c.key] ?? null,
      label: locale === 'th' ? c.nameTh : c.nameEn,
    })),
  ];

  const sortOptions: { value: SortOption; labelKey: TranslationKey }[] = [
    { value: 'name', labelKey: 'sort_by_name' },
    { value: 'price_asc', labelKey: 'sort_by_price_asc' },
    { value: 'price_desc', labelKey: 'sort_by_price_desc' },
    { value: 'stock', labelKey: 'sort_by_stock' },
  ];

  // Filter + sort
  const filtered = useMemo(() => {
    let list = products.filter((p) => {
      if (!p.isActive) return false;
      // If visibleToBranches is set, only show to listed branches
      if (p.visibleToBranches && p.visibleToBranches.length > 0 && branchId) {
        return p.visibleToBranches.includes(branchId);
      }
      return true;
    });

    // Category / favorites filter
    if (selectedCategory === 'favorites') {
      list = list.filter((p) => favoriteSet.has(p.id));
    } else if (selectedCategory !== 'all') {
      list = list.filter((p) => p.category === selectedCategory);
    }

    // Search filter
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.nameTh.toLowerCase().includes(q) ||
          p.nameEn.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q)
      );
    }

    // Sort
    switch (sort) {
      case 'name':
        list.sort((a, b) => locale === 'th' ? a.nameTh.localeCompare(b.nameTh, 'th') : a.nameEn.localeCompare(b.nameEn, 'en'));
        break;
      case 'price_asc':
        list.sort((a, b) => a.price - b.price);
        break;
      case 'price_desc':
        list.sort((a, b) => b.price - a.price);
        break;
      case 'stock':
        list.sort((a, b) => a.stock - b.stock);
        break;
    }

    return list;
  }, [products, search, selectedCategory, sort, locale, branchId, favoriteSet]);


  return (
    <div className="space-y-4 py-4">
      {/* ---- Search bar ---- */}
      <div className="relative">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-xl">
          search
        </span>
        <input
          type="text"
          placeholder={t('search_products')}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
          }}
          className="w-full pl-10 pr-4 py-3 rounded-xl bg-surface-container-low text-on-surface placeholder:text-on-surface-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* ---- Category tabs ---- */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4">
        {categoryTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setSelectedCategory(tab.key);
            }}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${
              selectedCategory === tab.key
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
            }`}
          >
            {tab.icon && (
              <span
                className="material-symbols-outlined text-[16px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                {tab.icon}
              </span>
            )}
            {tab.labelKey ? t(tab.labelKey) : tab.label}
          </button>
        ))}
      </div>

      {/* ---- Sort + count ---- */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-on-surface-variant">
          {loading
            ? ''
            : filtered.length > 0
              ? t('showing_x_of_y').replace('{x}', String(filtered.length)).replace('{y}', String(filtered.length))
              : t('no_products_found')}
        </p>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOption)}
          className="text-xs bg-surface-container-low text-on-surface rounded-lg px-3 py-1.5 border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {sortOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {t(o.labelKey)}
            </option>
          ))}
        </select>
      </div>

      {/* ---- Product grid ---- */}
      {loading ? (
        <div className="flex flex-col gap-2 md:grid md:grid-cols-2 lg:grid-cols-3">
          {[1,2,3,4,5,6,7,8].map((i) => (
            <div key={i} className="bg-surface-container-lowest rounded-xl overflow-hidden animate-pulse">
              <div className="aspect-square bg-surface-container-high" />
              <div className="p-3 space-y-2">
                <div className="h-4 bg-surface-container rounded w-3/4" />
                <div className="h-3 bg-surface-container rounded w-1/2" />
                <div className="h-6 bg-surface-container rounded w-2/3 mt-1" />
                <div className="h-9 bg-surface-container rounded-xl mt-3" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant">
          <span className="material-symbols-outlined text-6xl mb-3">search_off</span>
          <p className="font-semibold">{t('no_products_found')}</p>
          <p className="text-sm mt-1">{t('try_different_search')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 md:grid md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              isFavorite={favoriteSet.has(product.id)}
              onToggleFavorite={() => handleToggleFavorite(product.id)}
            />
          ))}
        </div>
      )}

    </div>
  );
}
