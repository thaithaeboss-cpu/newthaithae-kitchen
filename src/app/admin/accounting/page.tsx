'use client';

import { useState, useEffect } from 'react';
import {
  financialSummary,
  branches,
  orders,
} from '@/data/mock-data';
import { useAccountingEntries, useFinancialSummary } from '@/lib/useFirestore';
import { updateAccountingEntry, getExpenses, type Expense, type ExpenseCategory } from '@/lib/firestore';
import { useLanguage } from '@/lib/language-context';

const expenseCategoryLabels: Record<ExpenseCategory, { th: string; en: string }> = {
  salary:     { th: 'ค่าแรงพนักงาน', en: 'Staff Salary' },
  ingredient: { th: 'วัตถุดิบ',       en: 'Ingredients' },
  utility:    { th: 'ค่าสาธารณูปโภค', en: 'Utilities' },
  packaging:  { th: 'บรรจุภัณฑ์',     en: 'Packaging' },
  transport:  { th: 'ขนส่ง',          en: 'Transport' },
  other:      { th: 'อื่นๆ',           en: 'Other' },
};

type Period = 'today' | 'week' | 'month' | 'custom';

const pad = (n: number) => String(n).padStart(2, '0');
const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function getPeriodDates(
  period: Period,
  customStart: string,
  customEnd: string,
): { startDate: string; endDate: string } {
  const now = new Date();
  const end = fmtDate(now);
  if (period === 'today') {
    return { startDate: end, endDate: end };
  }
  if (period === 'week') {
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    return { startDate: fmtDate(start), endDate: end };
  }
  if (period === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { startDate: fmtDate(start), endDate: end };
  }
  // custom — use user-selected dates
  return { startDate: customStart, endDate: customEnd };
}

export default function AccountingPage() {
  const { t, locale } = useLanguage();
  const [period, setPeriod] = useState<Period>('month');
  const [activeTab, setActiveTab] = useState<'overview' | 'invoices' | 'pnl'>('overview');

  // Default custom range = last 30 days
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return fmtDate(d);
  });
  const [customEnd, setCustomEnd] = useState(() => fmtDate(new Date()));

  const { startDate, endDate } = getPeriodDates(period, customStart, customEnd);

  const { entries, loading, refresh } = useAccountingEntries();
  const { summary, loading: loadingSummary } = useFinancialSummary(startDate, endDate);

  // Fetch expenses from new `expenses` collection
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loadingExpenses, setLoadingExpenses] = useState(true);
  useEffect(() => {
    getExpenses()
      .then(setExpenses)
      .catch((err) => console.error('Failed to load expenses:', err))
      .finally(() => setLoadingExpenses(false));
  }, []);

  // Filter expenses by selected period
  const periodExpenses = expenses.filter((e) => e.date >= startDate && e.date <= endDate);
  const expensesFromNewCollection = periodExpenses.reduce((s, e) => s + e.amount, 0);

  const isLoading = loading || loadingSummary || loadingExpenses;

  // Derive KPI values from live summary + new expenses collection
  const totalRevenue = summary.revenue;
  const totalExpenses = summary.expenses + expensesFromNewCollection;
  const netProfit = totalRevenue - totalExpenses;

  // Derive invoice list from live data
  const invoices = entries.filter((e) => e.type === 'invoice');

  // Revenue by branch (still uses mock orders + branches for the chart)
  const revByBranch = branches
    .filter((b) => b.isActive)
    .map((b) => {
      const branchOrders = orders.filter((o) => o.branchId === b.id && o.status !== 'cancelled');
      const total = branchOrders.reduce((sum, o) => sum + o.total, 0);
      return { name: locale === 'th' ? b.nameTh : b.nameEn, total };
    })
    .sort((a, b) => b.total - a.total);

  const maxBranchRev = Math.max(...revByBranch.map((b) => b.total), 1);

  // Expense categories — merged from legacy entries + new expenses collection
  const expCategories: Record<string, { label: string; amount: number }> = {};
  entries
    .filter((e) => e.type === 'expense')
    .forEach((e) => {
      const cat = (e as unknown as Record<string, unknown>).category as string | undefined;
      const key = cat || 'other';
      if (!expCategories[key]) {
        const labels: Record<string, string> = {
          raw_materials: 'วัตถุดิบ',
          logistics: 'ค่าขนส่ง',
          payroll: 'เงินเดือน',
          utilities: 'ค่าสาธารณูปโภค',
          maintenance: 'ค่าบำรุงรักษา',
          other: 'อื่นๆ',
        };
        expCategories[key] = { label: labels[key] || key, amount: 0 };
      }
      expCategories[key].amount += e.amount;
    });
  // Add expenses from new collection
  periodExpenses.forEach((e) => {
    const label = locale === 'th' ? expenseCategoryLabels[e.category].th : expenseCategoryLabels[e.category].en;
    if (!expCategories[e.category]) {
      expCategories[e.category] = { label, amount: 0 };
    }
    expCategories[e.category].amount += e.amount;
  });

  const expCatList = Object.values(expCategories).sort((a, b) => b.amount - a.amount);
  const maxExpCat = Math.max(...expCatList.map((c) => c.amount), 1);

  // Build merged entries list for "recent entries" table
  type MergedEntry = {
    id: string;
    date: string;
    type: 'revenue' | 'expense' | 'invoice';
    description: string;
    reference: string;
    amount: number;
    paymentStatus: string;
  };
  const expenseAsEntries: MergedEntry[] = periodExpenses.map((e) => ({
    id: e.id,
    date: e.date,
    type: 'expense' as const,
    description: e.description || (locale === 'th' ? expenseCategoryLabels[e.category].th : expenseCategoryLabels[e.category].en),
    reference: e.paidTo || '—',
    amount: e.amount,
    paymentStatus: 'paid',
  }));
  const legacyAsEntries: MergedEntry[] = entries.map((e) => {
    const entry = e as unknown as Record<string, unknown>;
    return {
      id: e.id,
      date: ((entry.date ?? entry.createdAt) as string | undefined)?.toString().slice(0, 10) ?? '',
      type: e.type,
      description: e.description ?? '',
      reference: e.reference ?? '',
      amount: e.amount,
      paymentStatus: ((entry.paymentStatus ?? entry.status) as string | undefined) ?? 'pending',
    };
  });
  const mergedEntries: MergedEntry[] = [...expenseAsEntries, ...legacyAsEntries].sort((a, b) =>
    b.date.localeCompare(a.date),
  );

  const handleMarkPaid = async (id: string) => {
    try {
      await updateAccountingEntry(id, { paymentStatus: 'paid' });
      refresh();
    } catch (err) {
      console.error('Failed to mark as paid:', err);
    }
  };

  const statusBadge = (status: string) => {
    if (status === 'paid')
      return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-700">{t('status_paid')}</span>;
    if (status === 'pending')
      return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-700">{t('status_pending_payment')}</span>;
    return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-700">{t('status_overdue')}</span>;
  };

  const typeBadge = (type: string) => {
    if (type === 'revenue')
      return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-700">{t('revenue_label')}</span>;
    if (type === 'expense')
      return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-700">{t('expense_label')}</span>;
    return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">{t('invoice_label')}</span>;
  };

  // Helper: get display date from entry (supports both `date` and `createdAt`)
  const entryDate = (e: Record<string, unknown>) => {
    const d = (e.date ?? e.createdAt) as string | undefined;
    if (!d) return '';
    return typeof d === 'string' ? d.slice(0, 10) : String(d);
  };

  // Helper: get status from entry (supports both `status` and `paymentStatus`)
  const entryStatus = (e: Record<string, unknown>) => {
    return ((e.paymentStatus ?? e.status) as string | undefined) ?? 'pending';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-headline font-bold text-on-surface">{t('accounting_title')}</h1>
        <div className="flex gap-2">
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-surface-container-high text-on-surface rounded-lg text-sm font-medium border border-outline-variant/30 hover:opacity-90">
            <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
            PDF
          </button>
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-surface-container-high text-on-surface rounded-lg text-sm font-medium border border-outline-variant/30 hover:opacity-90">
            <span className="material-symbols-outlined text-[18px]">table_view</span>
            Excel
          </button>
        </div>
      </div>

      {/* Period Selector */}
      <div className="flex gap-2 flex-wrap items-center">
        {([
          { key: 'today', label: t('today') },
          { key: 'week', label: t('this_week') },
          { key: 'month', label: t('this_month') },
          { key: 'custom', label: t('custom_range') },
        ] as const).map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              period === p.key
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            {p.label}
          </button>
        ))}

        {period === 'custom' && (
          <div className="flex items-center gap-2 ml-2 flex-wrap">
            <input
              type="date"
              value={customStart}
              max={customEnd || undefined}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-3 py-2 rounded-lg bg-surface-container-low border border-outline-variant text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <span className="text-on-surface-variant text-sm">—</span>
            <input
              type="date"
              value={customEnd}
              min={customStart || undefined}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-3 py-2 rounded-lg bg-surface-container-low border border-outline-variant text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        )}

        {/* Active range label */}
        <span className="ml-auto text-xs text-on-surface-variant">
          {locale === 'th' ? 'ช่วง' : 'Range'}:{' '}
          <span className="font-semibold text-on-surface">{startDate}</span>
          {' → '}
          <span className="font-semibold text-on-surface">{endDate}</span>
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {isLoading ? (
          <>
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-surface-container-lowest rounded-xl p-5 shadow-sm border border-outline-variant/30 animate-pulse">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-surface-container-high" />
                  <div className="h-4 w-20 rounded bg-surface-container-high" />
                </div>
                <div className="h-8 w-32 rounded bg-surface-container-high" />
              </div>
            ))}
          </>
        ) : (
          <>
            <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm border border-outline-variant/30">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <span className="material-symbols-outlined text-green-700 text-[22px]">trending_up</span>
                </div>
                <span className="text-sm text-on-surface-variant">{t('revenue')}</span>
              </div>
              <p className="text-2xl font-bold text-green-700">฿{totalRevenue.toLocaleString()}</p>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm border border-outline-variant/30">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                  <span className="material-symbols-outlined text-red-700 text-[22px]">trending_down</span>
                </div>
                <span className="text-sm text-on-surface-variant">{t('expenses')}</span>
              </div>
              <p className="text-2xl font-bold text-red-700">฿{totalExpenses.toLocaleString()}</p>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm border border-outline-variant/30">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <span className="material-symbols-outlined text-blue-700 text-[22px]">account_balance</span>
                </div>
                <span className="text-sm text-on-surface-variant">{t('net_profit')}</span>
              </div>
              <p className="text-2xl font-bold text-blue-700">฿{netProfit.toLocaleString()}</p>
            </div>
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-outline-variant/30">
        {([
          { key: 'overview', label: t('overview') },
          { key: 'invoices', label: t('invoices') },
          { key: 'pnl', label: t('profit_loss') },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Revenue by Branch */}
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-outline-variant/30">
            <h3 className="text-base font-headline font-bold text-on-surface mb-4">{t('revenue_by_branch')}</h3>
            <div className="space-y-3">
              {revByBranch.map((b) => (
                <div key={b.name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-on-surface-variant truncate mr-2">{b.name}</span>
                    <span className="font-medium text-on-surface whitespace-nowrap">฿{b.total.toLocaleString()}</span>
                  </div>
                  <div className="w-full h-2 bg-surface-container-high rounded-full">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${(b.total / maxBranchRev) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Expense Categories */}
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-outline-variant/30">
            <h3 className="text-base font-headline font-bold text-on-surface mb-4">{t('expense_categories')}</h3>
            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-4 w-full rounded bg-surface-container-high mb-1" />
                    <div className="h-2 w-full rounded-full bg-surface-container-high" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {expCatList.map((c) => (
                  <div key={c.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-on-surface-variant">{c.label}</span>
                      <span className="font-medium text-on-surface">฿{c.amount.toLocaleString()}</span>
                    </div>
                    <div className="w-full h-2 bg-surface-container-high rounded-full">
                      <div
                        className="h-full bg-tertiary rounded-full"
                        style={{ width: `${(c.amount / maxExpCat) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Payments Received Log */}
          <div className="xl:col-span-2 bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/30 overflow-hidden">
            <div className="px-6 py-4 border-b border-outline-variant/20">
              <h3 className="text-base font-headline font-bold text-on-surface">{t('recent_entries')}</h3>
            </div>
            {loading ? (
              <div className="p-6 space-y-3">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-10 rounded bg-surface-container-high animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-container-high text-on-surface-variant">
                      <th className="text-left px-4 py-3 font-semibold">{t('date')}</th>
                      <th className="text-center px-4 py-3 font-semibold">{t('status')}</th>
                      <th className="text-left px-4 py-3 font-semibold">{t('description') || 'รายละเอียด'}</th>
                      <th className="text-left px-4 py-3 font-semibold">{t('reference') || 'อ้างอิง'}</th>
                      <th className="text-right px-4 py-3 font-semibold">{t('amount')}</th>
                      <th className="text-center px-4 py-3 font-semibold">{t('payment_status')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20">
                    {mergedEntries.map((e) => (
                      <tr key={`${e.type}-${e.id}`} className="hover:bg-surface-container-low transition-colors">
                        <td className="px-4 py-3 text-on-surface-variant whitespace-nowrap">{e.date}</td>
                        <td className="px-4 py-3 text-center">{typeBadge(e.type)}</td>
                        <td className="px-4 py-3 text-on-surface">{e.description}</td>
                        <td className="px-4 py-3 font-mono text-xs text-on-surface-variant">{e.reference}</td>
                        <td className={`px-4 py-3 text-right font-medium ${e.type === 'expense' ? 'text-red-600' : 'text-green-700'}`}>
                          {e.type === 'expense' ? '-' : ''}฿{e.amount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-center">{statusBadge(e.paymentStatus)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Invoices Tab */}
      {activeTab === 'invoices' && (
        <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/30 overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-10 rounded bg-surface-container-high animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-container-high text-on-surface-variant">
                    <th className="text-left px-4 py-3 font-semibold">{t('invoice_number')}</th>
                    <th className="text-left px-4 py-3 font-semibold">{t('customer_branch')}</th>
                    <th className="text-right px-4 py-3 font-semibold">{t('amount')}</th>
                    <th className="text-left px-4 py-3 font-semibold">{t('date')}</th>
                    <th className="text-center px-4 py-3 font-semibold">{t('payment_status')}</th>
                    <th className="text-center px-4 py-3 font-semibold">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {invoices.map((inv) => {
                    const entry = inv as unknown as Record<string, unknown>;
                    const status = entryStatus(entry);
                    return (
                      <tr key={inv.id} className="hover:bg-surface-container-low transition-colors">
                        <td className="px-4 py-3 font-mono font-medium text-on-surface">{inv.reference}</td>
                        <td className="px-4 py-3 text-on-surface">{inv.description}</td>
                        <td className="px-4 py-3 text-right font-medium text-on-surface">
                          ฿{inv.amount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-on-surface-variant">{entryDate(entry)}</td>
                        <td className="px-4 py-3 text-center">{statusBadge(status)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button className="p-1.5 rounded-lg hover:bg-surface-container-high" title={t('view_invoice')}>
                              <span className="material-symbols-outlined text-[18px] text-on-surface-variant">visibility</span>
                            </button>
                            <button className="p-1.5 rounded-lg hover:bg-surface-container-high" title={t('download_pdf')}>
                              <span className="material-symbols-outlined text-[18px] text-on-surface-variant">download</span>
                            </button>
                            <button
                              className="p-1.5 rounded-lg hover:bg-surface-container-high"
                              title={t('send_reminder')}
                              onClick={() => handleMarkPaid(inv.id)}
                            >
                              <span className="material-symbols-outlined text-[18px] text-on-surface-variant">send</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* P&L Tab */}
      {activeTab === 'pnl' && (
        <div className="space-y-6">
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-outline-variant/30">
            <h3 className="text-base font-headline font-bold text-on-surface mb-4">{t('monthly_pl_summary')}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-container-high text-on-surface-variant">
                    <th className="text-left px-4 py-3 font-semibold">{t('month')}</th>
                    <th className="text-right px-4 py-3 font-semibold">{t('revenue')}</th>
                    <th className="text-right px-4 py-3 font-semibold">{t('expenses')}</th>
                    <th className="text-right px-4 py-3 font-semibold">{t('net_profit')}</th>
                    <th className="text-right px-4 py-3 font-semibold">{t('orders_count')}</th>
                    <th className="text-right px-4 py-3 font-semibold">{t('avg_order_value')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {financialSummary.map((f) => (
                    <tr key={f.month} className="hover:bg-surface-container-low transition-colors">
                      <td className="px-4 py-3 font-medium text-on-surface">{f.monthLabel}</td>
                      <td className="px-4 py-3 text-right text-green-700 font-medium">
                        ฿{f.revenue.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-red-600 font-medium">
                        ฿{f.expenses.toLocaleString()}
                      </td>
                      <td className={`px-4 py-3 text-right font-bold ${f.profit >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
                        ฿{f.profit.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-on-surface">{f.orderCount}</td>
                      <td className="px-4 py-3 text-right text-on-surface-variant">
                        ฿{f.averageOrderValue.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-surface-container font-bold">
                    <td className="px-4 py-3 text-on-surface">{t('total_all')}</td>
                    <td className="px-4 py-3 text-right text-green-700">
                      ฿{financialSummary.reduce((s, f) => s + f.revenue, 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-red-600">
                      ฿{financialSummary.reduce((s, f) => s + f.expenses, 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-blue-700">
                      ฿{financialSummary.reduce((s, f) => s + f.profit, 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-on-surface">
                      {financialSummary.reduce((s, f) => s + f.orderCount, 0)}
                    </td>
                    <td className="px-4 py-3 text-right text-on-surface-variant">-</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* P&L Chart */}
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-outline-variant/30">
            <h3 className="text-base font-headline font-bold text-on-surface mb-4">{t('monthly_trend')}</h3>
            <div className="flex items-center gap-4 mb-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-green-500" />
                <span className="text-on-surface-variant">{t('revenue')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-red-400" />
                <span className="text-on-surface-variant">{t('expenses')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-blue-500" />
                <span className="text-on-surface-variant">{t('profit_label')}</span>
              </div>
            </div>
            <div className="flex items-end gap-3 h-48">
              {financialSummary.map((f) => {
                const maxVal = Math.max(...financialSummary.map((x) => x.revenue));
                return (
                  <div key={f.month} className="flex-1 flex flex-col items-center gap-1">
                    <div className="flex gap-0.5 items-end w-full justify-center" style={{ height: '160px' }}>
                      <div
                        className="w-1/4 bg-green-500 rounded-t-sm"
                        style={{ height: `${(f.revenue / maxVal) * 140}px` }}
                      />
                      <div
                        className="w-1/4 bg-red-400 rounded-t-sm"
                        style={{ height: `${(f.expenses / maxVal) * 140}px` }}
                      />
                      <div
                        className="w-1/4 bg-blue-500 rounded-t-sm"
                        style={{ height: `${(f.profit / maxVal) * 140}px` }}
                      />
                    </div>
                    <span className="text-[10px] text-on-surface-variant">
                      {f.monthLabel.split(' ')[0]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
