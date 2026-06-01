// ============================================================
// Central Kitchen Ordering App - Mock Data
// ============================================================

// ======================== INTERFACES ========================

export interface Product {
  id: string;
  sku: string;
  nameTh: string;
  nameEn: string;
  category: ProductCategory;
  price: number;        // THB — default / internal-customer price
  priceExternal?: number;  // optional override for external customers
  unit: string;
  unitTh: string;
  stock: number;
  minStock: number;
  image: string;
  description?: string;
  isActive: boolean;
  isPublic?: boolean;
  visibleToBranches?: string[];   // empty / undefined = all branches
}

export type ProductCategory =
  | 'glass'
  | 'meat'
  | 'curry'
  | 'sauce'
  | 'dessert'
  | 'filling';

export interface ProductCategoryInfo {
  key: ProductCategory;
  nameTh: string;
  nameEn: string;
  icon: string;
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
  isActive: boolean;
  openTime: string;
  closeTime: string;
  lat?: number;
  lng?: number;
}

export type OrderStatus =
  | 'new'
  | 'processing'
  | 'preparing'
  | 'dispatched'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
}

export interface Order {
  id: string;
  orderId: string;         // CK-XXXXX format
  branchId: string;
  branchName: string;
  customerId?: string;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  vat: number;             // 7% VAT
  total: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
  estimatedDelivery?: string;
  deliveredAt?: string;
}

export interface Customer {
  id: string;
  companyName: string;
  companyNameTh: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  taxId: string;
  creditTermDays: number;
  creditLimit: number;
  outstandingBalance: number;
  isActive: boolean;
}

export type AnnouncementCategory =
  | 'new_policy'
  | 'kitchen_notice'
  | 'system_update'
  | 'promotion';

export interface Announcement {
  id: string;
  title: string;
  body: string;
  category: AnnouncementCategory;
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  expiresAt?: string;
  author: string;
  isRead: boolean;
}

export type StockAlertLevel = 'critical' | 'low' | 'normal';

export interface InventoryAlert {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  currentStock: number;
  minStock: number;
  unit: string;
  level: StockAlertLevel;
  lastRestocked?: string;
}

export interface AccountingEntry {
  id: string;
  type: 'revenue' | 'expense' | 'invoice';
  description: string;
  amount: number;
  date: string;
  category: string;
  reference?: string;
  status: 'paid' | 'pending' | 'overdue';
}

export interface FinancialSummary {
  month: string;           // YYYY-MM
  monthLabel: string;
  revenue: number;
  expenses: number;
  profit: number;
  orderCount: number;
  averageOrderValue: number;
}

// ==================== CATEGORY INFO ====================

export const productCategories: ProductCategoryInfo[] = [
  { key: 'glass', nameTh: 'แก้ว/จาน', nameEn: 'Glass & Plates', icon: '/icons/glass.svg' },
  { key: 'meat', nameTh: 'เนื้อสัตว์', nameEn: 'Meat', icon: '/icons/meat.svg' },
  { key: 'curry', nameTh: 'น้ำแกง', nameEn: 'Curry', icon: '/icons/curry.svg' },
  { key: 'sauce', nameTh: 'น้ำจิ้ม/ผง', nameEn: 'Sauce & Powder', icon: '/icons/sauce.svg' },
  { key: 'dessert', nameTh: 'ของหวาน', nameEn: 'Dessert', icon: '/icons/dessert.svg' },
  { key: 'filling', nameTh: 'ไส้อาหาร', nameEn: 'Filling', icon: '/icons/filling.svg' },
];

// ======================= PRODUCTS =======================

export const products: Product[] = [
  // --- Glass ---
  { id: 'prod-001', sku: 'GL-001', nameTh: '237 ml Tumbler glass water cup', nameEn: '237 ml Tumbler glass water cup', category: 'glass', price: 2, unit: 'Each', unitTh: 'ชิ้น', stock: 100, minStock: 20, image: '', isActive: true },
  { id: 'prod-002', sku: 'GL-002', nameTh: '296ml glass milk tea', nameEn: '296ml glass milk tea', category: 'glass', price: 4, unit: 'Each', unitTh: 'ชิ้น', stock: 100, minStock: 20, image: '', isActive: true },
  { id: 'prod-003', sku: 'GL-003', nameTh: 'Stacka plate 260mm diameter', nameEn: 'Stacka plate 260mm diameter', category: 'glass', price: 16, unit: 'Each', unitTh: 'ชิ้น', stock: 100, minStock: 20, image: '', isActive: true },

  // --- Meat ---
  { id: 'prod-004', sku: 'MT-001', nameTh: 'BBQ Beef', nameEn: 'BBQ Beef', category: 'meat', price: 30, unit: 'CTN', unitTh: 'ลัง', stock: 50, minStock: 10, image: '', isActive: true },
  { id: 'prod-005', sku: 'MT-002', nameTh: 'BBQ Chicken', nameEn: 'BBQ Chicken', category: 'meat', price: 25, unit: 'CTN', unitTh: 'ลัง', stock: 50, minStock: 10, image: '', isActive: true },
  { id: 'prod-006', sku: 'MT-003', nameTh: 'Satay Chicken', nameEn: 'Satay Chicken', category: 'meat', price: 135, unit: 'Bag', unitTh: 'ถุง', stock: 50, minStock: 10, image: '', isActive: true },
  { id: 'prod-007', sku: 'MT-004', nameTh: 'Honey pork', nameEn: 'Honey pork', category: 'meat', price: 157, unit: 'Bag', unitTh: 'ถุง', stock: 50, minStock: 10, image: '', isActive: true },
  { id: 'prod-008', sku: 'MT-005', nameTh: 'Pork sliced', nameEn: 'Pork sliced', category: 'meat', price: 5, unit: 'Kg', unitTh: 'กก.', stock: 50, minStock: 10, image: '', isActive: true },
  { id: 'prod-009', sku: 'MT-006', nameTh: 'BBQ Duck', nameEn: 'BBQ Duck', category: 'meat', price: 26, unit: 'Each', unitTh: 'ชิ้น', stock: 50, minStock: 10, image: '', isActive: true },

  // --- Curry ---
  { id: 'prod-010', sku: 'CU-001', nameTh: 'Massamun Beef', nameEn: 'Massamun Beef', category: 'curry', price: 190, unit: 'CTN', unitTh: 'ลัง', stock: 50, minStock: 10, image: '', isActive: true },
  { id: 'prod-011', sku: 'CU-002', nameTh: 'Massamun Chicken', nameEn: 'Massamun Chicken', category: 'curry', price: 13, unit: 'CTN', unitTh: 'ลัง', stock: 50, minStock: 10, image: '', isActive: true },

  // --- Sauce ---
  { id: 'prod-012', sku: 'SC-001', nameTh: 'Peanut sauce', nameEn: 'Peanut sauce', category: 'sauce', price: 120, unit: 'CTN', unitTh: 'ลัง', stock: 50, minStock: 10, image: '', isActive: true },
  { id: 'prod-013', sku: 'SC-002', nameTh: 'Oyster Sauce', nameEn: 'Oyster Sauce', category: 'sauce', price: 180, unit: 'CTN', unitTh: 'ลัง', stock: 50, minStock: 10, image: '', isActive: true },
  { id: 'prod-014', sku: 'SC-003', nameTh: 'Oyster vegan', nameEn: 'Oyster vegan', category: 'sauce', price: 80, unit: 'CTN', unitTh: 'ลัง', stock: 50, minStock: 10, image: '', isActive: true },
  { id: 'prod-015', sku: 'SC-004', nameTh: 'Oyster Gluten-free', nameEn: 'Oyster Gluten-free', category: 'sauce', price: 60, unit: 'Kg', unitTh: 'กก.', stock: 50, minStock: 10, image: '', isActive: true },
  { id: 'prod-016', sku: 'SC-005', nameTh: 'Padthai sauce', nameEn: 'Padthai sauce', category: 'sauce', price: 60, unit: 'CTN', unitTh: 'ลัง', stock: 50, minStock: 10, image: '', isActive: true },
  { id: 'prod-017', sku: 'SC-006', nameTh: 'Cashew nut sauce', nameEn: 'Cashew nut sauce', category: 'sauce', price: 150, unit: 'CTN', unitTh: 'ลัง', stock: 50, minStock: 10, image: '', isActive: true },
  { id: 'prod-018', sku: 'SC-007', nameTh: 'Duck plum sauce', nameEn: 'Duck plum sauce', category: 'sauce', price: 80, unit: 'Bag', unitTh: 'ถุง', stock: 50, minStock: 10, image: '', isActive: true },
  { id: 'prod-019', sku: 'SC-008', nameTh: 'Prik Khing sauce', nameEn: 'Prik Khing sauce', category: 'sauce', price: 60, unit: 'Kg', unitTh: 'กก.', stock: 50, minStock: 10, image: '', isActive: true },
  { id: 'prod-020', sku: 'SC-009', nameTh: 'Dressing Number 2', nameEn: 'Dressing Number 2', category: 'sauce', price: 30, unit: 'CTN', unitTh: 'ลัง', stock: 50, minStock: 10, image: '', isActive: true },
  { id: 'prod-021', sku: 'SC-010', nameTh: 'Dressing Number 3', nameEn: 'Dressing Number 3', category: 'sauce', price: 30, unit: 'CTN', unitTh: 'ลัง', stock: 50, minStock: 10, image: '', isActive: true },
  { id: 'prod-022', sku: 'SC-011', nameTh: 'Dressing Papaya', nameEn: 'Dressing Papaya', category: 'sauce', price: 20, unit: 'CTN', unitTh: 'ลัง', stock: 50, minStock: 10, image: '', isActive: true },
  { id: 'prod-023', sku: 'SC-012', nameTh: 'Dressing Fish', nameEn: 'Dressing Fish', category: 'sauce', price: 20, unit: 'CTN', unitTh: 'ลัง', stock: 50, minStock: 10, image: '', isActive: true },
  { id: 'prod-024', sku: 'SC-013', nameTh: 'Flour', nameEn: 'Flour', category: 'sauce', price: 50, unit: 'Bag', unitTh: 'ถุง', stock: 50, minStock: 10, image: '', isActive: true },
  { id: 'prod-025', sku: 'SC-014', nameTh: 'Boat noodle powder', nameEn: 'Boat noodle powder', category: 'sauce', price: 5, unit: 'Bag', unitTh: 'ถุง', stock: 50, minStock: 10, image: '', isActive: true },

  // --- Dessert ---
  { id: 'prod-026', sku: 'DS-001', nameTh: 'Tapioca', nameEn: 'Tapioca', category: 'dessert', price: 3.5, unit: 'Each', unitTh: 'ชิ้น', stock: 50, minStock: 10, image: '', isActive: true },
  { id: 'prod-027', sku: 'DS-002', nameTh: 'Black sticky rice', nameEn: 'Black sticky rice', category: 'dessert', price: 3.5, unit: 'Box', unitTh: 'กล่อง', stock: 50, minStock: 10, image: '', isActive: true },
  { id: 'prod-028', sku: 'DS-003', nameTh: 'Taro custard', nameEn: 'Taro custard', category: 'dessert', price: 4, unit: 'Box', unitTh: 'กล่อง', stock: 50, minStock: 10, image: '', isActive: true },
  { id: 'prod-029', sku: 'DS-004', nameTh: 'Sticky rice', nameEn: 'Sticky rice', category: 'dessert', price: 3.5, unit: 'Box', unitTh: 'กล่อง', stock: 50, minStock: 10, image: '', isActive: true },

  // --- Filling ---
  { id: 'prod-030', sku: 'FL-001', nameTh: 'Spring Roll', nameEn: 'Spring Roll', category: 'filling', price: 80, unit: 'Kg', unitTh: 'กก.', stock: 50, minStock: 10, image: '', isActive: true },
  { id: 'prod-031', sku: 'FL-002', nameTh: 'Curry puff', nameEn: 'Curry puff', category: 'filling', price: 80, unit: 'Bag', unitTh: 'ถุง', stock: 50, minStock: 10, image: '', isActive: true },
  { id: 'prod-032', sku: 'FL-003', nameTh: 'Duck Pancakes', nameEn: 'Duck Pancakes', category: 'filling', price: 3, unit: 'Each', unitTh: 'ชิ้น', stock: 50, minStock: 10, image: '', isActive: true },
];

// ======================= BRANCHES =======================

export const branches: Branch[] = [
  {
    id: 'b1',
    code: 'b1',
    nameTh: 'Thaithae Lidcombe',
    nameEn: 'Thaithae Lidcombe',
    address: 'SHOP 1, 8 UHRIG ROAD, LIDCOMBE, NSW 2141',
    phone: '0435432262',
    email: 'thaithaelidcombe@gmail.com',
    manager: '',
    isActive: true,
    openTime: '08:00',
    closeTime: '14:00',
    lat: -33.8643,
    lng: 151.0433,
  },
  {
    id: 'b2',
    code: 'b2',
    nameTh: 'Thaithae Randwick',
    nameEn: 'Thaithae Randwick',
    address: '120 Belmore Road Randwick NSW 2031',
    phone: '0478278400',
    email: 'thaithaerandwick@gmail.com',
    manager: '',
    isActive: true,
    openTime: '08:00',
    closeTime: '14:00',
    lat: -33.9143,
    lng: 151.2388,
  },
  {
    id: 'b3',
    code: 'b3',
    nameTh: 'Thaithae Mascot',
    nameEn: 'Thaithae Mascot',
    address: 'Shop 4, 256b Coward St, Mascot NSW 2020',
    phone: '0434716559',
    email: 'thaithaewaterloo@gmail.com',
    manager: '',
    isActive: true,
    openTime: '08:00',
    closeTime: '14:00',
    lat: -33.9277,
    lng: 151.1927,
  },
  {
    id: 'b4',
    code: 'b4',
    nameTh: 'Thaithae Pagewood',
    nameEn: 'Thaithae Pagewood',
    address: 'SHOP 21, 11 STUDIO DRIVE, EASTGARDENS NSW 2036',
    phone: '0478419185',
    email: 'thaithaepasgewood@gmail.com',
    manager: '',
    isActive: true,
    openTime: '08:00',
    closeTime: '14:00',
    lat: -33.9417,
    lng: 151.2175,
  },
  {
    id: 'b11',
    code: 'b11',
    nameTh: 'Thaithae Penrith',
    nameEn: 'Thaithae Penrith',
    address: 'Shop R102 (in front of Coles), Westfield Penrith, 569-595 High Street, Penrith NSW 2750',
    phone: '0466064962',
    email: 'thaithaepenrith@gmail.com',
    manager: '',
    isActive: true,
    openTime: '08:00',
    closeTime: '14:00',
    lat: -33.7510,
    lng: 150.6942,
  },
];

// ======================= ORDERS =======================

export const orders: Order[] = [];

// ====================== CUSTOMERS ======================

export const customers: Customer[] = [];

// ==================== ANNOUNCEMENTS ====================

export const announcements: Announcement[] = [];

// ================= ACCOUNTING ENTRIES =================

export const accountingEntries: AccountingEntry[] = [];

// ================ FINANCIAL SUMMARY ================

export const financialSummary: FinancialSummary[] = [
  {
    month: '2024-07',
    monthLabel: 'ก.ค. 2567',
    revenue: 685000,
    expenses: 548000,
    profit: 137000,
    orderCount: 142,
    averageOrderValue: 4824,
  },
  {
    month: '2024-08',
    monthLabel: 'ส.ค. 2567',
    revenue: 712000,
    expenses: 562000,
    profit: 150000,
    orderCount: 155,
    averageOrderValue: 4594,
  },
  {
    month: '2024-09',
    monthLabel: 'ก.ย. 2567',
    revenue: 698000,
    expenses: 555000,
    profit: 143000,
    orderCount: 148,
    averageOrderValue: 4716,
  },
  {
    month: '2024-10',
    monthLabel: 'ต.ค. 2567',
    revenue: 745000,
    expenses: 580000,
    profit: 165000,
    orderCount: 160,
    averageOrderValue: 4656,
  },
  {
    month: '2024-11',
    monthLabel: 'พ.ย. 2567',
    revenue: 756900,
    expenses: 661000,
    profit: 95900,
    orderCount: 168,
    averageOrderValue: 4505,
  },
  {
    month: '2024-12',
    monthLabel: 'ธ.ค. 2567',
    revenue: 182500,
    expenses: 125000,
    profit: 57500,
    orderCount: 38,
    averageOrderValue: 4803,
  },
];

// ================ HELPER / LOOKUP MAPS ================

export const orderStatusLabels: Record<OrderStatus, { th: string; en: string; color: string }> = {
  new: { th: 'รายการใหม่', en: 'New', color: '#3B82F6' },
  processing: { th: 'กำลังดำเนินการ', en: 'Processing', color: '#F59E0B' },
  preparing: { th: 'กำลังเตรียมของ', en: 'Preparing', color: '#8B5CF6' },
  dispatched: { th: 'จัดส่งแล้ว', en: 'Dispatched', color: '#6366F1' },
  out_for_delivery: { th: 'กำลังจัดส่ง', en: 'Out for Delivery', color: '#F97316' },
  delivered: { th: 'จัดส่งสำเร็จ', en: 'Delivered', color: '#10B981' },
  cancelled: { th: 'ยกเลิก', en: 'Cancelled', color: '#EF4444' },
};

export const announcementCategoryLabels: Record<AnnouncementCategory, { th: string; en: string }> = {
  new_policy: { th: 'นโยบายใหม่', en: 'New Policy' },
  kitchen_notice: { th: 'ประกาศจากครัว', en: 'Kitchen Notice' },
  system_update: { th: 'อัปเดตระบบ', en: 'System Update' },
  promotion: { th: 'โปรโมชั่น', en: 'Promotion' },
};

export const stockAlertLabels: Record<StockAlertLevel, { th: string; en: string; color: string }> = {
  critical: { th: 'วิกฤต', en: 'Critical', color: '#EF4444' },
  low: { th: 'ใกล้หมด', en: 'Low', color: '#F59E0B' },
  normal: { th: 'ปกติ', en: 'Normal', color: '#10B981' },
};
