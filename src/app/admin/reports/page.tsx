'use client';

import { useState, useEffect } from 'react';
import { productCategories } from '@/data/mock-data';
import { useOrders, useProducts, useBranches, useCustomers } from '@/lib/useFirestore';
import { useLanguage } from '@/lib/language-context';
import { getExpenses, type Expense, type ExpenseCategory } from '@/lib/firestore';

type ReportType = 'sales' | 'inventory' | 'branch' | 'customer' | 'expenses';

const expenseCategoryLabels: Record<ExpenseCategory, { th: string; en: string }> = {
  salary:     { th: 'ค่าแรงพนักงาน', en: 'Staff Salary' },
  ingredient: { th: 'วัตถุดิบ',       en: 'Ingredients' },
  utility:    { th: 'ค่าสาธารณูปโภค', en: 'Utilities' },
  packaging:  { th: 'บรรจุภัณฑ์',     en: 'Packaging' },
  transport:  { th: 'ขนส่ง',          en: 'Transport' },
  other:      { th: 'อื่นๆ',           en: 'Other' },
};

export default function ReportsPage() {
  const { t, locale } = useLanguage();
  const [reportType, setReportType] = useState<ReportType>('sales');
  const [dateRange, setDateRange] = useState<'month' | 'quarter' | 'year'>('month');

  const { orders, loading: loadingOrders } = useOrders();
  const { products, loading: loadingProducts } = useProducts();
  const { branches, loading: loadingBranches } = useBranches();
  const { customers, loading: loadingCustomers } = useCustomers();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loadingExpenses, setLoadingExpenses] = useState(true);
  useEffect(() => {
    getExpenses()
      .then(setExpenses)
      .catch((err) => console.error('Failed to load expenses:', err))
      .finally(() => setLoadingExpenses(false));
  }, []);

  const isLoading = loadingOrders || loadingProducts || loadingBranches || loadingCustomers || loadingExpenses;

  // Expense aggregates
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const totalGstClaimable = expenses.reduce((s, e) => s + (e.gstAmount ?? 0), 0);
  const expByCategory = (Object.keys(expenseCategoryLabels) as ExpenseCategory[]).map((cat) => ({
    cat,
    total: expenses.filter((e) => e.category === cat).reduce((s, e) => s + e.amount, 0),
  })).filter((x) => x.total > 0).sort((a, b) => b.total - a.total);
  const maxExpCat = Math.max(...expByCategory.map((c) => c.total), 1);
  const monthlyExpMap: Record<string, number> = {};
  expenses.forEach((e) => {
    const month = e.date.slice(0, 7);
    monthlyExpMap[month] = (monthlyExpMap[month] || 0) + e.amount;
  });
  const monthlyExpEntries = Object.entries(monthlyExpMap).sort(([a], [b]) => a.localeCompare(b)).slice(-6);
  const maxMonthlyExp = Math.max(...monthlyExpEntries.map(([, v]) => v), 1);

  // Sales data — computed from live orders
  const deliveredOrders = orders.filter((o) => o.status === 'delivered');
  const totalRevenue = deliveredOrders.reduce((s, o) => s + o.total, 0);
  const totalOrders = orders.length;
  const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

  // Monthly revenue trend — group delivered orders by month
  const monthlyRevMap: Record<string, number> = {};
  deliveredOrders.forEach((o) => {
    const dateStr = typeof o.createdAt === 'string' ? o.createdAt : String(o.createdAt);
    const month = dateStr.slice(0, 7); // "YYYY-MM"
    monthlyRevMap[month] = (monthlyRevMap[month] || 0) + o.total;
  });
  const monthlyRevEntries = Object.entries(monthlyRevMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6); // last 6 months
  const maxMonthlyRev = Math.max(...monthlyRevEntries.map(([, v]) => v), 1);

  // Top products by revenue — aggregate from order items
  // OrderItem (from mock-data) has: productId, productName, quantity, unitPrice, totalPrice
  // OrderItem (from firestore.ts) has: productId, nameTh, nameEn, quantity, unitPrice, total
  type FlexItem = {
    productId?: string;
    productName?: string;
    nameTh?: string;
    nameEn?: string;
    quantity: number;
    totalPrice?: number;
    total?: number;
  };
  const productFreq: Record<string, { name: string; count: number; revenue: number }> = {};
  orders.forEach((o) => {
    o.items.forEach((rawItem) => {
      const item = rawItem as unknown as FlexItem;
      const productId = item.productId;
      const productName =
        item.productName ??
        (locale === 'th' ? item.nameTh : item.nameEn) ??
        'Unknown';
      const qty = item.quantity ?? 0;
      const itemTotal = item.totalPrice ?? item.total ?? 0;
      const key = productId || productName;
      if (!productFreq[key]) {
        productFreq[key] = { name: productName, count: 0, revenue: 0 };
      }
      productFreq[key].count += qty;
      productFreq[key].revenue += itemTotal;
    });
  });
  const topProducts = Object.values(productFreq)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);
  const maxProductRev = Math.max(...topProducts.map((p) => p.revenue), 1);

  // Branch performance — group orders by branchId
  const branchPerf = branches
    .filter((b) => b.isActive)
    .map((b) => {
      const branchOrders = orders.filter((o) => o.branchId === b.id && o.status !== 'cancelled');
      const revenue = branchOrders.reduce((s, o) => s + o.total, 0);
      return {
        name: locale === 'th' ? b.nameTh : (b.nameEn || b.nameTh),
        code: b.code,
        orders: branchOrders.length,
        revenue,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
  const maxBranchRev = Math.max(...branchPerf.map((b) => b.revenue), 1);

  // Category breakdown — from products & order items
  const catBreakdown: Record<string, number> = {};
  orders.forEach((o) => {
    o.items.forEach((rawItem) => {
      const item = rawItem as unknown as FlexItem;
      const prod = products.find((p) => p.id === item.productId);
      if (prod) {
        const itemTotal = item.totalPrice ?? item.total ?? 0;
        catBreakdown[prod.category] = (catBreakdown[prod.category] || 0) + itemTotal;
      }
    });
  });
  const catList = Object.entries(catBreakdown)
    .map(([key, val]) => ({
      key,
      label: productCategories.find((c) => c.key === key)?.nameTh || key,
      value: val,
    }))
    .sort((a, b) => b.value - a.value);
  const maxCatVal = Math.max(...catList.map((c) => c.value), 1);

  // Inventory stats
  const totalStock = products.reduce((s, p) => s + p.stock, 0);
  const totalStockValue = products.reduce((s, p) => s + p.stock * p.price, 0);
  const lowStockCount = products.filter((p) => p.stock > 0 && p.stock <= p.minStock).length;

  // Customer stats
  const customersWithOrders = new Set(
    orders.filter((o) => o.customerId).map((o) => o.customerId),
  ).size;
  const totalOutstanding = customers.reduce(
    (s, c) => s + (c.outstandingBalance ?? 0),
    0,
  );
  const topCustomers = [...customers]
    .sort((a, b) => (b.outstandingBalance ?? 0) - (a.outstandingBalance ?? 0))
    .slice(0, 5);

  const reportTypes = [
    { key: 'sales', label: t('sales'), icon: 'point_of_sale' },
    { key: 'inventory', label: t('inventory_label'), icon: 'inventory_2' },
    { key: 'branch', label: t('branch_perf'), icon: 'store' },
    { key: 'customer', label: t('customer_analysis_label'), icon: 'groups' },
    { key: 'expenses', label: locale === 'th' ? 'ค่าใช้จ่าย' : 'Expenses', icon: 'payments' },
  ] as const;

  const netProfit = totalRevenue - totalExpenses;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-headline font-bold text-on-surface">{t('reports_analytics')}</h1>
        <div className="flex gap-2">
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:opacity-90">
            <span className="material-symbols-outlined text-[18px]">download</span>
            {t('export_report_btn')}
          </button>
        </div>
      </div>

      {/* Report Type Selector */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {reportTypes.map((rt) => (
          <button
            key={rt.key}
            onClick={() => setReportType(rt.key)}
            className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
              reportType === rt.key
                ? 'bg-primary text-on-primary border-primary shadow-md'
                : 'bg-surface-container-lowest text-on-surface border-outline-variant/30 hover:border-primary/30'
            }`}
          >
            <span className="material-symbols-outlined text-[22px]">{rt.icon}</span>
            <span className="text-sm font-medium">{rt.label}</span>
          </button>
        ))}
      </div>

      {/* Date Range */}
      <div className="flex gap-2">
        {([
          { key: 'month', label: t('last_30_days') },
          { key: 'quarter', label: t('last_3_months') },
          { key: 'year', label: t('this_year') },
        ] as const).map((d) => (
          <button
            key={d.key}
            onClick={() => setDateRange(d.key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg ${
              dateRange === d.key
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Loading Spinner */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <span className="material-symbols-outlined text-[48px] text-primary animate-spin">
              progress_activity
            </span>
            <p className="mt-2 text-on-surface-variant">
              {locale === 'th' ? 'กำลังโหลด...' : 'Loading...'}
            </p>
          </div>
        </div>
      )}

      {/* Sales Report */}
      {!isLoading && reportType === 'sales' && (
        <div className="space-y-6">
          {/* KPI */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm border border-outline-variant/30">
              <p className="text-sm text-on-surface-variant">{t('total_revenue')}</p>
              <p className="text-2xl font-bold text-on-surface mt-1">฿{totalRevenue.toLocaleString()}</p>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm border border-outline-variant/30">
              <p className="text-sm text-on-surface-variant">{locale === 'th' ? 'ค่าใช้จ่าย' : 'Expenses'}</p>
              <p className="text-2xl font-bold text-error mt-1">฿{totalExpenses.toLocaleString()}</p>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm border border-outline-variant/30">
              <p className="text-sm text-on-surface-variant">{locale === 'th' ? 'กำไรสุทธิ' : 'Net Profit'}</p>
              <p className={`text-2xl font-bold mt-1 ${netProfit >= 0 ? 'text-green-600' : 'text-error'}`}>
                ฿{netProfit.toLocaleString()}
              </p>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm border border-outline-variant/30">
              <p className="text-sm text-on-surface-variant">{t('total_orders')}</p>
              <p className="text-2xl font-bold text-on-surface mt-1">{totalOrders}</p>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm border border-outline-variant/30">
              <p className="text-sm text-on-surface-variant">{t('average_order')}</p>
              <p className="text-2xl font-bold text-on-surface mt-1">฿{avgOrderValue.toLocaleString()}</p>
            </div>
          </div>

          {/* Sales Trend — monthly bars from live data */}
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-outline-variant/30">
            <h3 className="text-base font-headline font-bold text-on-surface mb-4">{t('sales_trend_monthly')}</h3>
            {monthlyRevEntries.length === 0 ? (
              <p className="text-sm text-on-surface-variant">{locale === 'th' ? 'ไม่มีข้อมูล' : 'No data'}</p>
            ) : (
              <div className="flex items-end gap-4 h-48">
                {monthlyRevEntries.map(([month, rev]) => (
                  <div key={month} className="flex-1 flex flex-col items-center gap-2">
                    <span className="text-xs text-on-surface-variant font-medium">
                      ฿{(rev / 1000).toFixed(0)}k
                    </span>
                    <div
                      className="w-full bg-primary rounded-t-md"
                      style={{ height: `${(rev / maxMonthlyRev) * 140}px` }}
                    />
                    <span className="text-[10px] text-on-surface-variant">
                      {month.slice(5)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Products + Category Breakdown */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-outline-variant/30">
              <h3 className="text-base font-headline font-bold text-on-surface mb-4">{t('top_selling')}</h3>
              <div className="space-y-3">
                {topProducts.map((p, i) => (
                  <div key={p.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-on-surface-variant truncate mr-2">
                        <span className="font-medium text-on-surface mr-1">{i + 1}.</span>
                        {p.name}
                      </span>
                      <span className="font-medium text-on-surface whitespace-nowrap">
                        ฿{p.revenue.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-surface-container-high rounded-full">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${(p.revenue / maxProductRev) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-outline-variant/30">
              <h3 className="text-base font-headline font-bold text-on-surface mb-4">{t('by_category')}</h3>
              <div className="space-y-3">
                {catList.map((c) => (
                  <div key={c.key}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-on-surface-variant">{c.label}</span>
                      <span className="font-medium text-on-surface">฿{c.value.toLocaleString()}</span>
                    </div>
                    <div className="w-full h-2 bg-surface-container-high rounded-full">
                      <div
                        className="h-full bg-tertiary rounded-full"
                        style={{ width: `${(c.value / maxCatVal) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inventory Report */}
      {!isLoading && reportType === 'inventory' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm border border-outline-variant/30">
              <p className="text-sm text-on-surface-variant">{t('total_stock_qty')}</p>
              <p className="text-2xl font-bold text-on-surface mt-1">{totalStock}</p>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm border border-outline-variant/30">
              <p className="text-sm text-on-surface-variant">{t('stock_value')}</p>
              <p className="text-2xl font-bold text-on-surface mt-1">฿{totalStockValue.toLocaleString()}</p>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm border border-outline-variant/30">
              <p className="text-sm text-on-surface-variant">{t('low_stock_count')}</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{lowStockCount}</p>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-outline-variant/30">
            <h3 className="text-base font-headline font-bold text-on-surface mb-4">{t('stock_by_category')}</h3>
            <div className="space-y-3">
              {productCategories.map((cat) => {
                const catProducts = products.filter((p) => p.category === cat.key);
                const catValue = catProducts.reduce((s, p) => s + p.stock * p.price, 0);
                const catCount = catProducts.length;
                return (
                  <div key={cat.key} className="flex items-center gap-4">
                    <span className="text-sm text-on-surface-variant w-24">{cat.nameTh}</span>
                    <div className="flex-1 h-6 bg-surface-container-high rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full flex items-center justify-end pr-2"
                        style={{ width: `${Math.max(totalStockValue > 0 ? (catValue / totalStockValue) * 100 : 0, 5)}%` }}
                      >
                        <span className="text-[10px] text-on-primary font-medium whitespace-nowrap">
                          {catCount} SKUs
                        </span>
                      </div>
                    </div>
                    <span className="text-sm font-medium text-on-surface w-28 text-right">
                      ฿{catValue.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/30 overflow-hidden">
            <div className="px-6 py-4 border-b border-outline-variant/20">
              <h3 className="text-base font-headline font-bold text-on-surface">{t('low_stock_table')}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-container-high text-on-surface-variant">
                    <th className="text-left px-4 py-3 font-semibold">SKU</th>
                    <th className="text-left px-4 py-3 font-semibold">{t('items_col')}</th>
                    <th className="text-right px-4 py-3 font-semibold">{t('total_stock_qty')}</th>
                    <th className="text-right px-4 py-3 font-semibold">{t('min_order_amount')}</th>
                    <th className="text-center px-4 py-3 font-semibold">{t('status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {products
                    .filter((p) => p.stock <= p.minStock)
                    .map((p) => (
                      <tr key={p.id} className="hover:bg-surface-container-low">
                        <td className="px-4 py-3 font-mono text-xs">{p.sku}</td>
                        <td className="px-4 py-3 text-on-surface">{p.nameTh}</td>
                        <td className="px-4 py-3 text-right font-medium text-red-600">{p.stock}</td>
                        <td className="px-4 py-3 text-right text-on-surface-variant">{p.minStock}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${p.stock === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                            {p.stock === 0 ? 'หมด' : 'ใกล้หมด'}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Branch Performance */}
      {!isLoading && reportType === 'branch' && (
        <div className="space-y-6">
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-outline-variant/30">
            <h3 className="text-base font-headline font-bold text-on-surface mb-4">{t('branch_comparison_chart')}</h3>
            <div className="space-y-4">
              {branchPerf.map((b) => (
                <div key={b.code}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-on-surface">
                      <span className="font-medium text-primary mr-2">{b.code}</span>
                      {b.name}
                    </span>
                    <span className="font-medium text-on-surface">
                      ฿{b.revenue.toLocaleString()} ({b.orders} orders)
                    </span>
                  </div>
                  <div className="w-full h-4 bg-surface-container-high rounded-full">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${(b.revenue / maxBranchRev) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/30 overflow-hidden">
            <div className="px-6 py-4 border-b border-outline-variant/20">
              <h3 className="text-base font-headline font-bold text-on-surface">{t('comparison_table')}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-container-high text-on-surface-variant">
                    <th className="text-left px-4 py-3 font-semibold">{t('branch_col')}</th>
                    <th className="text-right px-4 py-3 font-semibold">{t('total_orders')}</th>
                    <th className="text-right px-4 py-3 font-semibold">{t('revenue')}</th>
                    <th className="text-right px-4 py-3 font-semibold">{t('avg_per_order')}</th>
                    <th className="text-right px-4 py-3 font-semibold">{t('share_percent')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {branchPerf.map((b) => {
                    const totalBranchRev = branchPerf.reduce((s, x) => s + x.revenue, 0);
                    const pct = totalBranchRev > 0 ? ((b.revenue / totalBranchRev) * 100).toFixed(1) : '0';
                    const avg = b.orders > 0 ? Math.round(b.revenue / b.orders) : 0;
                    return (
                      <tr key={b.code} className="hover:bg-surface-container-low">
                        <td className="px-4 py-3">
                          <span className="font-medium text-primary mr-2">{b.code}</span>
                          <span className="text-on-surface">{b.name}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-on-surface">{b.orders}</td>
                        <td className="px-4 py-3 text-right font-medium text-on-surface">
                          ฿{b.revenue.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-on-surface-variant">
                          ฿{avg.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-on-surface-variant">{pct}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Customer Analysis */}
      {!isLoading && reportType === 'customer' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm border border-outline-variant/30">
              <p className="text-sm text-on-surface-variant">{t('total_b2b')}</p>
              <p className="text-2xl font-bold text-on-surface mt-1">{customers.length}</p>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm border border-outline-variant/30">
              <p className="text-sm text-on-surface-variant">{t('customers_with_orders')}</p>
              <p className="text-2xl font-bold text-on-surface mt-1">{customersWithOrders}</p>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm border border-outline-variant/30">
              <p className="text-sm text-on-surface-variant">{t('total_outstanding')}</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">฿{totalOutstanding.toLocaleString()}</p>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-outline-variant/30">
            <h3 className="text-base font-headline font-bold text-on-surface mb-4">
              {t('ranked_by_outstanding')}
            </h3>
            <div className="space-y-3">
              {topCustomers.map((c) => {
                const balance = c.outstandingBalance ?? 0;
                const limit = c.creditLimit ?? 1;
                const name = c.companyName ?? '';
                const pct = limit > 0 ? Math.round((balance / limit) * 100) : 0;
                return (
                  <div key={c.id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-on-surface-variant">{name}</span>
                      <span className="font-medium text-on-surface">
                        ฿{balance.toLocaleString()} / ฿{limit.toLocaleString()} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-surface-container-high rounded-full">
                      <div
                        className={`h-full rounded-full ${pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-amber-500' : 'bg-green-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Expenses Report */}
      {!isLoading && reportType === 'expenses' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm border border-outline-variant/30">
              <p className="text-sm text-on-surface-variant">{locale === 'th' ? 'ค่าใช้จ่ายรวม' : 'Total Expenses'}</p>
              <p className="text-2xl font-bold text-error mt-1">฿{totalExpenses.toLocaleString()}</p>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm border border-outline-variant/30">
              <p className="text-sm text-on-surface-variant">{locale === 'th' ? 'จำนวนรายการ' : 'Entries'}</p>
              <p className="text-2xl font-bold text-on-surface mt-1">{expenses.length}</p>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm border border-outline-variant/30">
              <p className="text-sm text-on-surface-variant">{locale === 'th' ? 'GST เคลมได้' : 'GST Claimable'}</p>
              <p className="text-2xl font-bold text-on-surface mt-1">฿{totalGstClaimable.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
          </div>

          {/* Monthly trend */}
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-outline-variant/30">
            <h3 className="text-base font-headline font-bold text-on-surface mb-4">
              {locale === 'th' ? 'แนวโน้มค่าใช้จ่ายรายเดือน' : 'Monthly Expense Trend'}
            </h3>
            {monthlyExpEntries.length === 0 ? (
              <p className="text-sm text-on-surface-variant">{locale === 'th' ? 'ไม่มีข้อมูล' : 'No data'}</p>
            ) : (
              <div className="flex items-end gap-4 h-48">
                {monthlyExpEntries.map(([month, amt]) => (
                  <div key={month} className="flex-1 flex flex-col items-center gap-2">
                    <span className="text-xs text-on-surface-variant font-medium">฿{(amt / 1000).toFixed(1)}k</span>
                    <div
                      className="w-full bg-error rounded-t-md"
                      style={{ height: `${(amt / maxMonthlyExp) * 140}px` }}
                    />
                    <span className="text-[10px] text-on-surface-variant">{month.slice(5)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* By category */}
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-outline-variant/30">
            <h3 className="text-base font-headline font-bold text-on-surface mb-4">
              {locale === 'th' ? 'แยกตามประเภท' : 'By Category'}
            </h3>
            {expByCategory.length === 0 ? (
              <p className="text-sm text-on-surface-variant">{locale === 'th' ? 'ไม่มีข้อมูล' : 'No data'}</p>
            ) : (
              <div className="space-y-3">
                {expByCategory.map(({ cat, total }) => {
                  const label = locale === 'th' ? expenseCategoryLabels[cat].th : expenseCategoryLabels[cat].en;
                  const pct = (total / totalExpenses) * 100;
                  return (
                    <div key={cat}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-on-surface-variant">{label}</span>
                        <span className="font-medium text-on-surface">
                          ฿{total.toLocaleString()} ({pct.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-surface-container-high rounded-full">
                        <div
                          className="h-full bg-error rounded-full"
                          style={{ width: `${(total / maxExpCat) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent expenses table */}
          <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/30 overflow-hidden">
            <div className="px-6 py-4 border-b border-outline-variant/20">
              <h3 className="text-base font-headline font-bold text-on-surface">
                {locale === 'th' ? 'รายการล่าสุด' : 'Recent Entries'}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-container-high text-on-surface-variant">
                    <th className="text-left px-4 py-3 font-semibold">{locale === 'th' ? 'วันที่' : 'Date'}</th>
                    <th className="text-left px-4 py-3 font-semibold">{locale === 'th' ? 'ประเภท' : 'Category'}</th>
                    <th className="text-left px-4 py-3 font-semibold">{locale === 'th' ? 'รายละเอียด' : 'Description'}</th>
                    <th className="text-left px-4 py-3 font-semibold">{locale === 'th' ? 'จ่ายให้' : 'Paid to'}</th>
                    <th className="text-right px-4 py-3 font-semibold">{locale === 'th' ? 'จำนวน' : 'Amount'}</th>
                    <th className="text-right px-4 py-3 font-semibold">GST</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {expenses.slice(0, 20).map((e) => (
                    <tr key={e.id} className="hover:bg-surface-container-low">
                      <td className="px-4 py-3 text-on-surface-variant whitespace-nowrap">
                        {new Date(e.date).toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-AU', { day: 'numeric', month: 'short', year: '2-digit' })}
                      </td>
                      <td className="px-4 py-3 text-on-surface">
                        {locale === 'th' ? expenseCategoryLabels[e.category].th : expenseCategoryLabels[e.category].en}
                      </td>
                      <td className="px-4 py-3 text-on-surface">{e.description || '—'}</td>
                      <td className="px-4 py-3 text-on-surface-variant">{e.paidTo || '—'}</td>
                      <td className="px-4 py-3 text-right font-medium text-on-surface">
                        ฿{e.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right text-on-surface-variant">
                        {e.gstAmount ? `฿${e.gstAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
