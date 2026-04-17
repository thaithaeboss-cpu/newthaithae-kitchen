'use client';

import { useState, useEffect } from 'react';
import { useProducts } from '@/lib/useFirestore';
import { saveSettings, loadSettings } from '@/lib/firestore';
import { useLanguage } from '@/lib/language-context';
import { productCategories } from '@/data/mock-data';

const MAX_FEATURED = 8;

export default function FeaturedProductsPage() {
  const { locale } = useLanguage();
  const { products, loading } = useProducts();

  const [featuredIds, setFeaturedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadSettings().then((s) => {
      if (s?.featuredProductIds) setFeaturedIds(s.featuredProductIds);
    });
  }, []);

  function toggle(id: string) {
    setFeaturedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_FEATURED) return prev; // cap at 8
      return [...prev, id];
    });
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    await saveSettings({ featuredProductIds: featuredIds });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const activeProducts = products.filter((p) => p.isActive);

  const filtered = activeProducts.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.nameTh.toLowerCase().includes(q) ||
      p.nameEn.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q)
    );
  });

  const getCatName = (key: string) => {
    const c = productCategories.find((x) => x.key === key);
    return locale === 'th' ? c?.nameTh : c?.nameEn;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-headline font-bold text-on-surface">
            {locale === 'th' ? 'สินค้าพิเศษ' : 'Featured Products'}
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            {locale === 'th'
              ? `เลือกสินค้าที่ต้องการแสดงในหน้าหลักของสาขา (สูงสุด ${MAX_FEATURED} รายการ)`
              : `Choose products to highlight on the branch home page (max ${MAX_FEATURED})`}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[18px]">{saved ? 'check' : 'save'}</span>
          {saved ? (locale === 'th' ? 'บันทึกแล้ว!' : 'Saved!') : (locale === 'th' ? 'บันทึก' : 'Save')}
        </button>
      </div>

      {/* Selected count */}
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-primary/5 border border-primary/20">
        <span className="material-symbols-outlined text-[20px] text-primary">star</span>
        <p className="text-sm text-on-surface">
          {locale === 'th'
            ? `เลือกแล้ว ${featuredIds.length} / ${MAX_FEATURED} รายการ`
            : `${featuredIds.length} / ${MAX_FEATURED} selected`}
        </p>
        {featuredIds.length > 0 && (
          <button
            onClick={() => { setFeaturedIds([]); setSaved(false); }}
            className="ml-auto text-xs text-on-surface-variant hover:text-error"
          >
            {locale === 'th' ? 'ล้างทั้งหมด' : 'Clear all'}
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
        <input
          type="text"
          placeholder={locale === 'th' ? 'ค้นหาสินค้า...' : 'Search products...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-outline-variant/50 bg-surface-container-lowest text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {/* Product grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-surface-container-high animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((p) => {
            const selected = featuredIds.includes(p.id);
            const disabled = !selected && featuredIds.length >= MAX_FEATURED;
            return (
              <button
                key={p.id}
                onClick={() => toggle(p.id)}
                disabled={disabled}
                className={`relative text-left p-3 rounded-xl border-2 transition-all ${
                  selected
                    ? 'border-primary bg-primary/5'
                    : disabled
                    ? 'border-outline-variant/20 bg-surface-container-lowest opacity-40 cursor-not-allowed'
                    : 'border-outline-variant/30 bg-surface-container-lowest hover:border-primary/40 hover:bg-primary/3'
                }`}
              >
                {selected && (
                  <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary text-on-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-[14px]">check</span>
                  </span>
                )}
                <p className="text-xs text-on-surface-variant mb-0.5">{getCatName(p.category)}</p>
                <p className="text-sm font-semibold text-on-surface leading-tight">
                  {locale === 'th' ? p.nameTh : p.nameEn}
                </p>
                <p className="text-xs text-primary font-medium mt-1">฿{p.price.toLocaleString()}</p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
