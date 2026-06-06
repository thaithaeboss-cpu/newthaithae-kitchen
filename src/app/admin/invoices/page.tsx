'use client';

import { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '@/lib/language-context';
import { useBranches } from '@/lib/useFirestore';
import { useInvoices, usePaymentsByInvoice } from '@/lib/useFirestore';
import {
  addInvoice,
  addPaymentRecord,
  deletePaymentRecord,
  voidInvoice,
  loadSettings,
  getUninvoicedOrdersByBranch,
  type Invoice,
  type Order,
  type PaymentMethod,
  type AppSettings,
} from '@/lib/firestore';

function formatCurrency(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d: Date | string | null | undefined): string {
  if (d === null || d === undefined) return '—';
  const date = d instanceof Date ? d : new Date(d as string);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function toSafeDate(d: Date | string | null | undefined): Date | null {
  if (d === null || d === undefined) return null;
  const date = d instanceof Date ? d : new Date(d as string);
  return isNaN(date.getTime()) ? null : date;
}

// ======================== STATUS BADGE ========================

function StatusBadge({ status, t }: { status: string; t: (k: any) => string }) {
  const colors: Record<string, string> = {
    unpaid: 'bg-red-100 text-red-700',
    partial: 'bg-yellow-100 text-yellow-700',
    paid: 'bg-green-100 text-green-700',
    void: 'bg-gray-100 text-gray-500',
  };
  const labels: Record<string, string> = {
    unpaid: t('status_unpaid'),
    partial: t('status_partial'),
    paid: t('status_paid'),
    void: t('status_void'),
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${colors[status] ?? 'bg-gray-100 text-gray-500'}`}>
      {labels[status] ?? status}
    </span>
  );
}

// ======================== RECORD PAYMENT MODAL ========================

function RecordPaymentModal({
  open,
  onClose,
  invoice,
  onRecorded,
  t,
}: {
  open: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  onRecorded: () => void;
  t: (k: any) => string;
}) {
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('bank_transfer');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && invoice) {
      setAmount(String(invoice.amountDue));
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setMethod('bank_transfer');
      setReference('');
      setNotes('');
    }
  }, [open, invoice]);

  async function handleSubmit() {
    if (!invoice || !amount) return;
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0 || numAmount > invoice.amountDue) return;

    setSubmitting(true);
    try {
      await addPaymentRecord({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        branchId: invoice.branchId,
        branchName: invoice.branchName,
        amount: numAmount,
        method,
        reference: reference || undefined,
        paymentDate: new Date(paymentDate),
        notes: notes || undefined,
        recordedBy: 'admin',
      });
      onRecorded();
      onClose();
    } catch (err) {
      console.error('Failed to record payment:', err);
    } finally {
      setSubmitting(false);
    }
  }

  if (!open || !invoice) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-5 border-b border-outline-variant">
          <h2 className="font-headline font-bold text-lg text-on-surface">{t('record_payment')}</h2>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Invoice info */}
          <div className="bg-surface-container-low rounded-lg p-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-on-surface-variant">{invoice.invoiceNumber}</p>
              <p className="text-sm font-semibold text-on-surface">{invoice.branchName}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-on-surface-variant">{t('amount_due')}</p>
              <p className="font-bold text-primary">฿{formatCurrency(invoice.amountDue)}</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1">{t('payment_amount')}</label>
            <input
              type="number"
              step="0.01"
              max={invoice.amountDue}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1">{t('payment_date')}</label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1">{t('payment_method')}</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="bank_transfer">{t('bank_transfer')}</option>
              <option value="cash">{t('cash_method')}</option>
              <option value="cheque">{t('cheque_method')}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1">{t('reference_number')}</label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Optional"
              className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1">{t('payment_notes')}</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3 p-5 border-t border-outline-variant">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-outline-variant text-on-surface text-sm font-semibold hover:bg-surface-container-high">
            {t('cancel')}
          </button>
          <button onClick={handleSubmit} disabled={submitting} className="flex-1 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:opacity-90 disabled:opacity-50">
            {submitting ? t('loading') : t('record_payment')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ======================== CREATE INVOICE MODAL ========================

function CreateInvoiceModal({
  open,
  onClose,
  branches,
  locale,
  t,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  branches: { id: string; nameTh: string; nameEn: string; code: string; address?: string; phone?: string }[];
  locale: string;
  t: (k: any) => string;
  onCreated: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [uninvoicedOrders, setUninvoicedOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [branchCounts, setBranchCounts] = useState<Record<string, number>>({});

  // Reset when modal opens; preload uninvoiced counts per branch
  useEffect(() => {
    if (open) {
      setStep(1);
      setSelectedBranchId('');
      setUninvoicedOrders([]);
      setSelectedOrderIds(new Set());
      const d = new Date();
      d.setDate(d.getDate() + 30);
      setDueDate(d.toISOString().split('T')[0]);
      setNotes('');
      setBranchCounts({});
      // Preload counts
      (async () => {
        const counts: Record<string, number> = {};
        for (const b of branches) {
          const names = [b.nameTh, b.nameEn].filter(Boolean) as string[];
          try {
            const list = await getUninvoicedOrdersByBranch(b.id, names);
            counts[b.id] = list.length;
          } catch {
            counts[b.id] = 0;
          }
        }
        setBranchCounts(counts);
      })();
    }
  }, [open, branches]);

  // Fetch uninvoiced orders when branch is selected
  async function handleBranchSelect(branchId: string) {
    setSelectedBranchId(branchId);
    setSelectedOrderIds(new Set());
    setLoadingOrders(true);
    try {
      const branch = branches.find((b) => b.id === branchId);
      const names = branch ? [branch.nameTh, branch.nameEn].filter(Boolean) as string[] : [];
      const orders = await getUninvoicedOrdersByBranch(branchId, names);
      setUninvoicedOrders(orders);
    } catch (err) {
      console.error('Failed to fetch uninvoiced orders:', err);
      setUninvoicedOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  }

  function toggleOrder(orderId: string) {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }

  function toggleAll() {
    if (selectedOrderIds.size === uninvoicedOrders.length) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(uninvoicedOrders.map((o) => o.id)));
    }
  }

  const selectedOrders = uninvoicedOrders.filter((o) => selectedOrderIds.has(o.id));
  const totalSubtotal = selectedOrders.reduce((s, o) => s + o.subtotal, 0);
  const totalVat = selectedOrders.reduce((s, o) => s + o.vat, 0);
  const totalDelivery = selectedOrders.reduce((s, o) => s + (o.deliveryFee || 0), 0);
  const grandTotal = selectedOrders.reduce((s, o) => s + o.total, 0);

  async function handleCreate() {
    if (selectedOrders.length === 0 || !selectedBranchId) return;
    setCreating(true);
    setCreateError(null);
    try {
      const branch = branches.find((b) => b.id === selectedBranchId);
      const branchName = (locale === 'th' ? branch?.nameTh : branch?.nameEn) || '';

      // Guard: if dueDate is empty / invalid, default to +30 days
      const dueDateParsed = dueDate ? new Date(dueDate) : new Date();
      if (isNaN(dueDateParsed.getTime())) {
        dueDateParsed.setTime(Date.now() + 30 * 86400000);
      }

      // Build line items defensively — coerce everything to required types
      // so Firestore never gets `undefined` in a nested field (which it rejects).
      const items = selectedOrders.flatMap((order) =>
        (order.items ?? []).map((item) => ({
          productId: item.productId ?? '',
          nameTh: item.nameTh ?? '',
          nameEn: item.nameEn ?? item.nameTh ?? '',
          quantity: Number(item.quantity) || 0,
          unitPrice: Number(item.unitPrice) || 0,
          total: Number(item.total) || 0,
          unit: item.unit ?? '',
          sourceOrderId: order.id ?? '',
          sourceOrderNumber: order.orderId ?? '',
        }))
      );

      await addInvoice({
        branchId: selectedBranchId,
        branchName,
        orderIds: selectedOrders.map((o) => o.id),
        orderNumbers: selectedOrders.map((o) => o.orderId),
        items,
        subtotal: Number(totalSubtotal) || 0,
        vat: Number(totalVat) || 0,
        deliveryFee: Number(totalDelivery) || 0,
        total: Number(grandTotal) || 0,
        dueDate: dueDateParsed,
        notes: notes || undefined,
      });

      onCreated();
      onClose();
    } catch (err) {
      console.error('Failed to create invoice:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setCreateError(msg || (locale === 'th' ? 'สร้างใบแจ้งหนี้ไม่สำเร็จ' : 'Failed to create invoice'));
    } finally {
      setCreating(false);
    }
  }

  if (!open) return null;

  const stepLabels = [t('step_select_branch'), t('step_select_orders'), t('step_confirm')];

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-outline-variant">
          <h2 className="font-headline font-bold text-lg text-on-surface">{t('create_invoice')}</h2>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-outline-variant/50">
          {stepLabels.map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              {i > 0 && <div className="w-6 h-px bg-outline-variant" />}
              <div className={`flex items-center gap-1.5 text-xs font-medium ${step === i + 1 ? 'text-primary' : step > i + 1 ? 'text-green-600' : 'text-on-surface-variant/50'}`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${step === i + 1 ? 'bg-primary text-on-primary' : step > i + 1 ? 'bg-green-100 text-green-700' : 'bg-surface-container-high text-on-surface-variant/50'}`}>
                  {step > i + 1 ? '✓' : i + 1}
                </div>
                <span className="hidden sm:inline">{label}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Step 1: Select Branch */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-on-surface-variant mb-3">{t('select_branch')}</p>
              {branches.map((b) => {
                const count = branchCounts[b.id];
                return (
                  <button
                    key={b.id}
                    onClick={() => { handleBranchSelect(b.id); setStep(2); }}
                    className="w-full text-left p-3 rounded-lg border border-outline-variant/50 hover:border-primary/40 hover:bg-primary/5 transition-all flex items-center gap-3"
                  >
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-primary text-lg">store</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-on-surface">{locale === 'th' ? b.nameTh : b.nameEn}</p>
                      <p className="text-xs text-on-surface-variant">{b.code}</p>
                    </div>
                    {count !== undefined && (
                      <span className={`px-2 py-1 rounded-full text-[11px] font-semibold shrink-0 ${count > 0 ? 'bg-primary/10 text-primary' : 'bg-surface-container-high text-on-surface-variant/60'}`}>
                        {count} {locale === 'th' ? 'รายการ' : count === 1 ? 'order' : 'orders'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Step 2: Select Orders */}
          {step === 2 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-on-surface-variant">{t('uninvoiced_orders')}</p>
                {uninvoicedOrders.length > 0 && (
                  <button onClick={toggleAll} className="text-xs text-primary font-medium hover:underline">
                    {selectedOrderIds.size === uninvoicedOrders.length
                      ? (locale === 'th' ? 'ยกเลิกทั้งหมด' : 'Deselect All')
                      : (locale === 'th' ? 'เลือกทั้งหมด' : 'Select All')}
                  </button>
                )}
              </div>

              {loadingOrders ? (
                <div className="text-center py-8">
                  <span className="material-symbols-outlined animate-spin text-primary text-3xl">progress_activity</span>
                </div>
              ) : uninvoicedOrders.length === 0 ? (
                <div className="text-center py-8 text-on-surface-variant">
                  <span className="material-symbols-outlined text-4xl mb-2">inbox</span>
                  <p className="text-sm">{t('no_uninvoiced_orders')}</p>
                </div>
              ) : (
                uninvoicedOrders.map((o) => {
                  const checked = selectedOrderIds.has(o.id);
                  const dateStr = typeof o.createdAt === 'string' ? o.createdAt : (o.createdAt as unknown as Date).toISOString();
                  return (
                    <button
                      key={o.id}
                      onClick={() => toggleOrder(o.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-all flex items-center gap-3 ${checked ? 'border-primary bg-primary/5' : 'border-outline-variant/50 hover:border-primary/30'}`}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${checked ? 'bg-primary border-primary' : 'border-outline-variant'}`}>
                        {checked && <span className="material-symbols-outlined text-white text-sm">check</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-semibold text-sm text-on-surface">{o.orderId}</span>
                          <span className="font-bold text-sm text-primary">฿{formatCurrency(o.total)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-on-surface-variant mt-0.5">
                          <span>{new Date(dateStr).toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-US', { day: '2-digit', month: 'short', year: '2-digit' })}</span>
                          <span>·</span>
                          <span>{o.items.length} {locale === 'th' ? 'รายการ' : 'items'}</span>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}

              {selectedOrderIds.size > 0 && (
                <div className="bg-primary/5 rounded-lg p-3 border border-primary/20">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-on-surface-variant">
                      {locale === 'th' ? `เลือกแล้ว ${selectedOrderIds.size} รายการ` : `${selectedOrderIds.size} order(s) selected`}
                    </span>
                    <span className="font-bold text-primary">฿{formatCurrency(grandTotal)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === 3 && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="bg-surface-container-low rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-on-surface-variant">{t('select_branch')}</span>
                  <span className="font-semibold text-on-surface">
                    {locale === 'th' ? branches.find((b) => b.id === selectedBranchId)?.nameTh : branches.find((b) => b.id === selectedBranchId)?.nameEn}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-on-surface-variant">{t('select_orders')}</span>
                  <span className="font-semibold text-on-surface">{selectedOrders.length} {locale === 'th' ? 'รายการ' : 'order(s)'}</span>
                </div>
                <div className="border-t border-outline-variant/30 pt-2 mt-2 space-y-1">
                  {selectedOrders.map((o) => (
                    <div key={o.id} className="flex items-center justify-between text-xs text-on-surface-variant">
                      <span className="font-mono">{o.orderId}</span>
                      <span>฿{formatCurrency(o.total)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-outline-variant/30 pt-2 mt-2 space-y-1 text-sm">
                  <div className="flex justify-between font-bold text-base">
                    <span>{t('total')}</span>
                    <span className="text-primary">฿{formatCurrency(grandTotal)}</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1">{t('due_date')}</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1">{t('payment_notes')}</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder={locale === 'th' ? 'หมายเหตุ (ไม่บังคับ)' : 'Notes (optional)'}
                  className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Error banner */}
        {createError && (
          <div className="mx-5 mb-0 -mt-1 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
            <span className="material-symbols-outlined text-base">error</span>
            <div className="flex-1">
              <p className="font-semibold">{locale === 'th' ? 'สร้างใบแจ้งหนี้ไม่สำเร็จ' : 'Could not create invoice'}</p>
              <p className="mt-0.5 break-words">{createError}</p>
            </div>
            <button onClick={() => setCreateError(null)} className="text-red-700">
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-outline-variant">
          {step > 1 && (
            <button
              onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
              className="py-2.5 px-4 rounded-xl border border-outline-variant text-on-surface text-sm font-semibold hover:bg-surface-container-high flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              {t('back')}
            </button>
          )}
          <div className="flex-1" />
          {step === 1 && (
            <button onClick={onClose} className="py-2.5 px-6 rounded-xl border border-outline-variant text-on-surface text-sm font-semibold hover:bg-surface-container-high">
              {t('cancel')}
            </button>
          )}
          {step === 2 && (
            <button
              onClick={() => setStep(3)}
              disabled={selectedOrderIds.size === 0}
              className="py-2.5 px-6 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:opacity-90 disabled:opacity-40 flex items-center gap-1"
            >
              {locale === 'th' ? 'ถัดไป' : 'Next'}
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </button>
          )}
          {step === 3 && (
            <button
              onClick={handleCreate}
              disabled={creating}
              className="py-2.5 px-6 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-base">receipt</span>
              {creating ? t('loading') : t('create_invoice')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ======================== INVOICE DETAIL PANEL ========================

function InvoiceDetail({
  invoice,
  onClose,
  onRecordPayment,
  onVoid,
  onPrint,
  t,
  locale,
}: {
  invoice: Invoice;
  onClose: () => void;
  onRecordPayment: () => void;
  onVoid: () => void;
  onPrint: () => void;
  t: (k: any) => string;
  locale: string;
}) {
  const { payments, loading: paymentsLoading } = usePaymentsByInvoice(invoice.id);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDeletePayment(paymentId: string) {
    if (!confirm(t('delete_payment_confirm'))) return;
    setDeletingId(paymentId);
    try {
      await deletePaymentRecord(paymentId);
    } catch (err) {
      console.error('Failed to delete payment:', err);
    } finally {
      setDeletingId(null);
    }
  }

  const methodLabels: Record<string, string> = {
    bank_transfer: t('bank_transfer'),
    cash: t('cash_method'),
    cheque: t('cheque_method'),
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-outline-variant">
          <div>
            <h2 className="font-headline font-bold text-lg text-on-surface">{invoice.invoiceNumber}</h2>
            <p className="text-xs text-on-surface-variant">{invoice.branchName} &middot; {invoice.orderNumbers.join(', ')}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={invoice.status} t={t} />
            <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-surface-container-low rounded-lg p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-on-surface-variant">{t('total')}</p>
              <p className="font-bold text-on-surface mt-0.5">฿{formatCurrency(invoice.total)}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-green-600">{t('amount_paid_label')}</p>
              <p className="font-bold text-green-700 mt-0.5">฿{formatCurrency(invoice.amountPaid)}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-red-600">{t('amount_due')}</p>
              <p className="font-bold text-red-700 mt-0.5">฿{formatCurrency(invoice.amountDue)}</p>
            </div>
          </div>

          {/* Info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-on-surface-variant text-xs">{t('invoice_date')}</span>
              <p className="font-semibold text-on-surface">{formatDate(invoice.createdAt)}</p>
            </div>
            <div>
              <span className="text-on-surface-variant text-xs">{t('due_date')}</span>
              <p className="font-semibold text-on-surface">{formatDate(invoice.dueDate)}</p>
            </div>
          </div>

          {/* Items table */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">
              {locale === 'th' ? 'รายการสินค้า' : 'Line Items'}
            </h3>
            <div className="border border-outline-variant rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-container-low">
                    <th className="text-left px-3 py-2 text-xs text-on-surface-variant font-medium">
                      {locale === 'th' ? 'รายการ' : 'Item'}
                    </th>
                    <th className="text-center px-3 py-2 text-xs text-on-surface-variant font-medium">
                      {locale === 'th' ? 'จำนวน' : 'Qty'}
                    </th>
                    <th className="text-right px-3 py-2 text-xs text-on-surface-variant font-medium">
                      {locale === 'th' ? 'ราคา' : 'Amount'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item, i) => (
                    <tr key={i} className="border-t border-outline-variant/50">
                      <td className="px-3 py-2 text-on-surface">
                        {locale === 'th' ? item.nameTh : item.nameEn}
                      </td>
                      <td className="text-center px-3 py-2">{item.quantity} {item.unit}</td>
                      <td className="text-right px-3 py-2 font-medium">฿{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-outline-variant">
                    <td colSpan={2} className="text-right px-3 py-2 font-bold">{t('total')}</td>
                    <td className="text-right px-3 py-2 font-bold text-primary">฿{formatCurrency(invoice.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Payment History */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">
              {t('payment_history')}
            </h3>
            {paymentsLoading ? (
              <div className="text-center py-4">
                <span className="material-symbols-outlined animate-pulse text-on-surface-variant">hourglass_empty</span>
              </div>
            ) : payments.length === 0 ? (
              <p className="text-sm text-on-surface-variant text-center py-4">{t('no_payments')}</p>
            ) : (
              <div className="space-y-2">
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg bg-surface-container-low">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-green-600 text-base">payments</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-on-surface">฿{formatCurrency(p.amount)}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant">
                          {methodLabels[p.method] ?? p.method}
                        </span>
                      </div>
                      <p className="text-xs text-on-surface-variant">
                        {formatDate(p.paymentDate)}
                        {p.reference ? ` · ${p.reference}` : ''}
                        {p.notes ? ` · ${p.notes}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeletePayment(p.id)}
                      disabled={deletingId === p.id}
                      className="text-error hover:opacity-70 shrink-0 disabled:opacity-30"
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 p-5 border-t border-outline-variant">
          {invoice.status !== 'void' && invoice.status !== 'paid' && (
            <button onClick={onRecordPayment} className="flex-1 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:opacity-90 flex items-center justify-center gap-1.5">
              <span className="material-symbols-outlined text-base">payments</span>
              {t('record_payment')}
            </button>
          )}
          <button onClick={onPrint} className="py-2.5 px-4 rounded-xl border border-outline-variant text-on-surface text-sm font-semibold hover:bg-surface-container-high flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base">print</span>
            {t('print_invoice')}
          </button>
          {invoice.status === 'unpaid' && (
            <button onClick={onVoid} className="py-2.5 px-4 rounded-xl border border-error/30 text-error text-sm font-semibold hover:bg-error/5 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base">block</span>
              {t('void_invoice')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ======================== MAIN INVOICES PAGE ========================

export default function InvoicesPage() {
  const { locale, t } = useLanguage();
  const { branches } = useBranches();
  const [filterBranch, setFilterBranch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterToDate, setFilterToDate] = useState('');
  const [rangePreset, setRangePreset] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  const { invoices: allInvoices, loading, refresh } = useInvoices({
    branchId: filterBranch || undefined,
    status: filterStatus || undefined,
  });

  // Apply date-range filter client-side
  const invoices = useMemo(() => {
    if (!filterFromDate && !filterToDate) return allInvoices;
    const from = filterFromDate ? new Date(filterFromDate + 'T00:00:00') : null;
    const to = filterToDate ? new Date(filterToDate + 'T23:59:59') : null;
    return allInvoices.filter((inv) => {
      const created = toSafeDate(inv.createdAt);
      if (!created) return true; // pending serverTimestamp — keep so user sees newly created invoice
      if (from && created < from) return false;
      if (to && created > to) return false;
      return true;
    });
  }, [allInvoices, filterFromDate, filterToDate]);

  function applyRangePreset(preset: 'all' | 'today' | 'week' | 'month' | 'custom') {
    setRangePreset(preset);
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    if (preset === 'all') {
      setFilterFromDate('');
      setFilterToDate('');
    } else if (preset === 'today') {
      const s = fmt(now);
      setFilterFromDate(s);
      setFilterToDate(s);
    } else if (preset === 'week') {
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      setFilterFromDate(fmt(start));
      setFilterToDate(fmt(now));
    } else if (preset === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      setFilterFromDate(fmt(start));
      setFilterToDate(fmt(now));
    }
  }

  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  // Track which invoice row is expanded inline so the user can scan the
  // line items without opening the full detail modal.
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);

  useEffect(() => {
    loadSettings().then(setSettings);
  }, []);

  // Summary stats (based on filtered invoices so user sees totals for the selected range)
  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    let outstanding = 0;
    let overdue = 0;
    let paidMonth = 0;
    let rangeTotal = 0;

    for (const inv of invoices) {
      if (inv.status === 'unpaid' || inv.status === 'partial') {
        outstanding += inv.amountDue;
        const due = toSafeDate(inv.dueDate);
        if (due && due < now) overdue += inv.amountDue;
      }
      if (inv.status === 'paid') {
        const updated = toSafeDate(inv.updatedAt);
        if (updated && updated >= monthStart) paidMonth += inv.total;
      }
      if (inv.status !== 'void') rangeTotal += inv.total;
    }
    return { outstanding, overdue, paidMonth, rangeTotal };
  }, [invoices]);

  async function handleVoid(invoice: Invoice) {
    if (!confirm(t('void_confirm'))) return;
    try {
      await voidInvoice(invoice.id);
      setSelectedInvoice(null);
      refresh();
    } catch (err) {
      console.error('Failed to void invoice:', err);
    }
  }

  function printInvoice(invoice: Invoice) {
    const co = settings;
    const branch = branches.find((b) => b.id === invoice.branchId);

    const rows = invoice.items.map((item) => {
      const name = locale === 'th' ? item.nameTh : (item.nameEn || item.nameTh);
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.quantity} ${item.unit}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">฿${formatCurrency(item.total)}</td>
      </tr>`;
    }).join('');

    const logoHtml = co?.logoUrl ? `<img src="${co.logoUrl}" alt="logo" style="height:56px;object-fit:contain;"/>` : '';
    const coName = co?.companyName ?? '';
    const coAddress = co?.companyAddress ?? '';
    const coTaxId = co?.taxId ?? '';

    const bankHtml = co?.bankAccountNumber
      ? `<div style="margin-top:10px;padding:5px 10px;background:#f0fdf4;border-radius:6px;border:1px solid #bbf7d0;font-size:10px;line-height:1.5;color:#374151;">
          <span style="font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:.04em;margin-right:6px;">${locale === 'th' ? 'การชำระ' : 'Payment'}</span>
          ${[
            co.bankName ? `<strong>${co.bankName}</strong>` : null,
            co.bankAccountName,
            co.bankBsb ? `BSB <span style="font-family:monospace;">${co.bankBsb}</span>` : null,
            `${locale === 'th' ? 'เลข' : 'Acct'} <span style="font-family:monospace;font-weight:700;color:#166534;">${co.bankAccountNumber}</span>`,
          ].filter(Boolean).join(' · ')}
        </div>`
      : '';

    const paidSection = invoice.amountPaid > 0
      ? `<div style="margin-top:12px;padding:10px 14px;background:#f0f9ff;border-radius:6px;border:1px solid #bae6fd;">
          <table style="width:100%;font-size:12px;border-collapse:collapse;">
            <tr><td style="color:#555;">${locale === 'th' ? 'ยอดชำระแล้ว' : 'Amount Paid'}</td><td style="text-align:right;font-weight:600;color:#0369a1;">฿${formatCurrency(invoice.amountPaid)}</td></tr>
            <tr><td style="color:#555;font-weight:700;">${locale === 'th' ? 'ยอดค้างชำระ' : 'Amount Due'}</td><td style="text-align:right;font-weight:700;font-size:14px;color:#dc2626;">฿${formatCurrency(invoice.amountDue)}</td></tr>
          </table>
        </div>`
      : '';

    const html = `<!DOCTYPE html><html><head>
      <meta charset="utf-8"/>
      <title>Invoice ${invoice.invoiceNumber}</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: sans-serif; font-size: 13px; color: #111; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; border-bottom: 2px solid #111; margin-bottom: 20px; }
        .company { flex: 1; }
        .company h1 { margin: 0 0 2px; font-size: 18px; }
        .company p { margin: 2px 0; font-size: 12px; color: #555; }
        .invoice-title { text-align: right; }
        .invoice-title h2 { margin: 0 0 4px; font-size: 22px; color: #00342b; }
        .invoice-title p { margin: 2px 0; font-size: 12px; color: #555; }
        .bill-section { display: flex; gap: 32px; margin-bottom: 20px; }
        .bill-box { flex: 1; background: #f9fafb; border-radius: 8px; padding: 12px 14px; }
        .bill-box h4 { margin: 0 0 6px; font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: #888; }
        .bill-box p { margin: 2px 0; font-size: 13px; font-weight: 600; }
        .bill-box .sub { font-weight: 400; color: #555; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; }
        thead tr { background: #f3f4f6; }
        th { padding: 8px 12px; text-align: left; font-size: 11px; color: #666; text-transform: uppercase; letter-spacing:.05em; }
        .total-row td { padding: 12px 12px; font-weight: bold; font-size: 15px; border-top: 2px solid #111; }
        .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #888; text-align: center; }
        @page { margin: 15mm; size: A4; }
        @media print { body { margin: 0; } }
      </style>
    </head><body>
      <div class="header">
        <div class="company">
          ${logoHtml}
          <h1 style="margin-top:${co?.logoUrl ? '8px' : '0'}">${coName}</h1>
          ${coAddress ? `<p>${coAddress}</p>` : ''}
          ${coTaxId ? `<p>ABN / Tax ID: ${coTaxId}</p>` : ''}
        </div>
        <div class="invoice-title">
          <h2>${locale === 'th' ? 'ใบแจ้งหนี้' : 'INVOICE'}</h2>
          <p><strong>${invoice.invoiceNumber}</strong></p>
          <p>${locale === 'th' ? 'วันที่' : 'Date'}: ${formatDate(invoice.createdAt)}</p>
          <p>${locale === 'th' ? 'ครบกำหนด' : 'Due'}: ${formatDate(invoice.dueDate)}</p>
        </div>
      </div>

      <div class="bill-section">
        <div class="bill-box">
          <h4>${locale === 'th' ? 'จาก (ผู้ขาย)' : 'From (Supplier)'}</h4>
          <p>${coName}</p>
          ${coAddress ? `<p class="sub">${coAddress}</p>` : ''}
        </div>
        <div class="bill-box">
          <h4>${locale === 'th' ? 'ถึง (สาขา)' : 'Bill To (Branch)'}</h4>
          <p>${invoice.branchName}</p>
          ${branch?.address ? `<p class="sub">${branch.address}</p>` : ''}
          ${branch?.phone ? `<p class="sub">Tel: ${branch.phone}</p>` : ''}
        </div>
      </div>

      <p style="font-size:11px;color:#888;margin-bottom:8px;">${locale === 'th' ? 'คำสั่งซื้อ' : 'Order'}: ${invoice.orderNumbers.join(', ')}</p>

      <table>
        <thead><tr>
          <th>${locale === 'th' ? 'รายการสินค้า' : 'Item'}</th>
          <th style="text-align:center">${locale === 'th' ? 'จำนวน' : 'Qty'}</th>
          <th style="text-align:right">${locale === 'th' ? 'ราคา' : 'Amount'}</th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr class="total-row">
            <td colspan="2" style="text-align:right">${locale === 'th' ? 'รวมทั้งสิ้น' : 'Grand Total'}</td>
            <td style="text-align:right;color:#00342b;">฿${formatCurrency(invoice.total)}</td>
          </tr>
        </tfoot>
      </table>
      ${paidSection}
      ${invoice.notes ? `<div style="margin-top:16px;padding:10px 14px;background:#fffbeb;border-radius:6px;font-size:12px;color:#92400e;"><strong>${locale === 'th' ? 'หมายเหตุ' : 'Note'}:</strong> ${invoice.notes}</div>` : ''}
      ${bankHtml}
      <div class="footer">${coName}${coTaxId ? ` &nbsp;·&nbsp; ABN/Tax ID: ${coTaxId}` : ''} &nbsp;·&nbsp; ${locale === 'th' ? 'พิมพ์เมื่อ' : 'Printed'}: ${new Date().toLocaleString(locale === 'th' ? 'th-TH' : 'en-AU')}</div>
    </body></html>`;

    const w = window.open('', '_blank', 'width=700,height=900');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
    w.onafterprint = () => w.close();
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-widest text-on-surface-variant/60 uppercase">
            {t('nav_business')}
          </p>
          <h1 className="font-headline font-bold text-2xl text-on-surface mt-1">{t('invoices_title')}</h1>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          {t('create_invoice')}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant">
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-red-500 text-lg">warning</span>
            <span className="text-xs font-medium text-on-surface-variant">{t('total_outstanding')}</span>
          </div>
          <p className="font-headline font-bold text-xl text-red-600">฿{formatCurrency(stats.outstanding)}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant">
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-orange-500 text-lg">schedule</span>
            <span className="text-xs font-medium text-on-surface-variant">{t('total_overdue')}</span>
          </div>
          <p className="font-headline font-bold text-xl text-orange-600">฿{formatCurrency(stats.overdue)}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant">
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-green-500 text-lg">check_circle</span>
            <span className="text-xs font-medium text-on-surface-variant">{t('paid_this_month')}</span>
          </div>
          <p className="font-headline font-bold text-xl text-green-600">฿{formatCurrency(stats.paidMonth)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-3">
          <select
            value={filterBranch}
            onChange={(e) => setFilterBranch(e.target.value)}
            className="px-3 py-2 rounded-lg border border-outline-variant text-sm bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">{t('select_branch')} - {t('all_categories')}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{locale === 'th' ? b.nameTh : b.nameEn}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 rounded-lg border border-outline-variant text-sm bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">{t('all_statuses')}</option>
            <option value="unpaid">{t('status_unpaid')}</option>
            <option value="partial">{t('status_partial')}</option>
            <option value="paid">{t('status_paid')}</option>
            <option value="void">{t('status_void')}</option>
          </select>
        </div>

        {/* Date range */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-on-surface-variant mr-1">
            {locale === 'th' ? 'ช่วงเวลา:' : 'Period:'}
          </span>
          {([
            { k: 'all', th: 'ทั้งหมด', en: 'All' },
            { k: 'today', th: 'วันนี้', en: 'Today' },
            { k: 'week', th: '7 วัน', en: '7 days' },
            { k: 'month', th: 'เดือนนี้', en: 'This month' },
            { k: 'custom', th: 'กำหนดเอง', en: 'Custom' },
          ] as const).map((opt) => (
            <button
              key={opt.k}
              onClick={() => applyRangePreset(opt.k)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                rangePreset === opt.k
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-lowest border border-outline-variant text-on-surface hover:bg-surface-container-high'
              }`}
            >
              {locale === 'th' ? opt.th : opt.en}
            </button>
          ))}

          {rangePreset === 'custom' && (
            <>
              <input
                type="date"
                value={filterFromDate}
                onChange={(e) => setFilterFromDate(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-outline-variant text-xs bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <span className="text-on-surface-variant text-xs">—</span>
              <input
                type="date"
                value={filterToDate}
                onChange={(e) => setFilterToDate(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-outline-variant text-xs bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </>
          )}

          {(filterFromDate || filterToDate) && (
            <span className="ml-auto text-xs text-on-surface-variant">
              {locale === 'th' ? 'ยอดในช่วงนี้' : 'Total in range'}:{' '}
              <span className="font-bold text-primary">฿{formatCurrency(stats.rangeTotal)}</span>
              {' · '}
              <span className="font-semibold">{invoices.length}</span>{' '}
              {locale === 'th' ? 'ใบ' : 'invoices'}
            </span>
          )}
        </div>
      </div>

      {/* Invoice list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-surface-container-lowest rounded-xl p-4 animate-pulse">
              <div className="h-5 bg-surface-container rounded w-1/3 mb-2" />
              <div className="h-4 bg-surface-container rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant">
          <span className="material-symbols-outlined text-6xl mb-3">receipt_long</span>
          <p className="font-semibold">{t('no_invoices')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.map((inv) => {
            const isExpanded = expandedInvoiceId === inv.id;
            // Group items by sourceOrderNumber so the user can see what came
            // from each underlying order when an invoice covers several.
            const itemsByOrder = new Map<string, typeof inv.items>();
            for (const item of inv.items) {
              const key = item.sourceOrderNumber || '—';
              if (!itemsByOrder.has(key)) itemsByOrder.set(key, []);
              itemsByOrder.get(key)!.push(item);
            }
            return (
              <div
                key={inv.id}
                className={`bg-surface-container-lowest rounded-xl border transition-all ${
                  isExpanded
                    ? 'border-primary/40 shadow-sm'
                    : 'border-outline-variant/50 hover:border-primary/30 hover:shadow-sm'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setExpandedInvoiceId(isExpanded ? null : inv.id)}
                  className="w-full text-left p-4"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-on-surface-variant text-[18px]">
                        {isExpanded ? 'expand_less' : 'expand_more'}
                      </span>
                      <span className="font-bold text-sm text-on-surface">{inv.invoiceNumber}</span>
                      <StatusBadge status={inv.status} t={t} />
                    </div>
                    <span className="font-headline font-bold text-primary">฿{formatCurrency(inv.total)}</span>
                  </div>
                  <div className="flex items-center justify-between pl-6">
                    <div className="flex items-center gap-3 text-xs text-on-surface-variant flex-wrap">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">store</span>
                        {inv.branchName}
                      </span>
                      <span>{formatDate(inv.createdAt)}</span>
                      <span>{inv.orderNumbers.join(', ')}</span>
                      <span className="text-on-surface-variant/70">
                        · {inv.items.length} {locale === 'th' ? 'รายการ' : 'items'}
                      </span>
                    </div>
                    {(inv.status === 'unpaid' || inv.status === 'partial') && (
                      <span className="text-xs text-red-500 font-medium">
                        {t('amount_due')}: ฿{formatCurrency(inv.amountDue)}
                      </span>
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-outline-variant/30">
                    <div className="space-y-3 mt-3">
                      {Array.from(itemsByOrder.entries()).map(([orderNum, items]) => {
                        const groupTotal = items.reduce((s, it) => s + it.total, 0);
                        return (
                          <div key={orderNum} className="rounded-lg border border-outline-variant/40 overflow-hidden">
                            <div className="flex items-center justify-between bg-surface-container-low px-3 py-1.5 text-xs">
                              <span className="font-mono font-semibold text-on-surface">
                                {orderNum}
                              </span>
                              <span className="text-on-surface-variant">
                                {items.length} {locale === 'th' ? 'รายการ' : 'items'} · ฿{formatCurrency(groupTotal)}
                              </span>
                            </div>
                            <table className="w-full text-sm">
                              <tbody>
                                {items.map((item, i) => (
                                  <tr
                                    key={i}
                                    className={i > 0 ? 'border-t border-outline-variant/30' : ''}
                                  >
                                    <td className="px-3 py-1.5 text-on-surface">
                                      {locale === 'th' ? item.nameTh : (item.nameEn || item.nameTh)}
                                    </td>
                                    <td className="px-3 py-1.5 text-on-surface-variant text-right whitespace-nowrap">
                                      {item.quantity} {item.unit}
                                    </td>
                                    <td className="px-3 py-1.5 font-medium text-on-surface text-right whitespace-nowrap">
                                      ฿{formatCurrency(item.total)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        );
                      })}
                    </div>

                    {/* Totals strip — no VAT/GST line */}
                    <div className="flex items-center justify-end mt-3 text-xs">
                      <span className="font-bold text-on-surface">
                        {t('total')} ฿{formatCurrency(inv.total)}
                      </span>
                    </div>

                    {/* Inline quick actions */}
                    <div className="flex flex-wrap gap-2 mt-4">
                      <button
                        type="button"
                        onClick={() => setSelectedInvoice(inv)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-outline-variant text-on-surface text-xs font-semibold hover:bg-surface-container"
                      >
                        <span className="material-symbols-outlined text-[16px]">open_in_full</span>
                        {locale === 'th' ? 'ดูเต็ม' : 'Full detail'}
                      </button>
                      <button
                        type="button"
                        onClick={() => printInvoice(inv)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-outline-variant text-on-surface text-xs font-semibold hover:bg-surface-container"
                      >
                        <span className="material-symbols-outlined text-[16px]">print</span>
                        {locale === 'th' ? 'พิมพ์' : 'Print'}
                      </button>
                      {(inv.status === 'unpaid' || inv.status === 'partial') && (
                        <button
                          type="button"
                          onClick={() => setPaymentInvoice(inv)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:opacity-90"
                        >
                          <span className="material-symbols-outlined text-[16px]">payments</span>
                          {locale === 'th' ? 'บันทึกการชำระ' : 'Record payment'}
                        </button>
                      )}
                      {inv.status !== 'paid' && inv.status !== 'void' && (
                        <button
                          type="button"
                          onClick={() => handleVoid(inv)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-50"
                        >
                          <span className="material-symbols-outlined text-[16px]">block</span>
                          {locale === 'th' ? 'ยกเลิก' : 'Void'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {selectedInvoice && (
        <InvoiceDetail
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onRecordPayment={() => {
            setPaymentInvoice(selectedInvoice);
            setSelectedInvoice(null);
          }}
          onVoid={() => handleVoid(selectedInvoice)}
          onPrint={() => printInvoice(selectedInvoice)}
          t={t}
          locale={locale}
        />
      )}

      <RecordPaymentModal
        open={!!paymentInvoice}
        onClose={() => setPaymentInvoice(null)}
        invoice={paymentInvoice}
        onRecorded={() => {
          refresh();
          setPaymentInvoice(null);
        }}
        t={t}
      />

      <CreateInvoiceModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        branches={branches}
        locale={locale}
        t={t}
        onCreated={refresh}
      />
    </div>
  );
}
