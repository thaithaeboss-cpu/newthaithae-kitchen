'use client';

import { useState } from 'react';
import {
  productCategories,
  Product,
  ProductCategory,
} from '@/data/mock-data';
import { useProducts, useBranches } from '@/lib/useFirestore';
import { addProduct, updateProduct, deleteProduct, updateStock } from '@/lib/firestore';
import { useLanguage } from '@/lib/language-context';

type StockFilter = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';

const emptyProduct: Omit<Product, 'id'> = {
  sku: '',
  nameTh: '',
  nameEn: '',
  category: 'meat',
  price: 0,
  unit: '',
  unitTh: '',
  stock: 0,
  minStock: 0,
  image: '',
  description: '',
  isActive: true,
  visibleToBranches: [],
};

export default function ProductsPage() {
  const { t, locale } = useLanguage();
  const { products: productsList, loading, refresh } = useProducts();
  const { branches } = useBranches();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ProductCategory | 'all'>('all');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [showModal, setShowModal] = useState(false);
  const [editProductItem, setEditProductItem] = useState<Product | null>(null);
  const [formData, setFormData] = useState(emptyProduct);
  const [saving, setSaving] = useState(false);
  const [imagePreview, setImagePreview] = useState('');

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 600;
        const scale = Math.min(MAX / img.width, MAX / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressed = canvas.toDataURL('image/jpeg', 0.75);
        setImagePreview(compressed);
        setFormData((prev) => ({ ...prev, image: compressed }));
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  const getStockStatus = (p: Product) => {
    if (p.stock === 0) return 'out_of_stock';
    if (p.stock <= p.minStock) return 'low_stock';
    return 'in_stock';
  };

  const filtered = productsList.filter((p) => {
    const matchSearch =
      p.nameTh.toLowerCase().includes(search.toLowerCase()) ||
      p.nameEn.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase());
    const matchCategory = categoryFilter === 'all' || p.category === categoryFilter;
    const matchStock = stockFilter === 'all' || getStockStatus(p) === stockFilter;
    return matchSearch && matchCategory && matchStock;
  });

  const openAdd = () => {
    setEditProductItem(null);
    setFormData(emptyProduct);
    setImagePreview('');
    setShowModal(true);
  };

  const openEdit = (p: Product) => {
    setEditProductItem(p);
    setFormData({ ...p });
    setImagePreview(p.image || '');
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editProductItem) {
        const { id, ...rest } = formData as Product & { id?: string };
        await updateProduct(editProductItem.id, rest);
      } else {
        await addProduct(formData as any);
      }
      setShowModal(false);
      refresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (p: Product) => {
    try {
      await updateProduct(p.id, { isActive: !p.isActive });
      refresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleTogglePublic = async (p: Product) => {
    try {
      await updateProduct(p.id, { isPublic: !p.isPublic });
      refresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProduct(id);
      refresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAdjustStock = async (id: string, qty: number, reason: string) => {
    try {
      await updateStock(id, qty, reason);
      refresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const statusBadge = (p: Product) => {
    const s = getStockStatus(p);
    if (s === 'out_of_stock')
      return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-700">{t('out_of_stock')}</span>;
    if (s === 'low_stock')
      return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-700">{t('low_stock')}</span>;
    return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-700">{t('in_stock')}</span>;
  };

  const getCategoryName = (key: ProductCategory) => {
    const cat = productCategories.find((c) => c.key === key);
    return locale === 'th' ? (cat?.nameTh ?? key) : (cat?.nameEn ?? key);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="animate-pulse bg-surface-container-high rounded-xl h-8 w-48" />
          <div className="flex gap-2">
            <div className="animate-pulse bg-surface-container-high rounded-xl h-10 w-28" />
            <div className="animate-pulse bg-surface-container-high rounded-xl h-10 w-36" />
          </div>
        </div>
        <div className="space-y-3">
          <div className="animate-pulse bg-surface-container-high rounded-xl h-16" />
          <div className="animate-pulse bg-surface-container-high rounded-xl h-16" />
          <div className="animate-pulse bg-surface-container-high rounded-xl h-16" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-headline font-bold text-on-surface">{t('manage_products')}</h1>
        <div className="flex gap-2">
          <button
            onClick={() => alert('Export CSV')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-surface-container-high text-on-surface rounded-lg text-sm font-medium border border-outline-variant/30 hover:opacity-90"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            {t('export_csv')}
          </button>
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:opacity-90"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            {t('add_new_product')}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
            search
          </span>
          <input
            type="text"
            placeholder={t('search_products_placeholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-outline-variant/50 bg-surface-container-lowest text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as ProductCategory | 'all')}
          className="px-4 py-2.5 rounded-lg border border-outline-variant/50 bg-surface-container-lowest text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="all">{t('all_categories_filter')}</option>
          {productCategories.map((c) => (
            <option key={c.key} value={c.key}>
              {locale === 'th' ? c.nameTh : c.nameEn}
            </option>
          ))}
        </select>
        <select
          value={stockFilter}
          onChange={(e) => setStockFilter(e.target.value as StockFilter)}
          className="px-4 py-2.5 rounded-lg border border-outline-variant/50 bg-surface-container-lowest text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="all">{t('all_stock_status')}</option>
          <option value="in_stock">{t('in_stock')}</option>
          <option value="low_stock">{t('low_stock')}</option>
          <option value="out_of_stock">{t('out_of_stock')}</option>
        </select>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/30 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-container-high text-on-surface-variant">
                <th className="text-left px-4 py-3 font-semibold">{t('sku')}</th>
                <th className="text-left px-4 py-3 font-semibold">{t('product_name_th')}</th>
                <th className="text-left px-4 py-3 font-semibold">{t('category')}</th>
                <th className="text-right px-4 py-3 font-semibold">{t('price')}</th>
                <th className="text-right px-4 py-3 font-semibold">{t('stock_level')}</th>
                <th className="text-left px-4 py-3 font-semibold">{t('unit')}</th>
                <th className="text-center px-4 py-3 font-semibold">{t('status')}</th>
                <th className="text-center px-4 py-3 font-semibold">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {filtered.map((p) => (
                <tr key={p.id} className={`hover:bg-surface-container-low transition-colors ${!p.isActive ? 'opacity-40' : ''}`}>
                  <td className="px-4 py-3 font-mono text-xs text-on-surface-variant">{p.sku}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="font-medium text-on-surface">{locale === 'th' ? p.nameTh : p.nameEn}</p>
                        <p className="text-xs text-on-surface-variant">{locale === 'th' ? p.nameEn : p.nameTh}</p>
                      </div>
                      {!p.isActive && (
                        <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-red-100 text-red-600 shrink-0">
                          {locale === 'th' ? 'ปิด' : 'Off'}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant">{getCategoryName(p.category)}</td>
                  <td className="px-4 py-3 text-right font-medium text-on-surface">
                    ฿{p.price.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-on-surface">{p.stock}</td>
                  <td className="px-4 py-3 text-on-surface-variant">{p.unitTh}</td>
                  <td className="px-4 py-3 text-center">{statusBadge(p)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => handleToggleActive(p)}
                        className={`p-1.5 rounded-lg transition-colors ${p.isActive ? 'hover:bg-amber-50' : 'hover:bg-green-50'}`}
                        title={p.isActive ? (locale === 'th' ? 'ปิดสินค้า' : 'Disable') : (locale === 'th' ? 'เปิดสินค้า' : 'Enable')}
                      >
                        <span className={`material-symbols-outlined text-[18px] ${p.isActive ? 'text-amber-500' : 'text-green-600'}`}>
                          {p.isActive ? 'toggle_on' : 'toggle_off'}
                        </span>
                      </button>
                      <button
                        onClick={() => handleTogglePublic(p)}
                        className={`p-1.5 rounded-lg transition-colors ${p.isPublic ? 'hover:bg-blue-50' : 'hover:bg-surface-container-high'}`}
                        title={p.isPublic ? (locale === 'th' ? 'ซ่อนจากลูกค้านอก' : 'Hide from external') : (locale === 'th' ? 'แสดงให้ลูกค้านอก' : 'Show to external')}
                      >
                        <span className={`material-symbols-outlined text-[18px] ${p.isPublic ? 'text-blue-500' : 'text-on-surface-variant/40'}`}>
                          public
                        </span>
                      </button>
                      <button
                        onClick={() => openEdit(p)}
                        className="p-1.5 rounded-lg hover:bg-surface-container-high transition-colors"
                        title={t('edit')}
                      >
                        <span className="material-symbols-outlined text-[18px] text-on-surface-variant">edit</span>
                      </button>
                      <button
                        onClick={() => {
                          const qtyStr = prompt(locale === 'th' ? 'จำนวนที่ปรับ (+ เพิ่ม / - ลด)' : 'Adjustment qty (+ add / - remove)');
                          if (qtyStr === null) return;
                          const adjustmentQty = Number(qtyStr);
                          if (isNaN(adjustmentQty)) return;
                          const reason = prompt(locale === 'th' ? 'เหตุผล' : 'Reason') ?? '';
                          handleAdjustStock(p.id, adjustmentQty, reason);
                        }}
                        className="p-1.5 rounded-lg hover:bg-surface-container-high transition-colors"
                        title={t('adjust_stock')}
                      >
                        <span className="material-symbols-outlined text-[18px] text-on-surface-variant">inventory</span>
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                        title={t('delete')}
                      >
                        <span className="material-symbols-outlined text-[18px] text-red-600">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {filtered.map((p) => (
          <div
            key={p.id}
            className={`bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant/30 ${!p.isActive ? 'opacity-50' : ''}`}
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-on-surface">{locale === 'th' ? p.nameTh : p.nameEn}</p>
                  {!p.isActive && (
                    <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-red-100 text-red-600">
                      {locale === 'th' ? 'ปิด' : 'Off'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-on-surface-variant">{locale === 'th' ? p.nameEn : p.nameTh}</p>
              </div>
              {statusBadge(p)}
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs mt-3">
              <div>
                <p className="text-on-surface-variant">{t('sku')}</p>
                <p className="font-mono font-medium text-on-surface">{p.sku}</p>
              </div>
              <div>
                <p className="text-on-surface-variant">{t('price')}</p>
                <p className="font-medium text-on-surface">฿{p.price.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-on-surface-variant">{t('stock_level')}</p>
                <p className="font-medium text-on-surface">
                  {p.stock} {p.unitTh}
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-3 pt-3 border-t border-outline-variant/20 flex-wrap">
              <button
                onClick={() => handleToggleActive(p)}
                className={`py-2 px-3 text-xs font-medium rounded-lg ${p.isActive ? 'text-amber-600 bg-amber-50' : 'text-green-600 bg-green-50'}`}
              >
                {p.isActive ? (locale === 'th' ? 'ปิด' : 'Disable') : (locale === 'th' ? 'เปิด' : 'Enable')}
              </button>
              <button
                onClick={() => handleTogglePublic(p)}
                className={`py-2 px-3 text-xs font-medium rounded-lg ${p.isPublic ? 'text-blue-600 bg-blue-50' : 'text-on-surface-variant bg-surface-container-high'}`}
              >
                {p.isPublic ? (locale === 'th' ? 'ลูกค้านอก ✓' : 'Public ✓') : (locale === 'th' ? 'ลูกค้านอก' : 'Public')}
              </button>
              <button
                onClick={() => openEdit(p)}
                className="flex-1 py-2 text-xs font-medium text-primary bg-primary/5 rounded-lg"
              >
                {t('edit')}
              </button>
              <button
                onClick={() => handleDelete(p.id)}
                className="py-2 px-3 text-xs font-medium text-red-600 bg-red-50 rounded-lg"
              >
                {t('delete')}
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="text-sm text-on-surface-variant">
        {locale === 'th' ? `แสดง ${filtered.length} จาก ${productsList.length} รายการ` : `Showing ${filtered.length} of ${productsList.length} items`}
      </p>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-surface-container-lowest rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/20">
              <h2 className="text-lg font-headline font-bold text-on-surface">
                {editProductItem ? t('edit_product') : t('add_new_product')}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-surface-container-high">
                <span className="material-symbols-outlined text-on-surface-variant">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-on-surface mb-1">{t('product_name_th')}</label>
                  <input
                    type="text"
                    value={formData.nameTh}
                    onChange={(e) => setFormData({ ...formData, nameTh: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-outline-variant/50 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-on-surface mb-1">{t('product_name_en')}</label>
                  <input
                    type="text"
                    value={formData.nameEn}
                    onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-outline-variant/50 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-on-surface mb-1">{t('sku')}</label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-outline-variant/50 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-on-surface mb-1">{t('category')}</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as ProductCategory })}
                    className="w-full px-3 py-2 rounded-lg border border-outline-variant/50 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {productCategories.map((c) => (
                      <option key={c.key} value={c.key}>
                        {locale === 'th' ? c.nameTh : c.nameEn}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-on-surface mb-1">{t('price_baht')}</label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-outline-variant/50 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-on-surface mb-1">{t('unit')}</label>
                  <input
                    type="text"
                    value={formData.unitTh}
                    onChange={(e) => setFormData({ ...formData, unitTh: e.target.value, unit: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-outline-variant/50 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-on-surface mb-1">{t('min_stock')}</label>
                  <input
                    type="number"
                    value={formData.minStock}
                    onChange={(e) => setFormData({ ...formData, minStock: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-outline-variant/50 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-on-surface mb-1">{t('description')}</label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-outline-variant/50 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-on-surface mb-1">{locale === 'th' ? 'รูปภาพ' : 'Image'}</label>
                <label className="cursor-pointer block">
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                  {imagePreview ? (
                    <div className="relative rounded-lg overflow-hidden border border-outline-variant/40 h-40">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <span className="text-white text-sm font-medium">{locale === 'th' ? 'เปลี่ยนรูป' : 'Change'}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-outline-variant/50 rounded-lg p-6 text-center hover:border-primary/40 hover:bg-primary/3 transition-colors">
                      <span className="material-symbols-outlined text-[32px] text-on-surface-variant">cloud_upload</span>
                      <p className="text-sm text-on-surface-variant mt-2">{t('drag_drop_upload')}</p>
                    </div>
                  )}
                </label>
              </div>

              {/* Branch visibility */}
              {branches.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-on-surface mb-1">
                    {locale === 'th' ? 'สาขาที่เห็นสินค้านี้' : 'Visible to branches'}
                  </label>
                  <p className="text-xs text-on-surface-variant mb-2">
                    {locale === 'th'
                      ? 'ถ้าไม่เลือก = ทุกสาขาเห็น'
                      : 'Leave unchecked = visible to all branches'}
                  </p>
                  <div className="space-y-2">
                    {branches.map((b) => {
                      const checked = (formData.visibleToBranches ?? []).includes(b.id);
                      return (
                        <label key={b.id} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              const current = formData.visibleToBranches ?? [];
                              const next = checked
                                ? current.filter((id) => id !== b.id)
                                : [...current, b.id];
                              setFormData({ ...formData, visibleToBranches: next });
                            }}
                            className="w-4 h-4 accent-primary"
                          />
                          <span className="text-sm text-on-surface">
                            {locale === 'th' ? b.nameTh : b.nameEn}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-outline-variant/20">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-on-surface bg-surface-container-high rounded-lg hover:opacity-90"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-on-primary bg-primary rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                {saving
                  ? (locale === 'th' ? 'กำลังบันทึก...' : 'Saving...')
                  : (editProductItem ? t('save') : t('add_product'))}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
