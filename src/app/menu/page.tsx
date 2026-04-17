'use client';

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Product, ProductCategory } from '@/data/mock-data';
import { productCategories } from '@/data/mock-data';

export default function PublicMenuPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'all'>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const q = query(
      collection(db, 'products'),
      where('isActive', '==', true),
      where('isPublic', '==', true),
    );
    const unsub = onSnapshot(q, (snap) => {
      setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product)));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filtered = products.filter((p) => {
    const matchSearch =
      p.nameTh.toLowerCase().includes(search.toLowerCase()) ||
      p.nameEn.toLowerCase().includes(search.toLowerCase());
    const matchCat = selectedCategory === 'all' || p.category === selectedCategory;
    return matchSearch && matchCat;
  });

  // Only show categories that have public products
  const availableCategories = productCategories.filter((c) =>
    products.some((p) => p.category === c.key),
  );

  return (
    <div className="min-h-screen bg-[#f5f5f0]">
      {/* Header */}
      <div className="bg-[#1a3a2a] text-white px-6 py-5 sticky top-0 z-10 shadow-md">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-xl font-bold tracking-tight">Thaithae Kitchen</h1>
          <p className="text-white/60 text-sm mt-0.5">รายการสินค้าสำหรับลูกค้า</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Search */}
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[20px]">
            search
          </span>
          <input
            type="text"
            placeholder="ค้นหาสินค้า..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2a]/30"
          />
        </div>

        {/* Category tabs */}
        {availableCategories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-[#1a3a2a] text-white'
                  : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              ทั้งหมด
            </button>
            {availableCategories.map((c) => (
              <button
                key={c.key}
                onClick={() => setSelectedCategory(c.key)}
                className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === c.key
                    ? 'bg-[#1a3a2a] text-white'
                    : 'bg-white text-gray-600 border border-gray-200'
                }`}
              >
                {c.nameTh}
              </button>
            ))}
          </div>
        )}

        {/* Products */}
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-white rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <span className="material-symbols-outlined text-[48px] block mb-2">inventory_2</span>
            <p className="text-sm">ไม่พบสินค้า</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((p) => (
              <div
                key={p.id}
                className="bg-white rounded-xl px-4 py-4 flex items-center justify-between shadow-sm border border-gray-100"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{p.nameTh}</p>
                  {p.nameEn !== p.nameTh && (
                    <p className="text-xs text-gray-400 truncate">{p.nameEn}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">
                    {productCategories.find((c) => c.key === p.category)?.nameTh}
                  </p>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className="text-lg font-bold text-[#1a3a2a]">
                    ฿{p.price.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-400">/ {p.unitTh || p.unit}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <p className="text-center text-xs text-gray-400">{filtered.length} รายการ</p>
        )}
      </div>
    </div>
  );
}
