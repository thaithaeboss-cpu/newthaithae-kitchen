import { db, storage } from './firebase';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  getDocFromCache,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
  increment,
  runTransaction,
  arrayUnion,
  arrayRemove,
  deleteField,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// ============================================================
// Interfaces & Types
// ============================================================

export interface Product {
  id: string;
  sku: string;
  nameTh: string;
  nameEn: string;
  category: 'glass' | 'meat' | 'curry' | 'sauce' | 'dessert' | 'filling';
  // Default price used for internal branches and reports.
  price: number;
  // Optional override for external customers. When unset, external
  // customers see `price`.
  priceExternal?: number;
  unit: string;
  stock: number;
  minStock: number;
  description?: string;
  image?: string;
  isActive: boolean;
  isPublic?: boolean;
  visibleToBranches?: string[];
  unitTh?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type CustomerType = 'internal' | 'external';

// Returns the price a branch of the given customer type should pay
// for the product. Missing customer type or missing priceExternal both
// fall back to the default `price`.
export function effectivePrice(product: Pick<Product, 'price' | 'priceExternal'>, customerType?: CustomerType): number {
  if (customerType === 'external' && typeof product.priceExternal === 'number') {
    return product.priceExternal;
  }
  return product.price;
}

export interface Branch {
  id: string;
  code: string;
  nameTh: string;
  nameEn: string;
  address: string;
  phone: string;
  email: string;
  manager: string;
  openTime: string;
  closeTime: string;
  isActive: boolean;
  favoriteProductIds?: string[];
  ownerEmail?: string;
  // Pricing tier. Missing value is treated as 'internal' for legacy rows.
  customerType?: CustomerType;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  productId: string;
  nameTh: string;
  nameEn: string;
  quantity: number;
  unitPrice: number;
  total: number;
  unit: string;
}

export type OrderStatus =
  | 'new'
  | 'processing'
  | 'preparing'
  | 'dispatched'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

// Staff audit trail: who did what, when
export interface OrderTimelineEntry {
  action: 'accepted' | 'status_changed' | 'packed' | 'dispatched' | 'delivered' | 'cancelled' | 'revised' | 'note';
  fromStatus?: OrderStatus;
  toStatus?: OrderStatus;
  staffUid?: string;
  staffName?: string;
  at: Date;
  note?: string;
}

export interface Order {
  id: string;
  orderId: string;
  branchId: string;
  branchName: string;
  customerId?: string;
  customerName?: string;
  items: OrderItem[];
  subtotal: number;
  vat: number;
  deliveryFee: number;
  total: number;
  status: OrderStatus;
  notes?: string;
  deliveryDate?: string;
  timeSlot?: string;
  estimatedDelivery?: string;
  actualDelivery?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  paymentStatus?: 'uninvoiced' | 'unpaid' | 'partial' | 'paid';
  // Staff action tracking
  acceptedByUid?: string;
  acceptedByName?: string;
  acceptedAt?: Date;
  packedByUid?: string;
  packedByName?: string;
  packedAt?: Date;
  deliveredByUid?: string;
  deliveredByName?: string;
  deliveredAt?: Date;
  // Collaborative per-item checklist. Keyed by productId because items[]
  // already enforces one line per product. Lets two packers tick items
  // in the same order from different devices and see each other in
  // real time, with a record of who ticked what.
  itemChecks?: Record<string, { uid: string; name: string; at: Date }>;
  timeline?: OrderTimelineEntry[];
  createdAt: Date;
  updatedAt: Date;
}

// Staff profile for factory/kitchen workers — links a Firebase Auth user to a display name + role
export type StaffRole = 'admin' | 'kitchen' | 'packer' | 'both' | 'delivery';

export interface Staff {
  id: string;           // Firestore doc id (we use the Firebase Auth uid so lookup is O(1))
  authEmail: string;    // lowercase for deterministic lookup
  name: string;         // display name, e.g. "แบงค์"
  role: StaffRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Customer {
  id: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  taxId: string;
  creditTerms: number;
  creditLimit: number;
  outstandingBalance: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Announcement {
  id: string;
  category: 'new_policy' | 'kitchen_notice' | 'system_update' | 'promotion';
  title: string;
  content: string;
  priority: 'low' | 'medium' | 'high';
  isActive: boolean;
  expiresAt?: Date;
  createdAt: Date;
}

export interface StockAdjustment {
  id: string;
  productId: string;
  productName: string;
  type: 'add' | 'remove' | 'count';
  quantity: number;
  reason: string;
  notes?: string;
  user: string;
  createdAt: Date;
}

export interface AccountingEntry {
  id: string;
  type: 'revenue' | 'expense' | 'invoice';
  description: string;
  amount: number;
  reference?: string;
  orderId?: string;
  branchId?: string;
  customerId?: string;
  paymentStatus: 'paid' | 'pending' | 'overdue';
  dueDate?: Date;
  paidDate?: Date;
  createdAt: Date;
}

// ---- Invoice & Payment types ----

export type InvoiceStatus = 'unpaid' | 'partial' | 'paid' | 'void';
export type PaymentMethod = 'bank_transfer' | 'cash' | 'cheque';

export interface InvoiceLineItem {
  productId: string;
  nameTh: string;
  nameEn: string;
  quantity: number;
  unitPrice: number;
  total: number;
  unit: string;
  sourceOrderId: string;
  sourceOrderNumber: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;        // INV-YYYYMM-XXXXX
  branchId: string;
  branchName: string;
  orderIds: string[];
  orderNumbers: string[];
  items: InvoiceLineItem[];
  subtotal: number;
  vat: number;
  deliveryFee: number;
  total: number;
  amountPaid: number;
  amountDue: number;
  status: InvoiceStatus;
  dueDate: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentRecord {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  branchId: string;
  branchName: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  paymentDate: Date;
  notes?: string;
  recordedBy: string;
  createdAt: Date;
}

export interface InvoiceFilters {
  branchId?: string;
  status?: InvoiceStatus;
  startDate?: Date;
  endDate?: Date;
}

export interface OrderFilters {
  branchId?: string;
  status?: OrderStatus;
  startDate?: Date;
  endDate?: Date;
}

export interface AccountingFilters {
  type?: 'revenue' | 'expense' | 'invoice';
  paymentStatus?: 'paid' | 'pending' | 'overdue';
  startDate?: Date;
  endDate?: Date;
  branchId?: string;
  customerId?: string;
}

export interface FinancialSummary {
  totalRevenue: number;
  totalExpenses: number;
  totalInvoiced: number;
  totalPaid: number;
  totalPending: number;
  totalOverdue: number;
  netIncome: number;
  entries: AccountingEntry[];
}

// ============================================================
// Helpers
// ============================================================

function isFirestoreConfigured(): boolean {
  try {
    return !!db;
  } catch {
    return false;
  }
}

function toDate(value: unknown): Date {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') return new Date(value);
  return new Date();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function convertTimestamps<T>(data: Record<string, any>, id: string): T {
  const result = { ...data, id } as Record<string, unknown>;
  for (const key of Object.keys(result)) {
    if (result[key] instanceof Timestamp) {
      result[key] = (result[key] as Timestamp).toDate();
    }
  }
  return result as T;
}

function toTimestamp(date: Date | undefined): Timestamp | undefined {
  if (!date) return undefined;
  return Timestamp.fromDate(date instanceof Date ? date : new Date(date));
}

// ============================================================
// Products
// ============================================================

export async function getProducts(): Promise<Product[]> {
  if (!isFirestoreConfigured()) return [];
  try {
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => convertTimestamps<Product>(d.data(), d.id));
  } catch (error) {
    console.error('Error fetching products:', error);
    return [];
  }
}

export async function getProductById(id: string): Promise<Product | null> {
  if (!isFirestoreConfigured()) return null;
  try {
    const docRef = doc(db, 'products', id);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) return null;
    return convertTimestamps<Product>(snapshot.data(), snapshot.id);
  } catch (error) {
    console.error('Error fetching product:', error);
    return null;
  }
}

export async function addProduct(data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'products'), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateProduct(id: string, data: Partial<Omit<Product, 'id' | 'createdAt'>>): Promise<void> {
  const docRef = doc(db, 'products', id);
  await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteProduct(id: string): Promise<void> {
  const docRef = doc(db, 'products', id);
  await deleteDoc(docRef);
}

export async function updateStock(id: string, adjustment: number, reason: string): Promise<void> {
  const docRef = doc(db, 'products', id);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(docRef);
    if (!snapshot.exists()) throw new Error('Product not found');
    const currentStock = snapshot.data().stock ?? 0;
    const newStock = currentStock + adjustment;
    if (newStock < 0) throw new Error('Stock cannot be negative');
    transaction.update(docRef, {
      stock: newStock,
      updatedAt: serverTimestamp(),
    });
    const adjustmentRef = doc(collection(db, 'stockAdjustments'));
    transaction.set(adjustmentRef, {
      productId: id,
      productName: snapshot.data().nameTh || snapshot.data().nameEn || '',
      type: adjustment > 0 ? 'add' : 'remove',
      quantity: Math.abs(adjustment),
      reason,
      user: 'system',
      createdAt: serverTimestamp(),
    });
  });
}

export async function getProductsByCategory(category: Product['category']): Promise<Product[]> {
  if (!isFirestoreConfigured()) return [];
  try {
    const q = query(
      collection(db, 'products'),
      where('category', '==', category),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => convertTimestamps<Product>(d.data(), d.id));
  } catch (error) {
    console.error('Error fetching products by category:', error);
    return [];
  }
}

export async function getLowStockProducts(): Promise<Product[]> {
  if (!isFirestoreConfigured()) return [];
  try {
    const q = query(
      collection(db, 'products'),
      where('isActive', '==', true),
      orderBy('stock', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map((d) => convertTimestamps<Product>(d.data(), d.id))
      .filter((p) => p.stock <= p.minStock);
  } catch (error) {
    console.error('Error fetching low stock products:', error);
    return [];
  }
}

// ============================================================
// Branches
// ============================================================

export async function getBranches(): Promise<Branch[]> {
  if (!isFirestoreConfigured()) return [];
  try {
    const q = query(collection(db, 'branches'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => convertTimestamps<Branch>(d.data(), d.id));
  } catch (error) {
    console.error('Error fetching branches:', error);
    return [];
  }
}

export async function getBranchById(id: string): Promise<Branch | null> {
  if (!isFirestoreConfigured()) return null;
  try {
    const docRef = doc(db, 'branches', id);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) return null;
    return convertTimestamps<Branch>(snapshot.data(), snapshot.id);
  } catch (error) {
    console.error('Error fetching branch:', error);
    return null;
  }
}

export async function addBranch(data: Omit<Branch, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'branches'), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateBranch(id: string, data: Partial<Omit<Branch, 'id' | 'createdAt'>>): Promise<void> {
  const docRef = doc(db, 'branches', id);
  await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteBranch(id: string): Promise<void> {
  const docRef = doc(db, 'branches', id);
  await deleteDoc(docRef);
}

// ============================================================
// Employees (for expense / payroll roster)
// ============================================================

export interface Employee {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
}

export async function getEmployees(): Promise<Employee[]> {
  const snap = await getDocs(query(collection(db, 'employees'), orderBy('name')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Employee));
}

export async function addEmployee(name: string): Promise<string> {
  const docRef = await addDoc(collection(db, 'employees'), {
    name: name.trim(),
    isActive: true,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function deleteEmployee(id: string): Promise<void> {
  await deleteDoc(doc(db, 'employees', id));
}

// ============================================================
// Suppliers
// ============================================================

export interface Supplier {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
}

export async function getSuppliers(): Promise<Supplier[]> {
  const snap = await getDocs(query(collection(db, 'suppliers'), orderBy('name')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Supplier));
}

export async function addSupplier(name: string): Promise<string> {
  const docRef = await addDoc(collection(db, 'suppliers'), {
    name: name.trim(),
    isActive: true,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function deleteSupplier(id: string): Promise<void> {
  await deleteDoc(doc(db, 'suppliers', id));
}

// ============================================================
// Expenses
// ============================================================

export type ExpenseCategory = 'salary' | 'ingredient' | 'utility' | 'packaging' | 'transport' | 'other';

export interface Expense {
  id: string;
  date: string; // ISO YYYY-MM-DD
  category: ExpenseCategory;
  description: string;
  amount: number; // total (GST-inclusive for ingredient)
  paidTo?: string;
  transferAmount?: number; // salary
  cashAmount?: number;     // salary (auto)
  gstAmount?: number;      // ingredient (for tax claims)
  createdAt?: Date;
}

export async function getExpenses(): Promise<Expense[]> {
  const snap = await getDocs(query(collection(db, 'expenses'), orderBy('date', 'desc')));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : data.createdAt,
    } as Expense;
  });
}

export async function addExpense(data: Omit<Expense, 'id' | 'createdAt'>): Promise<string> {
  // Strip undefined fields (Firestore rejects them)
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) clean[k] = v;
  }
  const docRef = await addDoc(collection(db, 'expenses'), {
    ...clean,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function deleteExpense(id: string): Promise<void> {
  await deleteDoc(doc(db, 'expenses', id));
}

export async function toggleBranchFavorite(branchId: string, productId: string, isFavorite: boolean): Promise<void> {
  const docRef = doc(db, 'branches', branchId);
  await updateDoc(docRef, {
    favoriteProductIds: isFavorite ? arrayRemove(productId) : arrayUnion(productId),
    updatedAt: serverTimestamp(),
  });
}

// ============================================================
// Orders
// ============================================================

export async function generateOrderId(): Promise<string> {
  try {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return 'CK-00001';
    const lastOrder = snapshot.docs[0].data();
    const lastId = lastOrder.orderId as string;
    const match = lastId.match(/CK-(\d+)/);
    const nextNum = match ? parseInt(match[1], 10) + 1 : 1;
    return `CK-${String(nextNum).padStart(5, '0')}`;
  } catch (error) {
    console.error('Error generating order ID:', error);
    return `CK-${String(Date.now()).slice(-5)}`;
  }
}

export async function getOrders(filters?: OrderFilters): Promise<Order[]> {
  if (!isFirestoreConfigured()) return [];
  try {
    const constraints: Parameters<typeof query>[1][] = [];

    if (filters?.branchId) {
      constraints.push(where('branchId', '==', filters.branchId));
    }
    if (filters?.status) {
      constraints.push(where('status', '==', filters.status));
    }
    if (filters?.startDate) {
      constraints.push(where('createdAt', '>=', Timestamp.fromDate(filters.startDate)));
    }
    if (filters?.endDate) {
      constraints.push(where('createdAt', '<=', Timestamp.fromDate(filters.endDate)));
    }

    constraints.push(orderBy('createdAt', 'desc'));

    const q = query(collection(db, 'orders'), ...constraints);
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => convertTimestamps<Order>(d.data(), d.id));
  } catch (error) {
    console.error('Error fetching orders:', error);
    return [];
  }
}

export async function getOrderById(id: string): Promise<Order | null> {
  if (!isFirestoreConfigured()) return null;
  try {
    const docRef = doc(db, 'orders', id);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) return null;
    return convertTimestamps<Order>(snapshot.data(), snapshot.id);
  } catch (error) {
    console.error('Error fetching order:', error);
    return null;
  }
}

export async function getOrdersByBranch(branchId: string): Promise<Order[]> {
  return getOrders({ branchId });
}

export async function getOrdersByStatus(status: OrderStatus): Promise<Order[]> {
  return getOrders({ status });
}

export async function addOrder(
  data: Omit<Order, 'id' | 'orderId' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const orderId = await generateOrderId();
  const docRef = await addDoc(collection(db, 'orders'), {
    ...data,
    orderId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateOrderStatus(
  id: string,
  status: OrderStatus,
  actor?: { uid: string; name: string },
  // Callers that already hold the order (e.g. the delivery / fulfillment lists,
  // which render it from a live snapshot) should pass it here. That lets us skip
  // the server read below — a round-trip that HANGS on a weak signal, leaving the
  // button stuck on "saving" out in the field. When omitted we read from the
  // local cache first and only fall back to the server, so we never block on the
  // network just to stamp a timeline entry.
  currentOrder?: Partial<Order> | null,
): Promise<void> {
  const docRef = doc(db, 'orders', id);
  // Resolve the current state for the timeline `fromStatus` + one-time promoted
  // fields, without a mandatory server round-trip.
  let current: Partial<Order> | null = currentOrder ?? null;
  if (!current) {
    try {
      const cached = await getDocFromCache(docRef);
      current = cached.exists() ? (cached.data() as Order) : null;
    } catch {
      try {
        const snap = await getDoc(docRef);
        current = snap.exists() ? (snap.data() as Order) : null;
      } catch {
        current = null;
      }
    }
  }
  const fromStatus = current?.status;

  const now = new Date();
  const updateData: Record<string, unknown> = {
    status,
    updatedAt: serverTimestamp(),
  };
  if (status === 'delivered') {
    updateData.actualDelivery = now.toISOString();
  }

  // Record who performed the transition
  if (actor) {
    const entry: OrderTimelineEntry = {
      action:
        fromStatus === 'new' && (status === 'processing' || status === 'preparing')
          ? 'accepted'
          : status === 'preparing'
            ? 'accepted'
            : status === 'dispatched'
              ? 'packed'
              : status === 'delivered'
                ? 'delivered'
                : status === 'cancelled'
                  ? 'cancelled'
                  : 'status_changed',
      fromStatus,
      toStatus: status,
      staffUid: actor.uid,
      staffName: actor.name,
      at: now,
    };

    // Promote the action into dedicated fields so the UI can read them without
    // scanning the whole timeline
    if (entry.action === 'accepted' && !current?.acceptedByUid) {
      updateData.acceptedByUid = actor.uid;
      updateData.acceptedByName = actor.name;
      updateData.acceptedAt = Timestamp.fromDate(now);
    }
    if (entry.action === 'packed' && !current?.packedByUid) {
      updateData.packedByUid = actor.uid;
      updateData.packedByName = actor.name;
      updateData.packedAt = Timestamp.fromDate(now);
    }
    if (entry.action === 'delivered' && !current?.deliveredByUid) {
      updateData.deliveredByUid = actor.uid;
      updateData.deliveredByName = actor.name;
      updateData.deliveredAt = Timestamp.fromDate(now);
    }

    // Timeline uses plain JS Date (Firestore converts to Timestamp inside arrays)
    updateData.timeline = arrayUnion({
      ...entry,
      at: Timestamp.fromDate(now),
    });
  }

  await updateDoc(docRef, updateData);
}

export async function updateOrder(id: string, data: Partial<Omit<Order, 'id' | 'createdAt'>>): Promise<void> {
  const docRef = doc(db, 'orders', id);
  await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

// Flip a single item's check state on an order. Used by the collaborative
// pack-checklist in /admin/fulfillment so multiple staff can tick items
// concurrently across devices and see each other in real time. Stores
// who ticked it and when so the order can later show every contributor
// in the "packed by" badge.
export async function toggleOrderItemCheck(
  orderDocId: string,
  productId: string,
  actor: { uid?: string; name: string },
): Promise<void> {
  const docRef = doc(db, 'orders', orderDocId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) throw new Error('Order not found');
  const current = snap.data() as Order;
  const alreadyChecked = !!current.itemChecks?.[productId];

  if (alreadyChecked) {
    await updateDoc(docRef, {
      [`itemChecks.${productId}`]: deleteField(),
      updatedAt: serverTimestamp(),
    });
  } else {
    await updateDoc(docRef, {
      [`itemChecks.${productId}`]: {
        uid: actor.uid ?? '',
        name: actor.name,
        at: Timestamp.fromDate(new Date()),
      },
      updatedAt: serverTimestamp(),
    });
  }
}

// Pull an order back one step in its status flow after an accidental
// click. Unlike updateOrderStatus this never re-promotes the per-actor
// fields (acceptedByUid, packedByUid, deliveredByUid) — those record
// who originally fired the (mistaken) action and stay as audit. The
// timeline gets a fresh 'status_changed' entry naming the reverter so
// the history is honest about what happened.
export async function revertOrderStatus(
  id: string,
  toStatus: OrderStatus,
  actor: { uid?: string; name: string },
): Promise<void> {
  const docRef = doc(db, 'orders', id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) throw new Error('Order not found');
  const current = snap.data() as Order;
  const fromStatus = current.status;
  if (fromStatus === toStatus) return;

  const now = new Date();
  const entry: OrderTimelineEntry = {
    action: 'status_changed',
    fromStatus,
    toStatus,
    staffUid: actor.uid,
    staffName: actor.name,
    at: now,
    note: `Reverted: ${fromStatus} → ${toStatus}`,
  };

  await updateDoc(docRef, {
    status: toStatus,
    updatedAt: serverTimestamp(),
    timeline: arrayUnion({ ...entry, at: Timestamp.fromDate(now) }),
  });
}

// Revise an existing order's line items. Caller passes the desired
// final list (mix of original lines with adjusted qty and brand-new
// lines), and the helper:
//   • diffs against the current order to determine stock impact
//   • pre-validates stock for any net increase or newly added line
//     (rejects the whole revision if any product runs short)
//   • recomputes subtotal/vat/total
//   • restocks the reduced delta and deducts the added delta (best-effort)
//   • appends a 'revised' timeline entry with a human-readable diff
//   • auto-cancels the order if the final list is empty
// Original lines preserve their snapshot unitPrice — only the qty changes.
// Newly added lines must arrive with the current tier unitPrice already
// resolved by the caller (we don't re-price here).
export async function reviseOrderItems(
  orderDocId: string,
  newItems: OrderItem[],
  actor: { uid?: string; name: string },
): Promise<{ cancelled: boolean }> {
  const docRef = doc(db, 'orders', orderDocId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) throw new Error('Order not found');
  const current = snap.data() as Order;

  if (current.status === 'delivered' || current.status === 'cancelled') {
    throw new Error('Cannot edit a delivered or cancelled order');
  }

  type DiffKind = 'increased' | 'decreased' | 'added' | 'removed';
  type Diff = {
    productId: string;
    productName: string;
    from: number;
    to: number;
    kind: DiffKind;
  };

  // Index original items by productId for quick lookup.
  const originalByProduct = new Map<string, OrderItem>();
  for (const item of current.items) {
    originalByProduct.set(item.productId, item);
  }

  // Walk the desired list — anything not present is treated as "removed".
  const newByProduct = new Map<string, OrderItem>();
  for (const item of newItems) {
    if (item.quantity > 0) newByProduct.set(item.productId, item);
  }

  const diffs: Diff[] = [];

  for (const [productId, newItem] of newByProduct) {
    const orig = originalByProduct.get(productId);
    const fromQty = orig?.quantity ?? 0;
    const toQty = newItem.quantity;
    if (fromQty === toQty) continue;
    const kind: DiffKind =
      orig === undefined ? 'added' : toQty > fromQty ? 'increased' : 'decreased';
    diffs.push({
      productId,
      productName: newItem.nameTh || newItem.nameEn,
      from: fromQty,
      to: toQty,
      kind,
    });
  }
  for (const [productId, orig] of originalByProduct) {
    if (!newByProduct.has(productId)) {
      diffs.push({
        productId,
        productName: orig.nameTh || orig.nameEn,
        from: orig.quantity,
        to: 0,
        kind: 'removed',
      });
    }
  }

  // No diffs → no-op, don't pollute the timeline.
  if (diffs.length === 0) {
    return { cancelled: false };
  }

  // Pre-check stock for every product that ends with MORE qty than before.
  // We need to read each product doc so we can compare against current stock.
  const needStockCheck = diffs.filter((d) => d.to > d.from);
  if (needStockCheck.length > 0) {
    const productSnaps = await Promise.all(
      needStockCheck.map((d) => getDoc(doc(db, 'products', d.productId))),
    );
    for (let i = 0; i < needStockCheck.length; i++) {
      const d = needStockCheck[i];
      const p = productSnaps[i];
      const available = p.exists() ? (p.data() as Product).stock ?? 0 : 0;
      const additional = d.to - d.from;
      if (additional > available) {
        throw new Error(
          `Not enough stock for "${d.productName}": need +${additional}, only ${available} in stock`,
        );
      }
    }
  }

  // Build the final items list using snapshot unitPrice from the original
  // line whenever possible. New lines keep the unitPrice the caller supplied.
  const revisedItems: OrderItem[] = newItems
    .filter((it) => it.quantity > 0)
    .map((it) => {
      const orig = originalByProduct.get(it.productId);
      const unitPrice = orig ? orig.unitPrice : it.unitPrice;
      const unit = orig ? orig.unit : it.unit;
      return {
        productId: it.productId,
        nameTh: it.nameTh,
        nameEn: it.nameEn,
        unit,
        unitPrice,
        quantity: it.quantity,
        total: unitPrice * it.quantity,
      };
    });

  const subtotal = revisedItems.reduce((s, it) => s + it.total, 0);
  // VAT/GST disabled — total equals subtotal.
  const vat = 0;
  const total = subtotal;
  const allRemoved = revisedItems.length === 0;
  const now = new Date();

  // Timeline note: "BBQ Beef: 3→5, Sticky Rice: added (2), Sauce: removed"
  const summary = diffs
    .map((d) => {
      switch (d.kind) {
        case 'added':
          return `${d.productName}: added (${d.to})`;
        case 'removed':
          return `${d.productName}: removed`;
        default:
          return `${d.productName}: ${d.from} → ${d.to}`;
      }
    })
    .join(', ');

  const reviseEntry: OrderTimelineEntry = {
    action: 'revised',
    staffUid: actor.uid,
    staffName: actor.name,
    at: now,
    note: summary,
  };

  const updateData: Record<string, unknown> = {
    items: revisedItems,
    subtotal,
    vat,
    total,
    updatedAt: serverTimestamp(),
    timeline: arrayUnion({ ...reviseEntry, at: Timestamp.fromDate(now) }),
  };

  if (allRemoved) {
    updateData.status = 'cancelled';
    updateData.actualDelivery = now.toISOString();
    const cancelEntry: OrderTimelineEntry = {
      action: 'cancelled',
      fromStatus: current.status,
      toStatus: 'cancelled',
      staffUid: actor.uid,
      staffName: actor.name,
      at: now,
      note: 'Auto-cancelled: all items removed',
    };
    updateData.timeline = arrayUnion(
      { ...reviseEntry, at: Timestamp.fromDate(now) },
      { ...cancelEntry, at: Timestamp.fromDate(now) },
    );
  }

  await updateDoc(docRef, updateData);

  // Best-effort stock reconciliation. Decreases restock, increases/additions
  // deduct. Don't block on failure — the order is already revised in Firestore.
  await Promise.all(
    diffs.map((d) => {
      const delta = d.to - d.from;
      if (delta === 0) return Promise.resolve();
      // Positive delta means we need to DEDUCT (took stock); negative means
      // RESTOCK. updateStock adds the adjustment so we negate.
      return updateStock(
        d.productId,
        -delta,
        `Revise #${current.orderId} by ${actor.name}`,
      ).catch((err) =>
        console.error(`Failed to adjust stock for ${d.productName}:`, err),
      );
    }),
  );

  return { cancelled: allRemoved };
}

export async function getRecentOrders(count: number = 10): Promise<Order[]> {
  if (!isFirestoreConfigured()) return [];
  try {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(count));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => convertTimestamps<Order>(d.data(), d.id));
  } catch (error) {
    console.error('Error fetching recent orders:', error);
    return [];
  }
}

// ============================================================
// Customers
// ============================================================

export async function getCustomers(): Promise<Customer[]> {
  if (!isFirestoreConfigured()) return [];
  try {
    const q = query(collection(db, 'customers'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => convertTimestamps<Customer>(d.data(), d.id));
  } catch (error) {
    console.error('Error fetching customers:', error);
    return [];
  }
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  if (!isFirestoreConfigured()) return null;
  try {
    const docRef = doc(db, 'customers', id);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) return null;
    return convertTimestamps<Customer>(snapshot.data(), snapshot.id);
  } catch (error) {
    console.error('Error fetching customer:', error);
    return null;
  }
}

export async function addCustomer(data: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'customers'), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateCustomer(id: string, data: Partial<Omit<Customer, 'id' | 'createdAt'>>): Promise<void> {
  const docRef = doc(db, 'customers', id);
  await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteCustomer(id: string): Promise<void> {
  const docRef = doc(db, 'customers', id);
  await deleteDoc(docRef);
}

// ============================================================
// Announcements
// ============================================================

export async function getAnnouncements(): Promise<Announcement[]> {
  if (!isFirestoreConfigured()) return [];
  try {
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => convertTimestamps<Announcement>(d.data(), d.id));
  } catch (error) {
    console.error('Error fetching announcements:', error);
    return [];
  }
}

export async function getActiveAnnouncements(): Promise<Announcement[]> {
  if (!isFirestoreConfigured()) return [];
  try {
    const q = query(
      collection(db, 'announcements'),
      where('isActive', '==', true),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    const now = new Date();
    return snapshot.docs
      .map((d) => convertTimestamps<Announcement>(d.data(), d.id))
      .filter((a) => !a.expiresAt || a.expiresAt > now);
  } catch (error) {
    console.error('Error fetching active announcements:', error);
    return [];
  }
}

export async function addAnnouncement(
  data: Omit<Announcement, 'id' | 'createdAt'>
): Promise<string> {
  const docData: Record<string, unknown> = {
    ...data,
    createdAt: serverTimestamp(),
  };
  if (data.expiresAt) {
    docData.expiresAt = Timestamp.fromDate(
      data.expiresAt instanceof Date ? data.expiresAt : new Date(data.expiresAt)
    );
  }
  const docRef = await addDoc(collection(db, 'announcements'), docData);
  return docRef.id;
}

export async function updateAnnouncement(
  id: string,
  data: Partial<Omit<Announcement, 'id' | 'createdAt'>>
): Promise<void> {
  const docRef = doc(db, 'announcements', id);
  const updateData: Record<string, unknown> = { ...data };
  if (data.expiresAt) {
    updateData.expiresAt = Timestamp.fromDate(
      data.expiresAt instanceof Date ? data.expiresAt : new Date(data.expiresAt)
    );
  }
  await updateDoc(docRef, updateData);
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const docRef = doc(db, 'announcements', id);
  await deleteDoc(docRef);
}

// ============================================================
// Stock Adjustments
// ============================================================

export async function addStockAdjustment(
  data: Omit<StockAdjustment, 'id' | 'createdAt'>
): Promise<string> {
  const docRef = await addDoc(collection(db, 'stockAdjustments'), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function getStockAdjustments(count?: number): Promise<StockAdjustment[]> {
  if (!isFirestoreConfigured()) return [];
  try {
    const constraints: Parameters<typeof query>[1][] = [orderBy('createdAt', 'desc')];
    if (count) constraints.push(limit(count));
    const q = query(collection(db, 'stockAdjustments'), ...constraints);
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => convertTimestamps<StockAdjustment>(d.data(), d.id));
  } catch (error) {
    console.error('Error fetching stock adjustments:', error);
    return [];
  }
}

export async function getStockAdjustmentsByProduct(productId: string): Promise<StockAdjustment[]> {
  if (!isFirestoreConfigured()) return [];
  try {
    const q = query(
      collection(db, 'stockAdjustments'),
      where('productId', '==', productId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => convertTimestamps<StockAdjustment>(d.data(), d.id));
  } catch (error) {
    console.error('Error fetching stock adjustments by product:', error);
    return [];
  }
}

// ============================================================
// Accounting Entries
// ============================================================

export async function getAccountingEntries(filters?: AccountingFilters): Promise<AccountingEntry[]> {
  if (!isFirestoreConfigured()) return [];
  try {
    const constraints: Parameters<typeof query>[1][] = [];

    if (filters?.type) {
      constraints.push(where('type', '==', filters.type));
    }
    if (filters?.paymentStatus) {
      constraints.push(where('paymentStatus', '==', filters.paymentStatus));
    }
    if (filters?.branchId) {
      constraints.push(where('branchId', '==', filters.branchId));
    }
    if (filters?.customerId) {
      constraints.push(where('customerId', '==', filters.customerId));
    }
    if (filters?.startDate) {
      constraints.push(where('createdAt', '>=', Timestamp.fromDate(filters.startDate)));
    }
    if (filters?.endDate) {
      constraints.push(where('createdAt', '<=', Timestamp.fromDate(filters.endDate)));
    }

    constraints.push(orderBy('createdAt', 'desc'));

    const q = query(collection(db, 'accountingEntries'), ...constraints);
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => convertTimestamps<AccountingEntry>(d.data(), d.id));
  } catch (error) {
    console.error('Error fetching accounting entries:', error);
    return [];
  }
}

export async function addAccountingEntry(
  data: Omit<AccountingEntry, 'id' | 'createdAt'>
): Promise<string> {
  const docData: Record<string, unknown> = {
    ...data,
    createdAt: serverTimestamp(),
  };
  if (data.dueDate) {
    docData.dueDate = Timestamp.fromDate(
      data.dueDate instanceof Date ? data.dueDate : new Date(data.dueDate)
    );
  }
  if (data.paidDate) {
    docData.paidDate = Timestamp.fromDate(
      data.paidDate instanceof Date ? data.paidDate : new Date(data.paidDate)
    );
  }
  const docRef = await addDoc(collection(db, 'accountingEntries'), docData);
  return docRef.id;
}

export async function updateAccountingEntry(
  id: string,
  data: Partial<Omit<AccountingEntry, 'id' | 'createdAt'>>
): Promise<void> {
  const docRef = doc(db, 'accountingEntries', id);
  const updateData: Record<string, unknown> = { ...data };
  if (data.dueDate) {
    updateData.dueDate = Timestamp.fromDate(
      data.dueDate instanceof Date ? data.dueDate : new Date(data.dueDate)
    );
  }
  if (data.paidDate) {
    updateData.paidDate = Timestamp.fromDate(
      data.paidDate instanceof Date ? data.paidDate : new Date(data.paidDate)
    );
  }
  await updateDoc(docRef, updateData);
}

export async function getFinancialSummary(
  startDate: Date,
  endDate: Date
): Promise<FinancialSummary> {
  const entries = await getAccountingEntries({ startDate, endDate });

  let totalRevenue = 0;
  let totalExpenses = 0;
  let totalInvoiced = 0;
  let totalPaid = 0;
  let totalPending = 0;
  let totalOverdue = 0;

  for (const entry of entries) {
    switch (entry.type) {
      case 'revenue':
        totalRevenue += entry.amount;
        break;
      case 'expense':
        totalExpenses += entry.amount;
        break;
      case 'invoice':
        totalInvoiced += entry.amount;
        break;
    }
    switch (entry.paymentStatus) {
      case 'paid':
        totalPaid += entry.amount;
        break;
      case 'pending':
        totalPending += entry.amount;
        break;
      case 'overdue':
        totalOverdue += entry.amount;
        break;
    }
  }

  return {
    totalRevenue,
    totalExpenses,
    totalInvoiced,
    totalPaid,
    totalPending,
    totalOverdue,
    netIncome: totalRevenue - totalExpenses,
    entries,
  };
}

// ============================================================
// Invoices
// ============================================================

export async function generateInvoiceNumber(): Promise<string> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

  const nextNum = await runTransaction(db, async (transaction) => {
    const counterRef = doc(db, 'counters', 'invoices');
    const snap = await transaction.get(counterRef);
    const data = snap.exists() ? snap.data() : {};
    const current = (data[yearMonth] as number) || 0;
    const next = current + 1;
    transaction.set(counterRef, { [yearMonth]: next }, { merge: true });
    return next;
  });

  return `INV-${yearMonth}-${String(nextNum).padStart(5, '0')}`;
}

export async function getInvoices(filters?: InvoiceFilters): Promise<Invoice[]> {
  if (!isFirestoreConfigured()) return [];
  try {
    // Fetch all and filter client-side to avoid composite index requirements
    const q = query(collection(db, 'invoices'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    let results = snapshot.docs.map((d) => convertTimestamps<Invoice>(d.data(), d.id));
    if (filters?.branchId) results = results.filter((inv) => inv.branchId === filters.branchId);
    if (filters?.status) results = results.filter((inv) => inv.status === filters.status);
    if (filters?.startDate) results = results.filter((inv) => inv.createdAt >= filters.startDate!);
    if (filters?.endDate) results = results.filter((inv) => inv.createdAt <= filters.endDate!);
    return results;
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return [];
  }
}

export async function getInvoiceById(id: string): Promise<Invoice | null> {
  if (!isFirestoreConfigured()) return null;
  try {
    const docRef = doc(db, 'invoices', id);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) return null;
    return convertTimestamps<Invoice>(snapshot.data(), snapshot.id);
  } catch (error) {
    console.error('Error fetching invoice:', error);
    return null;
  }
}

// Recursively strip `undefined` values — Firestore rejects them anywhere in the doc.
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => stripUndefined(v)) as unknown as T;
  }
  if (value && typeof value === 'object' && !(value instanceof Date) && !(value instanceof Timestamp)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) out[k] = stripUndefined(v);
    }
    return out as unknown as T;
  }
  return value;
}

export async function addInvoice(
  data: Omit<Invoice, 'id' | 'invoiceNumber' | 'amountPaid' | 'amountDue' | 'status' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const invoiceNumber = await generateInvoiceNumber();
  const cleanData = stripUndefined(data);
  const docRef = await addDoc(collection(db, 'invoices'), {
    ...cleanData,
    invoiceNumber,
    amountPaid: 0,
    amountDue: data.total,
    status: 'unpaid',
    dueDate: Timestamp.fromDate(data.dueDate instanceof Date ? data.dueDate : new Date(data.dueDate)),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Link orders to this invoice
  for (const orderId of data.orderIds) {
    const orderRef = doc(db, 'orders', orderId);
    await updateDoc(orderRef, {
      invoiceId: docRef.id,
      invoiceNumber,
      paymentStatus: 'unpaid',
      updatedAt: serverTimestamp(),
    });
  }

  return docRef.id;
}

export async function voidInvoice(id: string): Promise<void> {
  const invoiceRef = doc(db, 'invoices', id);
  const snap = await getDoc(invoiceRef);
  if (!snap.exists()) return;
  const invoice = snap.data();

  await updateDoc(invoiceRef, {
    status: 'void',
    updatedAt: serverTimestamp(),
  });

  // Unlink orders
  const orderIds = (invoice.orderIds as string[]) || [];
  for (const orderId of orderIds) {
    const orderRef = doc(db, 'orders', orderId);
    await updateDoc(orderRef, {
      invoiceId: null,
      invoiceNumber: null,
      paymentStatus: 'uninvoiced',
      updatedAt: serverTimestamp(),
    });
  }
}

export async function getUninvoicedOrdersByBranch(branchId: string, branchNames?: string[]): Promise<Order[]> {
  if (!isFirestoreConfigured()) return [];
  try {
    // Load ALL uninvoiced orders, filter client-side by branchId OR branchName
    // (more robust against branchId mismatches from legacy / different seed data)
    const snapshot = await getDocs(collection(db, 'orders'));
    const all = snapshot.docs.map((d) => convertTimestamps<Order>(d.data(), d.id));
    const nameSet = new Set((branchNames ?? []).filter(Boolean));
    return all
      .filter((o) => o.status !== 'cancelled' && !o.invoiceId)
      .filter((o) => o.branchId === branchId || (o.branchName && nameSet.has(o.branchName)))
      .sort((a, b) => {
        const aDate = typeof a.createdAt === 'string' ? a.createdAt : (a.createdAt as unknown as Date).toISOString();
        const bDate = typeof b.createdAt === 'string' ? b.createdAt : (b.createdAt as unknown as Date).toISOString();
        return bDate.localeCompare(aDate);
      });
  } catch (error) {
    console.error('Error fetching uninvoiced orders:', error);
    return [];
  }
}

// ============================================================
// Payment Records
// ============================================================

export async function getPaymentsByInvoice(invoiceId: string): Promise<PaymentRecord[]> {
  if (!isFirestoreConfigured()) return [];
  try {
    const q = query(
      collection(db, 'paymentRecords'),
      where('invoiceId', '==', invoiceId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => convertTimestamps<PaymentRecord>(d.data(), d.id));
  } catch (error) {
    console.error('Error fetching payments:', error);
    return [];
  }
}

export async function addPaymentRecord(
  data: Omit<PaymentRecord, 'id' | 'createdAt'>
): Promise<string> {
  return runTransaction(db, async (transaction) => {
    // Read invoice
    const invoiceRef = doc(db, 'invoices', data.invoiceId);
    const invoiceSnap = await transaction.get(invoiceRef);
    if (!invoiceSnap.exists()) throw new Error('Invoice not found');
    const invoice = invoiceSnap.data();

    const newAmountPaid = ((invoice.amountPaid as number) || 0) + data.amount;
    const total = invoice.total as number;
    const newAmountDue = total - newAmountPaid;
    const newStatus: InvoiceStatus = newAmountPaid >= total ? 'paid' : 'partial';

    // Create payment record — strip undefined values
    const cleanData: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) cleanData[k] = v;
    }
    const paymentRef = doc(collection(db, 'paymentRecords'));
    transaction.set(paymentRef, {
      ...cleanData,
      paymentDate: Timestamp.fromDate(data.paymentDate instanceof Date ? data.paymentDate : new Date(data.paymentDate)),
      createdAt: serverTimestamp(),
    });

    // Update invoice
    transaction.update(invoiceRef, {
      amountPaid: newAmountPaid,
      amountDue: Math.max(0, newAmountDue),
      status: newStatus,
      updatedAt: serverTimestamp(),
    });

    // Update linked orders' payment status
    const orderIds = (invoice.orderIds as string[]) || [];
    for (const orderId of orderIds) {
      transaction.update(doc(db, 'orders', orderId), {
        paymentStatus: newStatus,
        updatedAt: serverTimestamp(),
      });
    }

    return paymentRef.id;
  });
}

export async function deletePaymentRecord(paymentId: string): Promise<void> {
  return runTransaction(db, async (transaction) => {
    const paymentRef = doc(db, 'paymentRecords', paymentId);
    const paymentSnap = await transaction.get(paymentRef);
    if (!paymentSnap.exists()) throw new Error('Payment not found');
    const payment = paymentSnap.data();

    const invoiceRef = doc(db, 'invoices', payment.invoiceId as string);
    const invoiceSnap = await transaction.get(invoiceRef);
    if (!invoiceSnap.exists()) throw new Error('Invoice not found');
    const invoice = invoiceSnap.data();

    const newAmountPaid = Math.max(0, ((invoice.amountPaid as number) || 0) - (payment.amount as number));
    const total = invoice.total as number;
    const newStatus: InvoiceStatus = newAmountPaid <= 0 ? 'unpaid' : newAmountPaid >= total ? 'paid' : 'partial';

    transaction.delete(paymentRef);

    transaction.update(invoiceRef, {
      amountPaid: newAmountPaid,
      amountDue: total - newAmountPaid,
      status: newStatus,
      updatedAt: serverTimestamp(),
    });

    const orderIds = (invoice.orderIds as string[]) || [];
    for (const orderId of orderIds) {
      transaction.update(doc(db, 'orders', orderId), {
        paymentStatus: newAmountPaid <= 0 ? 'unpaid' : newStatus,
        updatedAt: serverTimestamp(),
      });
    }
  });
}

// ============================================================
// Settings
// ============================================================

export interface AppSettings {
  companyName: string;
  companyAddress: string;
  taxId: string;
  logoUrl: string;
  orderWindowMode: 'scheduled' | 'always_open' | 'always_closed';
  orderOpenTime: string;   // HH:MM
  orderCloseTime: string;  // HH:MM
  featuredProductIds: string[];
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankBsb: string;
}

const SETTINGS_DOC = doc(db, 'settings', 'main');

export async function loadSettings(): Promise<AppSettings | null> {
  const snap = await getDoc(SETTINGS_DOC);
  if (!snap.exists()) return null;
  return snap.data() as AppSettings;
}

export async function saveSettings(data: Partial<AppSettings>): Promise<void> {
  await setDoc(SETTINGS_DOC, data, { merge: true });
}

export async function uploadLogo(file: File): Promise<string> {
  const storageRef = ref(storage, 'settings/logo');
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

// ============================================================
// Staff (factory/kitchen workers)
// ============================================================
//
// Each staff doc is keyed by the Firebase Auth uid. Admin is expected to
// create the Firebase Auth account in the Firebase Console first, then add
// the corresponding profile here via /admin/staff. This keeps authentication
// (Firebase Auth) and profile data (Firestore) cleanly separated and lets the
// admin page stay fully client-side.

export async function getStaffByUid(uid: string): Promise<Staff | null> {
  if (!isFirestoreConfigured()) return null;
  try {
    const snap = await getDoc(doc(db, 'staff', uid));
    if (!snap.exists()) return null;
    return convertTimestamps<Staff>(snap.data(), snap.id);
  } catch (error) {
    console.error('Error fetching staff by uid:', error);
    return null;
  }
}

export async function getStaffByEmail(email: string): Promise<Staff | null> {
  if (!isFirestoreConfigured()) return null;
  try {
    const q = query(collection(db, 'staff'), where('authEmail', '==', email.toLowerCase()));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const d = snapshot.docs[0];
    return convertTimestamps<Staff>(d.data(), d.id);
  } catch (error) {
    console.error('Error fetching staff by email:', error);
    return null;
  }
}

export async function getAllStaff(): Promise<Staff[]> {
  if (!isFirestoreConfigured()) return [];
  try {
    const snapshot = await getDocs(collection(db, 'staff'));
    return snapshot.docs
      .map((d) => convertTimestamps<Staff>(d.data(), d.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error fetching staff list:', error);
    return [];
  }
}

// Upsert: caller provides the Firebase Auth uid (from Console) as the doc id,
// so the profile lines up with the authenticated user automatically.
export async function upsertStaff(
  uid: string,
  data: Omit<Staff, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<void> {
  const ref = doc(db, 'staff', uid);
  const existing = await getDoc(ref);
  const clean = {
    authEmail: data.authEmail.toLowerCase(),
    name: data.name,
    role: data.role,
    isActive: data.isActive,
  };
  if (existing.exists()) {
    await updateDoc(ref, { ...clean, updatedAt: serverTimestamp() });
  } else {
    await setDoc(ref, { ...clean, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }
}

export async function updateStaff(
  id: string,
  data: Partial<Omit<Staff, 'id' | 'createdAt'>>,
): Promise<void> {
  const clean: Record<string, unknown> = { updatedAt: serverTimestamp() };
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) clean[k] = k === 'authEmail' ? (v as string).toLowerCase() : v;
  }
  await updateDoc(doc(db, 'staff', id), clean);
}

export async function deleteStaff(id: string): Promise<void> {
  await deleteDoc(doc(db, 'staff', id));
}
