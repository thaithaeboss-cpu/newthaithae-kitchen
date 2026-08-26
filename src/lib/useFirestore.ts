'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  onSnapshot,
  doc,
  Timestamp,
  type Query,
  type DocumentData,
} from 'firebase/firestore';
import { db } from './firebase';
import * as mockData from '@/data/mock-data';
import type {
  Product,
  Branch,
  Customer,
  AccountingEntry,
  InventoryAlert,
} from '@/data/mock-data';
import type { Order, Invoice, PaymentRecord, Announcement, OrderTimelineEntry } from './firestore';

// Map mock-data orders (legacy format) → firestore Order format
function adaptMockOrders(raw: mockData.Order[]): Order[] {
  return raw.map((o) => ({
    id: o.id,
    orderId: o.id,
    branchId: o.branchId,
    branchName: o.branchId,
    status: o.status,
    items: o.items.map((item) => ({
      productId: item.productId,
      nameTh: item.productName,
      nameEn: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.totalPrice,
      unit: item.unit ?? '',
    })),
    subtotal: o.subtotal,
    vat: o.vat,
    deliveryFee: 0,
    total: o.total,
    notes: o.note,
    estimatedDelivery: o.estimatedDelivery,
    actualDelivery: o.deliveredAt,
    createdAt: new Date(o.createdAt),
    updatedAt: new Date(o.createdAt),
  }));
}

// ============================================================
// Firebase configuration check
// ============================================================

function isFirebaseConfigured(): boolean {
  try {
    return (
      !!db &&
      !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== 'your-project-id'
    );
  } catch {
    return false;
  }
}

// ============================================================
// Helper: convert Firestore doc to plain object with id
// ============================================================

function docToObject<T>(doc: DocumentData): T {
  const data = doc.data();
  // Convert Firestore Timestamps to ISO strings
  const converted: Record<string, unknown> = { id: doc.id };
  for (const [key, value] of Object.entries(data)) {
    if (value instanceof Timestamp) {
      converted[key] = value.toDate().toISOString();
    } else {
      converted[key] = value;
    }
  }
  return converted as T;
}

// Normalize an order from Firestore — handles both new format (nameTh/nameEn)
// and legacy seeded format (productName/totalPrice) for order items.
function normalizeFirestoreOrder(order: Order): Order {
  return {
    ...order,
    orderId: order.orderId || order.id,
    branchName: order.branchName || order.branchId,
    items: (order.items ?? []).map((item: any) => ({
      productId: item.productId ?? '',
      nameTh: item.nameTh ?? item.productName ?? '',
      nameEn: item.nameEn ?? item.productName ?? '',
      quantity: item.quantity ?? 0,
      unitPrice: item.unitPrice ?? 0,
      total: item.total ?? item.totalPrice ?? 0,
      unit: item.unit ?? '',
    })),
  };
}

// ============================================================
// 1. useProducts
// ============================================================

export function useProducts(category?: string) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      const data = category
        ? mockData.products.filter((p) => p.category === category)
        : mockData.products;
      setProducts(data);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    let q: Query<DocumentData> = collection(db, 'products');
    if (category) {
      q = query(q, where('category', '==', category));
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((d) => docToObject<Product>(d));
        setProducts(items);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('useProducts error:', err);
        setError(err);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [category, refreshKey]);

  return { products, loading, error, refresh };
}

// ============================================================
// 2. useLowStockProducts
// ============================================================

export function useLowStockProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      const data = mockData.products.filter((p) => p.stock <= p.minStock);
      setProducts(data);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);

    // Firestore cannot do cross-field comparisons in a query,
    // so we fetch all products and filter client-side.
    const q = collection(db, 'products');
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs
          .map((d) => docToObject<Product>(d))
          .filter((p) => p.stock <= p.minStock);
        setProducts(items);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('useLowStockProducts error:', err);
        setError(err);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  return { products, loading, error };
}

// ============================================================
// 3. useBranches
// ============================================================

export function useBranches() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setBranches(mockData.branches);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    const q = collection(db, 'branches');
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((d) => docToObject<Branch>(d));
        setBranches(items);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('useBranches error:', err);
        setError(err);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [refreshKey]);

  return { branches, loading, error, refresh };
}

// ============================================================
// 4. useOrders
// ============================================================

interface OrderFilters {
  branchId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export function useOrders(filters?: OrderFilters) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const filterKey = useMemo(
    () => JSON.stringify(filters ?? {}),
    [filters],
  );

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      let raw = [...mockData.orders];
      if (filters?.branchId) {
        raw = raw.filter((o) => o.branchId === filters.branchId);
      }
      if (filters?.status) {
        raw = raw.filter((o) => o.status === filters.status);
      }
      if (filters?.startDate) {
        raw = raw.filter((o) => o.createdAt >= filters.startDate!);
      }
      if (filters?.endDate) {
        raw = raw.filter((o) => o.createdAt <= filters.endDate!);
      }
      setOrders(adaptMockOrders(raw));
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    let q: Query<DocumentData> = collection(db, 'orders');

    const constraints: Parameters<typeof query>[1][] = [];
    if (filters?.branchId) {
      constraints.push(where('branchId', '==', filters.branchId));
    }
    if (filters?.status) {
      constraints.push(where('status', '==', filters.status));
    }
    if (filters?.startDate) {
      constraints.push(where('createdAt', '>=', filters.startDate));
    }
    if (filters?.endDate) {
      constraints.push(where('createdAt', '<=', filters.endDate));
    }

    if (constraints.length > 0) {
      q = query(q, ...constraints);
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((d) => normalizeFirestoreOrder(docToObject<Order>(d)));
        setOrders(items);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('useOrders error:', err);
        setError(err);
        setLoading(false);
      },
    );

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, refreshKey]);

  return { orders, loading, error, refresh };
}

// ============================================================
// 5. useRecentOrders
// ============================================================

export function useRecentOrders(count: number = 5, branchId?: string) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      const raw = [...mockData.orders]
        .filter((o) => !branchId || o.branchId === branchId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, count);
      setOrders(adaptMockOrders(raw));
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    const constraints: import('firebase/firestore').QueryConstraint[] = [orderBy('createdAt', 'desc')];
    if (branchId) constraints.unshift(where('branchId', '==', branchId));
    constraints.push(firestoreLimit(count));
    const q = query(collection(db, 'orders'), ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((d) => normalizeFirestoreOrder(docToObject<Order>(d)));
        setOrders(items);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('useRecentOrders error:', err);
        setError(err);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [count, branchId]);

  return { orders, loading, error };
}

// ============================================================
// 6. useOrder (single document)
// ============================================================

export function useOrder(orderId: string) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!orderId) {
      setOrder(null);
      setLoading(false);
      return;
    }

    if (!isFirebaseConfigured()) {
      const raw = mockData.orders.find((o) => o.id === orderId);
      const found = raw ? adaptMockOrders([raw])[0] : null;
      setOrder(found);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    const docRef = doc(db, 'orders', orderId);

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setOrder(normalizeFirestoreOrder(docToObject<Order>(snapshot)));
        } else {
          setOrder(null);
        }
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('useOrder error:', err);
        setError(err);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [orderId]);

  return { order, loading, error };
}

// ============================================================
// 7. useCustomers
// ============================================================

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setCustomers(mockData.customers);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    const q = collection(db, 'customers');
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((d) => docToObject<Customer>(d));
        setCustomers(items);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('useCustomers error:', err);
        setError(err);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [refreshKey]);

  return { customers, loading, error, refresh };
}

// ============================================================
// 8. useAnnouncements
// ============================================================

export function useAnnouncements(activeOnly: boolean = false) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      let data = [...mockData.announcements];
      if (activeOnly) {
        const now = new Date().toISOString();
        data = data.filter((a) => {
          if (a.expiresAt && a.expiresAt < now) return false;
          return true;
        });
      }
      setAnnouncements(data);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    let q: Query<DocumentData> = collection(db, 'announcements');

    if (activeOnly) {
      q = query(q, where('isActive', '==', true));
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        let items = snapshot.docs.map((d) => docToObject<Announcement>(d));
        if (activeOnly) {
          const now = new Date().toISOString();
          items = items.filter((a) => !a.expiresAt || a.expiresAt >= now);
        }
        setAnnouncements(items);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('useAnnouncements error:', err);
        setError(err);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [activeOnly]);

  return { announcements, loading, error };
}

// ============================================================
// 9. useStockAdjustments
// ============================================================

interface StockAdjustment {
  id: string;
  productId: string;
  productName: string;
  type: 'add' | 'remove' | 'count';
  quantity: number;
  reason: string;
  performedBy: string;
  createdAt: string;
}

export function useStockAdjustments(limit: number = 20) {
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      // No mock stock adjustments data available; return empty array
      setAdjustments([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'stockAdjustments'),
      orderBy('createdAt', 'desc'),
      firestoreLimit(limit),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((d) => docToObject<StockAdjustment>(d));
        setAdjustments(items);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('useStockAdjustments error:', err);
        setError(err);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [limit]);

  return { adjustments, loading, error };
}

// ============================================================
// 10. useAccountingEntries
// ============================================================

interface AccountingFilters {
  type?: string;
  startDate?: string;
  endDate?: string;
}

export function useAccountingEntries(filters?: AccountingFilters) {
  const [entries, setEntries] = useState<AccountingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const filterKey = useMemo(
    () => JSON.stringify(filters ?? {}),
    [filters],
  );

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      let data = [...mockData.accountingEntries];
      if (filters?.type) {
        data = data.filter((e) => e.type === filters.type);
      }
      if (filters?.startDate) {
        data = data.filter((e) => e.date >= filters.startDate!);
      }
      if (filters?.endDate) {
        data = data.filter((e) => e.date <= filters.endDate!);
      }
      setEntries(data);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    let q: Query<DocumentData> = collection(db, 'accountingEntries');

    const constraints: Parameters<typeof query>[1][] = [];
    if (filters?.type) {
      constraints.push(where('type', '==', filters.type));
    }
    if (filters?.startDate) {
      constraints.push(where('date', '>=', filters.startDate));
    }
    if (filters?.endDate) {
      constraints.push(where('date', '<=', filters.endDate));
    }

    if (constraints.length > 0) {
      q = query(q, ...constraints);
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((d) => docToObject<AccountingEntry>(d));
        setEntries(items);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('useAccountingEntries error:', err);
        setError(err);
        setLoading(false);
      },
    );

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, refreshKey]);

  return { entries, loading, error, refresh };
}

// ============================================================
// 11. useFinancialSummary
// ============================================================

interface FinancialSummaryResult {
  revenue: number;
  expenses: number;
  profit: number;
}

export function useFinancialSummary(startDate: string, endDate: string) {
  const [summary, setSummary] = useState<FinancialSummaryResult>({
    revenue: 0,
    expenses: 0,
    profit: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!startDate || !endDate) {
      setLoading(false);
      return;
    }

    if (!isFirebaseConfigured()) {
      const filtered = mockData.accountingEntries.filter(
        (e) => e.date >= startDate && e.date <= endDate,
      );
      const revenue = filtered
        .filter((e) => e.type === 'revenue')
        .reduce((sum, e) => sum + e.amount, 0);
      const expenses = filtered
        .filter((e) => e.type === 'expense')
        .reduce((sum, e) => sum + e.amount, 0);
      setSummary({ revenue, expenses, profit: revenue - expenses });
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'accountingEntries'),
      where('date', '>=', startDate),
      where('date', '<=', endDate),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((d) => docToObject<AccountingEntry>(d));
        const revenue = items
          .filter((e) => e.type === 'revenue')
          .reduce((sum, e) => sum + e.amount, 0);
        const expenses = items
          .filter((e) => e.type === 'expense')
          .reduce((sum, e) => sum + e.amount, 0);
        setSummary({ revenue, expenses, profit: revenue - expenses });
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('useFinancialSummary error:', err);
        setError(err);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [startDate, endDate]);

  return { summary, loading, error };
}

// ============================================================
// 12. useDashboardStats
// ============================================================

interface DashboardStats {
  totalSpent: number;
  activeOrders: number;
  pendingOrders: number;
  lowStockCount: number;
  activeBranches: number;
}

export function useDashboardStats(branchId?: string) {
  const [stats, setStats] = useState<DashboardStats>({
    totalSpent: 0,
    activeOrders: 0,
    pendingOrders: 0,
    lowStockCount: 0,
    activeBranches: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const filterByBranch = <T extends { branchId?: string }>(list: T[]) =>
      branchId ? list.filter((x) => x.branchId === branchId) : list;

    if (!isFirebaseConfigured()) {
      const scopedOrders = filterByBranch(mockData.orders);
      const totalSpent = scopedOrders
        .filter((o) => o.status === 'delivered')
        .reduce((sum, o) => sum + o.total, 0);
      const activeOrders = scopedOrders.filter(
        (o) =>
          o.status !== 'delivered' &&
          o.status !== 'cancelled',
      ).length;
      const pendingOrders = scopedOrders.filter(
        (o) => o.status === 'new',
      ).length;
      const lowStockCount = mockData.products.filter(
        (p) => p.stock <= p.minStock,
      ).length;
      const activeBranches = mockData.branches.filter(
        (b) => b.isActive,
      ).length;

      setStats({
        totalSpent,
        activeOrders,
        pendingOrders,
        lowStockCount,
        activeBranches,
      });
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);

    // Listen to orders, products, and branches simultaneously
    const unsubscribers: (() => void)[] = [];
    let ordersData: Order[] = [];
    let productsData: Product[] = [];
    let branchesData: Branch[] = [];
    let loadedCount = 0;

    function recalculate() {
      if (loadedCount < 3) return; // Wait for all collections

      const scopedOrders = branchId ? ordersData.filter((o) => o.branchId === branchId) : ordersData;
      const totalSpent = scopedOrders
        .filter((o) => o.status === 'delivered')
        .reduce((sum, o) => sum + o.total, 0);
      const activeOrders = scopedOrders.filter(
        (o) =>
          o.status !== 'delivered' &&
          o.status !== 'cancelled',
      ).length;
      const pendingOrders = scopedOrders.filter(
        (o) => o.status === 'new',
      ).length;
      const lowStockCount = productsData.filter(
        (p) => p.stock <= p.minStock,
      ).length;
      const activeBranches = branchesData.filter(
        (b) => b.isActive,
      ).length;

      setStats({
        totalSpent,
        activeOrders,
        pendingOrders,
        lowStockCount,
        activeBranches,
      });
      setLoading(false);
      setError(null);
    }

    function handleError(err: Error) {
      console.error('useDashboardStats error:', err);
      setError(err);
      setLoading(false);
    }

    // Orders listener
    unsubscribers.push(
      onSnapshot(
        collection(db, 'orders'),
        (snapshot) => {
          ordersData = snapshot.docs.map((d) => docToObject<Order>(d));
          if (loadedCount < 3) loadedCount++;
          recalculate();
        },
        handleError,
      ),
    );

    // Products listener
    unsubscribers.push(
      onSnapshot(
        collection(db, 'products'),
        (snapshot) => {
          productsData = snapshot.docs.map((d) => docToObject<Product>(d));
          if (loadedCount < 3) loadedCount++;
          recalculate();
        },
        handleError,
      ),
    );

    // Branches listener
    unsubscribers.push(
      onSnapshot(
        collection(db, 'branches'),
        (snapshot) => {
          branchesData = snapshot.docs.map((d) => docToObject<Branch>(d));
          if (loadedCount < 3) loadedCount++;
          recalculate();
        },
        handleError,
      ),
    );

    return () => unsubscribers.forEach((unsub) => unsub());
  }, [branchId]);

  return { stats, loading, error };
}

// ============================================================
// Per-branch monthly stats (branch management cards)
// ============================================================

export interface BranchMonthlyStat {
  orders: number; // orders created this month, excluding cancelled
  spent: number;  // ฿ of orders delivered this month
}

// One month-scoped query for all branches, grouped by branchId client-side —
// so the branch management page shows real numbers without a per-branch read.
export function useBranchMonthlyStats() {
  const [stats, setStats] = useState<Record<string, BranchMonthlyStat>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setStats({});
      setLoading(false);
      return;
    }

    setLoading(true);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const q = query(
      collection(db, 'orders'),
      where('createdAt', '>=', Timestamp.fromDate(startOfMonth)),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const map: Record<string, BranchMonthlyStat> = {};
        snapshot.docs.forEach((d) => {
          const o = d.data();
          const branchId = o.branchId as string | undefined;
          if (!branchId) return;
          if (!map[branchId]) map[branchId] = { orders: 0, spent: 0 };
          if (o.status !== 'cancelled') map[branchId].orders += 1;
          if (o.status === 'delivered') map[branchId].spent += (o.total as number) || 0;
        });
        setStats(map);
        setLoading(false);
      },
      (err) => {
        console.error('useBranchMonthlyStats error:', err);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  return { stats, loading };
}

// ============================================================
// Order Window
// ============================================================

export function useOrderWindow() {
  const [mode, setMode] = useState<'scheduled' | 'always_open' | 'always_closed'>('scheduled');
  const [openTime, setOpenTime] = useState('08:00');
  const [closeTime, setCloseTime] = useState('14:00');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ref = doc(db, 'settings', 'main');
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setMode(data.orderWindowMode ?? 'scheduled');
        setOpenTime(data.orderOpenTime ?? '08:00');
        setCloseTime(data.orderCloseTime ?? '14:00');
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Derived: is accepting orders right now?
  const isOpen = (() => {
    if (mode === 'always_open') return true;
    if (mode === 'always_closed') return false;
    const toMin = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    const now = new Date();
    const cur = now.getHours() * 60 + now.getMinutes();
    return cur >= toMin(openTime) && cur < toMin(closeTime);
  })();

  return { mode, isOpen, openTime, closeTime, loading };
}

// ============================================================
// useInvoices
// ============================================================

interface InvoiceHookFilters {
  branchId?: string;
  status?: string;
}

export function useInvoices(filters?: InvoiceHookFilters) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const filterKey = useMemo(
    () => JSON.stringify(filters ?? {}),
    [filters],
  );

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setInvoices([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    // Fetch all invoices ordered by createdAt, filter client-side to avoid composite index requirements
    const q = query(collection(db, 'invoices'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        let items = snapshot.docs.map((d) => {
          const data = d.data();
          const converted: Record<string, unknown> = { id: d.id };
          for (const [key, value] of Object.entries(data)) {
            if (value instanceof Timestamp) {
              converted[key] = value.toDate();
            } else {
              converted[key] = value;
            }
          }
          return converted as unknown as Invoice;
        });
        if (filters?.branchId) items = items.filter((inv) => inv.branchId === filters.branchId);
        if (filters?.status) items = items.filter((inv) => inv.status === filters.status);
        setInvoices(items);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('useInvoices error:', err);
        setError(err);
        setLoading(false);
      },
    );

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, refreshKey]);

  return { invoices, loading, error, refresh };
}

// ============================================================
// usePaymentsByInvoice
// ============================================================

export function usePaymentsByInvoice(invoiceId: string) {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!invoiceId || !isFirebaseConfigured()) {
      setPayments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'paymentRecords'),
      where('invoiceId', '==', invoiceId),
      orderBy('createdAt', 'desc'),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((d) => {
          const data = d.data();
          const converted: Record<string, unknown> = { id: d.id };
          for (const [key, value] of Object.entries(data)) {
            if (value instanceof Timestamp) {
              converted[key] = value.toDate();
            } else {
              converted[key] = value;
            }
          }
          return converted as unknown as PaymentRecord;
        });
        setPayments(items);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('usePaymentsByInvoice error:', err);
        setError(err);
        setLoading(false);
      },
    );

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId, refreshKey]);

  return { payments, loading, error, refresh };
}

// ============================================================
// Notifications (real-time new order alerts)
// ============================================================

export interface AppNotification {
  id: string;
  type:
    | 'new_order'
    | 'order_accepted'
    | 'order_packed'
    | 'order_dispatched'
    | 'order_delivered'
    | 'order_revised'
    | 'order_cancelled'
    | 'order_status'
    | 'payment';
  title: string;
  message: string;
  orderId?: string;
  orderNumber?: string;
  branchName?: string;
  total?: number;
  actorName?: string;
  timestamp: Date;
  read: boolean;
}

const ADMIN_LAST_SEEN_KEY = 'admin_notif_last_seen_ts';
const branchLastSeenKey = (branchId: string) => `branch_notif_last_seen_${branchId}`;

// Map order timeline action → notification type. Only actions the
// branch genuinely cares about are listed; others are skipped.
const BRANCH_ACTION_TO_TYPE: Record<string, AppNotification['type']> = {
  accepted: 'order_accepted',
  packed: 'order_packed',
  dispatched: 'order_dispatched',
  delivered: 'order_delivered',
  revised: 'order_revised',
  cancelled: 'order_cancelled',
};

// Admin (no branchId): live snapshot listener — only fires for orders
// created/modified while the app is open. Used as a "new orders just
// came in" toast feed.
//
// Branch (with branchId): derives notifications from the order timeline
// arrays of the branch's recent orders. This way the bell reflects the
// full history of factory actions on their orders, not just events
// that happened to land while the app was foregrounded.
export function useNotifications(opts?: { branchId?: string }) {
  const branchId = opts?.branchId;
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  // Tracks the last status we've already notified for each order, so a
  // re-emit of the same snapshot doesn't fire a duplicate notification.
  // (Used by the admin path only.)
  const lastNotifiedStatusRef = useRef<Map<string, string>>(new Map());
  const lastSeenRef = useRef<number>(0);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      return;
    }

    // Reset per-scope refs whenever branchId changes (switching branches).
    knownOrderIdsRef.current = new Set();
    lastNotifiedStatusRef.current = new Map();

    const storageKey = branchId ? branchLastSeenKey(branchId) : ADMIN_LAST_SEEN_KEY;
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem(storageKey);
      lastSeenRef.current = saved ? parseInt(saved, 10) : Date.now();
      if (!saved) {
        // First time ever — set baseline so we don't flood with old orders
        window.localStorage.setItem(storageKey, String(lastSeenRef.current));
      }
    }

    // ====================================================
    // Branch path: derive from order.timeline[]
    // ====================================================
    if (branchId) {
      const q = query(
        collection(db, 'orders'),
        where('branchId', '==', branchId),
        orderBy('createdAt', 'desc'),
        firestoreLimit(30),
      );
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const items: AppNotification[] = [];
          for (const docSnap of snapshot.docs) {
            const data = docSnap.data();
            const timeline = (data.timeline ?? []) as OrderTimelineEntry[];
            const orderDocId = docSnap.id;
            const orderNumber = (data.orderId as string) || '';
            const branchName = (data.branchName as string) || '';
            const total = (data.total as number) || 0;

            for (let i = 0; i < timeline.length; i++) {
              const entry = timeline[i];
              const notifType = BRANCH_ACTION_TO_TYPE[entry.action as string];
              if (!notifType) continue;
              const at =
                entry.at instanceof Timestamp
                  ? entry.at.toDate()
                  : new Date(entry.at as unknown as string);
              items.push({
                id: `${orderDocId}-${i}`,
                type: notifType,
                title: '',
                message: entry.note ?? '',
                orderId: orderDocId,
                orderNumber,
                branchName,
                total,
                actorName: entry.staffName,
                timestamp: at,
                read: at.getTime() <= lastSeenRef.current,
              });
            }
          }
          items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
          const top = items.slice(0, 30);
          setNotifications(top);
          setUnreadCount(top.filter((n) => !n.read).length);
        },
        (err) => {
          console.error('useNotifications (branch) error:', err);
        },
      );
      return () => unsubscribe();
    }

    // ====================================================
    // Admin path: live snapshot diff for new_order toasts
    // ====================================================
    const q = query(
      collection(db, 'orders'),
      orderBy('createdAt', 'desc'),
      firestoreLimit(20),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newNotifs: AppNotification[] = [];
      snapshot.docChanges().forEach((change) => {
        if (change.type !== 'added') return;
        const data = change.doc.data();
        const orderDocId = change.doc.id;
        if (knownOrderIdsRef.current.has(orderDocId)) return;
        knownOrderIdsRef.current.add(orderDocId);

        const createdAt = data.createdAt instanceof Timestamp
          ? data.createdAt.toDate()
          : new Date(data.createdAt);
        if (createdAt.getTime() <= lastSeenRef.current) return;

        newNotifs.push({
          id: `order-${orderDocId}`,
          type: 'new_order',
          title: '',
          message: '',
          orderId: orderDocId,
          orderNumber: data.orderId || '',
          branchName: data.branchName || '',
          total: data.total || 0,
          timestamp: createdAt,
          read: false,
        });
      });

      if (newNotifs.length > 0) {
        setNotifications((prev) => {
          // Dedupe by id in case of re-emit
          const existing = new Set(prev.map((n) => n.id));
          const fresh = newNotifs.filter((n) => !existing.has(n.id));
          return [...fresh, ...prev].slice(0, 50);
        });
        setUnreadCount((c) => c + newNotifs.length);
      }
    });

    return () => unsubscribe();
  }, [branchId]);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    const now = Date.now();
    lastSeenRef.current = now;
    if (typeof window !== 'undefined') {
      const key = branchId ? branchLastSeenKey(branchId) : ADMIN_LAST_SEEN_KEY;
      window.localStorage.setItem(key, String(now));
    }
  }, [branchId]);

  const clearAll = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
    const now = Date.now();
    lastSeenRef.current = now;
    if (typeof window !== 'undefined') {
      const key = branchId ? branchLastSeenKey(branchId) : ADMIN_LAST_SEEN_KEY;
      window.localStorage.setItem(key, String(now));
    }
  }, [branchId]);

  return { notifications, unreadCount, markAllRead, clearAll };
}
