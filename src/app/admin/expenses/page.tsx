'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/lib/language-context';
import {
  getEmployees, addEmployee, deleteEmployee, type Employee,
  getSuppliers, addSupplier, deleteSupplier, type Supplier,
  getExpenses, addExpense, deleteExpense,
  type Expense, type ExpenseCategory,
} from '@/lib/firestore';

// ======================== TYPES ========================

type PeriodMode = 'week' | 'month' | 'custom';

// ======================== CONSTANTS ========================

const categoryConfig: Record<ExpenseCategory, { labelTh: string; labelEn: string; icon: string; color: string }> = {
  salary:     { labelTh: 'ค่าแรงพนักงาน', labelEn: 'Staff Salary',   icon: 'badge',           color: 'bg-blue-500/20 text-blue-800' },
  ingredient: { labelTh: 'วัตถุดิบ',       labelEn: 'Ingredients',    icon: 'grocery',         color: 'bg-green-500/20 text-green-800' },
  utility:    { labelTh: 'ค่าสาธารณูปโภค', labelEn: 'Utilities',      icon: 'bolt',            color: 'bg-yellow-500/20 text-yellow-800' },
  packaging:  { labelTh: 'บรรจุภัณฑ์',     labelEn: 'Packaging',      icon: 'inventory_2',     color: 'bg-purple-500/20 text-purple-800' },
  transport:  { labelTh: 'ขนส่ง',          labelEn: 'Transport',      icon: 'local_shipping',  color: 'bg-orange-500/20 text-orange-800' },
  other:      { labelTh: 'อื่นๆ',           labelEn: 'Other',          icon: 'more_horiz',      color: 'bg-surface-container text-on-surface' },
};

const EMPTY_FORM = {
  date: new Date().toISOString().split('T')[0],
  category: 'salary' as ExpenseCategory,
  description: '',
  amount: '',
  paidTo: '',
  transferAmount: '',
  gstAmount: '',
};

// ======================== HELPERS ========================

function getMondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getSundayOf(monday: Date): Date {
  const d = new Date(monday);
  d.setDate(d.getDate() + 6);
  return d;
}

function toISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatWeekLabel(monday: Date, locale: string): string {
  const sunday = getSundayOf(monday);
  const fmt = (d: Date) =>
    d.toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-AU', { day: 'numeric', month: 'short' });
  return `${fmt(monday)} – ${fmt(sunday)}`;
}

// ======================== PAGE ========================

export default function ExpensesPage() {
  const { locale } = useLanguage();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [filterCategory, setFilterCategory] = useState<'all' | ExpenseCategory>('all');
  const [periodMode, setPeriodMode] = useState<PeriodMode>('week');

  // Rosters
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showEmployeeManager, setShowEmployeeManager] = useState(false);
  const [showSupplierManager, setShowSupplierManager] = useState(false);
  const [newName, setNewName] = useState('');
  const [savingRoster, setSavingRoster] = useState(false);

  async function refreshAll() {
    setLoading(true);
    try {
      const [emps, sups, exps] = await Promise.all([getEmployees(), getSuppliers(), getExpenses()]);
      setEmployees(emps);
      setSuppliers(sups);
      setExpenses(exps);
    } catch (err) {
      console.error('Failed to load expenses data:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refreshAll(); }, []);

  async function handleAddRoster(kind: 'employee' | 'supplier') {
    const name = newName.trim();
    if (!name) return;
    setSavingRoster(true);
    try {
      if (kind === 'employee') {
        await addEmployee(name);
        setEmployees(await getEmployees());
      } else {
        await addSupplier(name);
        setSuppliers(await getSuppliers());
      }
      setNewName('');
    } finally {
      setSavingRoster(false);
    }
  }

  async function handleDeleteRoster(kind: 'employee' | 'supplier', id: string) {
    if (kind === 'employee') {
      await deleteEmployee(id);
      setEmployees(await getEmployees());
    } else {
      await deleteSupplier(id);
      setSuppliers(await getSuppliers());
    }
  }

  // Auto-calculate cash for salary
  const calcCash = (() => {
    if (form.category !== 'salary') return null;
    const total = parseFloat(form.amount || '0') || 0;
    const t = parseFloat(form.transferAmount || '0') || 0;
    return Math.max(0, total - t);
  })();

  const [currentWeekMonday, setCurrentWeekMonday] = useState<Date>(() => getMondayOf(new Date()));
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().split('T')[0]);

  function prevWeek() {
    setCurrentWeekMonday((d) => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; });
  }
  function nextWeek() {
    setCurrentWeekMonday((d) => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; });
  }

  async function handleAdd() {
    const isSalary = form.category === 'salary';
    const isIngredient = form.category === 'ingredient';
    const total = parseFloat(form.amount || '0') || 0;
    if (total <= 0) return;

    const transfer = isSalary ? Math.min(total, parseFloat(form.transferAmount || '0') || 0) : 0;
    const cash = isSalary ? Math.max(0, total - transfer) : 0;
    const gst = isIngredient ? (parseFloat(form.gstAmount || '0') || 0) : 0;

    const payload: Omit<Expense, 'id' | 'createdAt'> = {
      date: form.date,
      category: form.category,
      description: form.description.trim(),
      amount: total,
      paidTo: form.paidTo.trim() || undefined,
      ...(isSalary ? { transferAmount: transfer, cashAmount: cash } : {}),
      ...(isIngredient && gst > 0 ? { gstAmount: gst } : {}),
    };

    setSaving(true);
    try {
      await addExpense(payload);
      setExpenses(await getExpenses());
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch (err) {
      console.error('Failed to add expense:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteExpense(id);
      setExpenses((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      console.error('Failed to delete expense:', err);
    }
  }

  // Filter
  const filtered = expenses.filter((e) => {
    const matchCat = filterCategory === 'all' || e.category === filterCategory;
    if (periodMode === 'week') {
      const weekStart = toISO(currentWeekMonday);
      const weekEnd = toISO(getSundayOf(currentWeekMonday));
      return matchCat && e.date >= weekStart && e.date <= weekEnd;
    } else if (periodMode === 'custom') {
      return matchCat && e.date >= customFrom && e.date <= customTo;
    } else {
      return matchCat && e.date.startsWith(filterMonth);
    }
  });

  const totalFiltered = filtered.reduce((s, e) => s + e.amount, 0);
  const totalGstFiltered = filtered.reduce((s, e) => s + (e.gstAmount ?? 0), 0);

  const byCategory = (Object.keys(categoryConfig) as ExpenseCategory[]).map((cat) => ({
    cat,
    total: filtered.filter((e) => e.category === cat).reduce((s, e) => s + e.amount, 0),
  })).filter((c) => c.total > 0);

  const catLabel = (cat: ExpenseCategory) =>
    locale === 'th' ? categoryConfig[cat].labelTh : categoryConfig[cat].labelEn;

  const isThisWeek = toISO(currentWeekMonday) === toISO(getMondayOf(new Date()));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-headline text-on-surface">
            {locale === 'th' ? 'ค่าใช้จ่าย' : 'Expenses'}
          </h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            {locale === 'th' ? 'บันทึกค่าใช้จ่ายรายสัปดาห์' : 'Track weekly expenses'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => { setShowSupplierManager(true); setNewName(''); }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-container-high text-on-surface text-sm font-semibold hover:bg-surface-container-highest transition-colors"
          >
            <span className="material-symbols-outlined text-base">storefront</span>
            {locale === 'th' ? 'ซัพพลายเออร์' : 'Suppliers'}
          </button>
          <button
            onClick={() => { setShowEmployeeManager(true); setNewName(''); }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-container-high text-on-surface text-sm font-semibold hover:bg-surface-container-highest transition-colors"
          >
            <span className="material-symbols-outlined text-base">group</span>
            {locale === 'th' ? 'พนักงาน' : 'Staff'}
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined text-base">add</span>
            {locale === 'th' ? 'เพิ่มรายการ' : 'Add Expense'}
          </button>
        </div>
      </div>

      {/* Period mode toggle */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex rounded-xl overflow-hidden border border-outline-variant">
          <button
            onClick={() => setPeriodMode('week')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${periodMode === 'week' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
          >
            {locale === 'th' ? 'รายอาทิตย์' : 'Weekly'}
          </button>
          <button
            onClick={() => setPeriodMode('month')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${periodMode === 'month' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
          >
            {locale === 'th' ? 'รายเดือน' : 'Monthly'}
          </button>
          <button
            onClick={() => setPeriodMode('custom')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${periodMode === 'custom' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
          >
            {locale === 'th' ? 'กำหนดเอง' : 'Custom'}
          </button>
        </div>

        {periodMode === 'week' && (
          <div className="flex items-center gap-2">
            <button onClick={prevWeek} className="w-8 h-8 flex items-center justify-center rounded-lg bg-surface-container-high hover:bg-surface-container-highest transition-colors">
              <span className="material-symbols-outlined text-base">chevron_left</span>
            </button>
            <div className="text-sm font-medium text-on-surface px-2">
              {formatWeekLabel(currentWeekMonday, locale)}
              {isThisWeek && (
                <span className="ml-2 text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  {locale === 'th' ? 'อาทิตย์นี้' : 'This week'}
                </span>
              )}
            </div>
            <button onClick={nextWeek} className="w-8 h-8 flex items-center justify-center rounded-lg bg-surface-container-high hover:bg-surface-container-highest transition-colors">
              <span className="material-symbols-outlined text-base">chevron_right</span>
            </button>
          </div>
        )}

        {periodMode === 'month' && (
          <input
            type="month"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          />
        )}

        {periodMode === 'custom' && (
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="date"
              value={customFrom}
              max={customTo || undefined}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <span className="text-on-surface-variant text-sm">—</span>
            <input
              type="date"
              value={customTo}
              min={customFrom || undefined}
              onChange={(e) => setCustomTo(e.target.value)}
              className="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        )}
      </div>

      {/* Category filter pills */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilterCategory('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filterCategory === 'all' ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'}`}
        >
          {locale === 'th' ? 'ทั้งหมด' : 'All'}
        </button>
        {(Object.keys(categoryConfig) as ExpenseCategory[]).map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filterCategory === cat ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'}`}
          >
            {catLabel(cat)}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      {byCategory.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {byCategory.map(({ cat, total }) => {
            const cfg = categoryConfig[cat];
            return (
              <div key={cat} className="bg-surface-container-low rounded-xl p-4 space-y-2">
                <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium ${cfg.color}`}>
                  <span className="material-symbols-outlined text-sm">{cfg.icon}</span>
                  {catLabel(cat)}
                </div>
                <p className="text-lg font-bold font-headline text-on-surface">
                  ฿{total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Total bar */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-primary/10 border border-primary/20 flex-wrap gap-2">
        <span className="text-sm font-medium text-on-surface">
          {locale === 'th'
            ? `รวมค่าใช้จ่าย${periodMode === 'week' ? 'อาทิตย์นี้' : periodMode === 'month' ? 'เดือนนี้' : 'ช่วงที่เลือก'} (${filtered.length} รายการ)`
            : `Total ${periodMode === 'week' ? 'this week' : periodMode === 'month' ? 'this month' : 'for range'} (${filtered.length} items)`}
        </span>
        <div className="text-right">
          <div className="text-xl font-bold font-headline text-primary">
            ฿{totalFiltered.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
          </div>
          {totalGstFiltered > 0 && (
            <div className="text-[11px] text-on-surface-variant">
              {locale === 'th' ? 'GST รวม' : 'GST included'}: ฿{totalGstFiltered.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
            </div>
          )}
        </div>
      </div>

      {/* Expense list */}
      {loading ? (
        <div className="text-center py-20 text-on-surface-variant text-sm">
          {locale === 'th' ? 'กำลังโหลด...' : 'Loading...'}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-on-surface-variant">
          <span className="material-symbols-outlined text-6xl mb-3">receipt_long</span>
          <p className="font-semibold">{locale === 'th' ? 'ยังไม่มีรายการค่าใช้จ่าย' : 'No expenses yet'}</p>
          <p className="text-sm mt-1">{locale === 'th' ? 'กดเพิ่มรายการเพื่อบันทึก' : 'Press Add Expense to record one'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((expense) => {
            const cfg = categoryConfig[expense.category];
            return (
              <div
                key={expense.id}
                className="flex items-center gap-4 p-4 bg-surface-container-lowest rounded-xl border border-transparent hover:border-outline-variant transition-all"
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${cfg.color}`}>
                  <span className="material-symbols-outlined text-lg">{cfg.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-on-surface text-sm">{expense.description}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>
                      {catLabel(expense.category)}
                    </span>
                    {expense.paidTo && (
                      <span className="text-xs text-on-surface-variant">{expense.paidTo}</span>
                    )}
                    <span className="text-xs text-on-surface-variant">
                      {new Date(expense.date).toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-on-surface font-headline">
                    ฿{expense.amount.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                  </p>
                  {expense.category === 'salary' && (expense.transferAmount != null || expense.cashAmount != null) && (
                    <p className="text-[10px] text-on-surface-variant mt-0.5">
                      {locale === 'th' ? 'โอน' : 'Transfer'} ฿{(expense.transferAmount ?? 0).toLocaleString('en-AU')}
                      {' / '}
                      {locale === 'th' ? 'สด' : 'Cash'} ฿{(expense.cashAmount ?? 0).toLocaleString('en-AU')}
                    </p>
                  )}
                  {expense.category === 'ingredient' && expense.gstAmount != null && expense.gstAmount > 0 && (
                    <p className="text-[10px] text-on-surface-variant mt-0.5">
                      GST ฿{expense.gstAmount.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(expense.id)}
                  className="text-error hover:opacity-70 transition-opacity"
                >
                  <span className="material-symbols-outlined text-xl">delete</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Roster manager modal (employee or supplier) */}
      {(showEmployeeManager || showSupplierManager) && (() => {
        const kind: 'employee' | 'supplier' = showEmployeeManager ? 'employee' : 'supplier';
        const list = kind === 'employee' ? employees : suppliers;
        const title = kind === 'employee'
          ? (locale === 'th' ? 'จัดการพนักงาน' : 'Manage Staff')
          : (locale === 'th' ? 'จัดการซัพพลายเออร์' : 'Manage Suppliers');
        const placeholder = kind === 'employee'
          ? (locale === 'th' ? 'ชื่อพนักงาน' : 'Employee name')
          : (locale === 'th' ? 'ชื่อซัพพลายเออร์' : 'Supplier name');
        const emptyText = kind === 'employee'
          ? (locale === 'th' ? 'ยังไม่มีพนักงาน' : 'No employees yet')
          : (locale === 'th' ? 'ยังไม่มีซัพพลายเออร์' : 'No suppliers yet');
        const close = () => { setShowEmployeeManager(false); setShowSupplierManager(false); setNewName(''); };
        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-surface-container-lowest rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h2 className="font-headline font-bold text-lg text-on-surface">{title}</h2>
                <button onClick={close} aria-label="Close" className="text-on-surface-variant hover:text-on-surface">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={placeholder}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddRoster(kind); }}
                  className="flex-1 px-3 py-2.5 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  onClick={() => handleAddRoster(kind)}
                  disabled={!newName.trim() || savingRoster}
                  className="px-4 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  {locale === 'th' ? 'เพิ่ม' : 'Add'}
                </button>
              </div>

              <div className="max-h-72 overflow-y-auto space-y-1.5">
                {list.length === 0 ? (
                  <p className="text-sm text-on-surface-variant text-center py-6">{emptyText}</p>
                ) : (
                  list.map((item) => (
                    <div key={item.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface-container-low">
                      <span className="text-sm text-on-surface">{item.name}</span>
                      <button
                        onClick={() => handleDeleteRoster(kind, item.id)}
                        className="text-error hover:opacity-70 transition-opacity"
                        aria-label="Delete"
                      >
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Add expense modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="font-headline font-bold text-lg text-on-surface">
              {locale === 'th' ? 'เพิ่มค่าใช้จ่าย' : 'Add Expense'}
            </h2>

            {/* Date */}
            <div>
              <label className="text-xs text-on-surface-variant mb-1 block">
                {locale === 'th' ? 'วันที่' : 'Date'}
              </label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Category */}
            <div>
              <label className="text-xs text-on-surface-variant mb-1 block">
                {locale === 'th' ? 'ประเภท' : 'Category'}
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as ExpenseCategory, paidTo: '' }))}
                className="w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {(Object.keys(categoryConfig) as ExpenseCategory[]).map((cat) => (
                  <option key={cat} value={cat}>{catLabel(cat)}</option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="text-xs text-on-surface-variant mb-1 block">
                {locale === 'th' ? 'รายละเอียด' : 'Description'}
              </label>
              <input
                type="text"
                placeholder={locale === 'th' ? 'เช่น ค่าแรงอาทิตย์ที่ 1' : 'e.g. Week 1 wages'}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Paid to — dropdown for salary/ingredient, free text otherwise */}
            <div>
              <label className="text-xs text-on-surface-variant mb-1 block">
                {form.category === 'salary'
                  ? (locale === 'th' ? 'พนักงาน' : 'Employee')
                  : form.category === 'ingredient'
                    ? (locale === 'th' ? 'ซัพพลายเออร์' : 'Supplier')
                    : (locale === 'th' ? 'จ่ายให้ (ไม่บังคับ)' : 'Paid to (optional)')}
              </label>
              {form.category === 'salary' || form.category === 'ingredient' ? (
                <>
                  <select
                    value={form.paidTo}
                    onChange={(e) => setForm((f) => ({ ...f, paidTo: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">
                      {locale === 'th' ? '— เลือก —' : '— Select —'}
                    </option>
                    {(form.category === 'salary' ? employees : suppliers).map((item) => (
                      <option key={item.id} value={item.name}>{item.name}</option>
                    ))}
                  </select>
                  {(form.category === 'salary' ? employees : suppliers).length === 0 && (
                    <p className="text-[11px] text-on-surface-variant mt-1">
                      {locale === 'th'
                        ? `ยังไม่มี${form.category === 'salary' ? 'พนักงาน' : 'ซัพพลายเออร์'} — กดปุ่มจัดการด้านบนเพื่อเพิ่ม`
                        : `No ${form.category === 'salary' ? 'employees' : 'suppliers'} — use the manage button above to add`}
                    </p>
                  )}
                </>
              ) : (
                <input
                  type="text"
                  placeholder={locale === 'th' ? 'ชื่อผู้รับเงิน' : 'Recipient name'}
                  value={form.paidTo}
                  onChange={(e) => setForm((f) => ({ ...f, paidTo: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              )}
            </div>

            {/* Total amount (always required) */}
            <div>
              <label className="text-xs text-on-surface-variant mb-1 block">
                {locale === 'th' ? 'ยอดทั้งหมด (฿)' : 'Total (฿)'}
                {form.category === 'ingredient' && (
                  <span className="ml-1 text-on-surface-variant">
                    {locale === 'th' ? '— รวม GST แล้ว' : '— GST inclusive'}
                  </span>
                )}
              </label>
              <input
                type="number"
                min={0}
                step={0.01}
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Salary: transfer + auto cash */}
            {form.category === 'salary' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-on-surface-variant mb-1 block">
                    {locale === 'th' ? 'ยอดโอน (฿)' : 'Transfer (฿)'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder="0.00"
                    value={form.transferAmount}
                    onChange={(e) => setForm((f) => ({ ...f, transferAmount: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-primary/10 border border-primary/20">
                  <span className="text-xs font-medium text-on-surface">
                    {locale === 'th' ? 'ยอดเงินสด (อัตโนมัติ)' : 'Cash (auto)'}
                  </span>
                  <span className="text-base font-bold font-headline text-primary">
                    ฿{(calcCash ?? 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}

            {/* Ingredient: GST */}
            {form.category === 'ingredient' && (
              <div>
                <label className="text-xs text-on-surface-variant mb-1 block">
                  {locale === 'th' ? 'GST (฿) — สำหรับเคลมภาษี' : 'GST (฿) — for tax claim'}
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                  value={form.gstAmount}
                  onChange={(e) => setForm((f) => ({ ...f, gstAmount: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}
                className="flex-1 py-2.5 rounded-xl border border-outline-variant text-on-surface text-sm font-semibold hover:bg-surface-container-high transition-colors"
              >
                {locale === 'th' ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button
                onClick={handleAdd}
                disabled={
                  saving ||
                  !form.amount ||
                  (parseFloat(form.amount) || 0) <= 0
                }
                className="flex-1 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {saving ? (locale === 'th' ? 'กำลังบันทึก...' : 'Saving...') : (locale === 'th' ? 'บันทึก' : 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
