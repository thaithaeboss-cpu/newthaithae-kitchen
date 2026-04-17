'use client';

import { useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import {
  products as mockProducts,
  branches as mockBranches,
  orders as mockOrders,
  customers as mockCustomers,
  announcements as mockAnnouncements,
  accountingEntries as mockAccountingEntries,
} from '@/data/mock-data';

type CollectionName = 'products' | 'branches' | 'orders' | 'customers' | 'announcements' | 'accountingEntries';

interface SeedStatus {
  collection: string;
  status: 'idle' | 'seeding' | 'success' | 'error' | 'clearing';
  count: number;
  message: string;
}

const COLLECTIONS: CollectionName[] = [
  'products',
  'branches',
  'orders',
  'customers',
  'announcements',
  'accountingEntries',
];

export default function SeedPage() {
  const [statuses, setStatuses] = useState<Record<string, SeedStatus>>(
    Object.fromEntries(
      COLLECTIONS.map((c) => [
        c,
        { collection: c, status: 'idle' as const, count: 0, message: '' },
      ])
    )
  );
  const [globalMessage, setGlobalMessage] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isRunningAll, setIsRunningAll] = useState(false);

  function updateStatus(col: string, partial: Partial<SeedStatus>) {
    setStatuses((prev) => ({
      ...prev,
      [col]: { ...prev[col], ...partial },
    }));
  }

  // ----- Seed Products -----
  async function seedProducts() {
    updateStatus('products', { status: 'seeding', message: 'Seeding products...', count: 0 });
    try {
      let count = 0;
      for (const p of mockProducts) {
        const { id, ...data } = p;
        await addDoc(collection(db, 'products'), {
          ...data,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
        count++;
      }
      updateStatus('products', { status: 'success', count, message: `Added ${count} products` });
    } catch (error) {
      updateStatus('products', {
        status: 'error',
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  // ----- Seed Branches -----
  async function seedBranches() {
    updateStatus('branches', { status: 'seeding', message: 'Seeding branches...', count: 0 });
    try {
      let count = 0;
      for (const b of mockBranches) {
        const { id, ...data } = b;
        await addDoc(collection(db, 'branches'), {
          ...data,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
        count++;
      }
      updateStatus('branches', { status: 'success', count, message: `Added ${count} branches` });
    } catch (error) {
      updateStatus('branches', {
        status: 'error',
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  // ----- Seed Orders -----
  async function seedOrders() {
    updateStatus('orders', { status: 'seeding', message: 'Seeding orders...', count: 0 });
    try {
      let count = 0;
      for (const o of mockOrders) {
        const { id, ...data } = o;
        await addDoc(collection(db, 'orders'), {
          ...data,
          createdAt: data.createdAt ? Timestamp.fromDate(new Date(data.createdAt)) : Timestamp.now(),
          updatedAt: data.updatedAt ? Timestamp.fromDate(new Date(data.updatedAt)) : Timestamp.now(),
          estimatedDelivery: data.estimatedDelivery || null,
          deliveredAt: data.deliveredAt || null,
        });
        count++;
      }
      updateStatus('orders', { status: 'success', count, message: `Added ${count} orders` });
    } catch (error) {
      updateStatus('orders', {
        status: 'error',
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  // ----- Seed Customers -----
  async function seedCustomers() {
    updateStatus('customers', { status: 'seeding', message: 'Seeding customers...', count: 0 });
    try {
      let count = 0;
      for (const c of mockCustomers) {
        const { id, ...data } = c;
        await addDoc(collection(db, 'customers'), {
          companyName: data.companyName,
          contactPerson: data.contactPerson,
          phone: data.phone,
          email: data.email,
          address: data.address,
          taxId: data.taxId,
          creditTerms: data.creditTermDays,
          creditLimit: data.creditLimit,
          outstandingBalance: data.outstandingBalance,
          isActive: data.isActive,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
        count++;
      }
      updateStatus('customers', { status: 'success', count, message: `Added ${count} customers` });
    } catch (error) {
      updateStatus('customers', {
        status: 'error',
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  // ----- Seed Announcements -----
  async function seedAnnouncements() {
    updateStatus('announcements', { status: 'seeding', message: 'Seeding announcements...', count: 0 });
    try {
      let count = 0;
      for (const a of mockAnnouncements) {
        const { id, ...data } = a;
        await addDoc(collection(db, 'announcements'), {
          category: data.category,
          title: data.title,
          content: data.body,
          priority: data.priority,
          isActive: true,
          expiresAt: data.expiresAt ? Timestamp.fromDate(new Date(data.expiresAt)) : null,
          createdAt: data.createdAt ? Timestamp.fromDate(new Date(data.createdAt)) : Timestamp.now(),
        });
        count++;
      }
      updateStatus('announcements', { status: 'success', count, message: `Added ${count} announcements` });
    } catch (error) {
      updateStatus('announcements', {
        status: 'error',
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  // ----- Seed Accounting Entries -----
  async function seedAccountingEntries() {
    updateStatus('accountingEntries', { status: 'seeding', message: 'Seeding accounting entries...', count: 0 });
    try {
      let count = 0;
      for (const e of mockAccountingEntries) {
        const { id, ...data } = e;
        await addDoc(collection(db, 'accountingEntries'), {
          type: data.type,
          description: data.description,
          amount: data.amount,
          reference: data.reference || null,
          paymentStatus: data.status,
          dueDate: data.date ? Timestamp.fromDate(new Date(data.date)) : null,
          createdAt: data.date ? Timestamp.fromDate(new Date(data.date)) : Timestamp.now(),
        });
        count++;
      }
      updateStatus('accountingEntries', { status: 'success', count, message: `Added ${count} accounting entries` });
    } catch (error) {
      updateStatus('accountingEntries', {
        status: 'error',
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  // ----- Seed All -----
  async function seedAll() {
    setIsRunningAll(true);
    setGlobalMessage('Seeding all collections...');
    try {
      await seedProducts();
      await seedBranches();
      await seedOrders();
      await seedCustomers();
      await seedAnnouncements();
      await seedAccountingEntries();
      setGlobalMessage('All collections seeded successfully!');
    } catch (error) {
      setGlobalMessage(`Error during seed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsRunningAll(false);
    }
  }

  // ----- Clear All Data -----
  async function clearCollection(colName: string) {
    const snapshot = await getDocs(collection(db, colName));
    const deletePromises = snapshot.docs.map((d) => deleteDoc(doc(db, colName, d.id)));
    await Promise.all(deletePromises);
    return snapshot.size;
  }

  async function clearAllData() {
    setShowClearConfirm(false);
    setGlobalMessage('Clearing all data...');
    try {
      for (const colName of COLLECTIONS) {
        updateStatus(colName, { status: 'clearing', message: 'Clearing...' });
        const deleted = await clearCollection(colName);
        updateStatus(colName, { status: 'idle', count: 0, message: `Cleared ${deleted} documents` });
      }
      // Also clear stockAdjustments
      const saSnapshot = await getDocs(collection(db, 'stockAdjustments'));
      const saDeletes = saSnapshot.docs.map((d) => deleteDoc(doc(db, 'stockAdjustments', d.id)));
      await Promise.all(saDeletes);

      setGlobalMessage(`All data cleared successfully! (including ${saSnapshot.size} stock adjustments)`);
    } catch (error) {
      setGlobalMessage(`Error clearing data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  const seedFns: Record<CollectionName, () => Promise<void>> = {
    products: seedProducts,
    branches: seedBranches,
    orders: seedOrders,
    customers: seedCustomers,
    announcements: seedAnnouncements,
    accountingEntries: seedAccountingEntries,
  };

  const collectionLabels: Record<CollectionName, { label: string; icon: string; mockCount: number }> = {
    products: { label: 'Products', icon: '📦', mockCount: mockProducts.length },
    branches: { label: 'Branches', icon: '🏢', mockCount: mockBranches.length },
    orders: { label: 'Orders', icon: '📋', mockCount: mockOrders.length },
    customers: { label: 'Customers', icon: '👥', mockCount: mockCustomers.length },
    announcements: { label: 'Announcements', icon: '📢', mockCount: mockAnnouncements.length },
    accountingEntries: { label: 'Accounting Entries', icon: '💰', mockCount: mockAccountingEntries.length },
  };

  function statusBadge(s: SeedStatus) {
    const map: Record<string, string> = {
      idle: 'bg-gray-700 text-gray-300',
      seeding: 'bg-yellow-800 text-yellow-200 animate-pulse',
      success: 'bg-green-800 text-green-200',
      error: 'bg-red-800 text-red-200',
      clearing: 'bg-orange-800 text-orange-200 animate-pulse',
    };
    const label: Record<string, string> = {
      idle: 'Idle',
      seeding: 'Seeding...',
      success: 'Done',
      error: 'Error',
      clearing: 'Clearing...',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[s.status]}`}>
        {label[s.status]}
      </span>
    );
  }

  const isBusy = isRunningAll || Object.values(statuses).some((s) => s.status === 'seeding' || s.status === 'clearing');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Seed Database</h1>
        <p className="text-gray-400 mt-1">
          Populate Firestore with initial mock data for development and testing.
        </p>
      </div>

      {/* Warning Banner */}
      <div className="bg-yellow-900/40 border border-yellow-700 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-yellow-400 text-xl mt-0.5">&#9888;</span>
          <div>
            <h3 className="text-yellow-300 font-semibold">Warning</h3>
            <p className="text-yellow-200/80 text-sm mt-1">
              This page writes data directly to your Firestore database. Seeding will <strong>add</strong> documents
              (it does not check for duplicates). Use &quot;Clear All Data&quot; first if you want a fresh start.
              This tool is intended for development use only.
            </p>
          </div>
        </div>
      </div>

      {/* Global Message */}
      {globalMessage && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 text-sm text-gray-200">
          {globalMessage}
        </div>
      )}

      {/* Seed All + Clear All */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={seedAll}
          disabled={isBusy}
          className="px-5 py-2.5 bg-green-700 hover:bg-green-600 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg font-medium transition-colors"
        >
          {isRunningAll ? 'Seeding All...' : 'Seed All Collections'}
        </button>
        <button
          onClick={() => setShowClearConfirm(true)}
          disabled={isBusy}
          className="px-5 py-2.5 bg-red-700 hover:bg-red-600 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg font-medium transition-colors"
        >
          Clear All Data
        </button>
      </div>

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <div className="bg-red-900/30 border border-red-700 rounded-xl p-4">
          <p className="text-red-200 font-medium mb-3">
            Are you sure you want to delete ALL documents from ALL collections? This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={clearAllData}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-colors"
            >
              Yes, Delete Everything
            </button>
            <button
              onClick={() => setShowClearConfirm(false)}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Individual Collection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {COLLECTIONS.map((colName) => {
          const info = collectionLabels[colName];
          const s = statuses[colName];
          return (
            <div
              key={colName}
              className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{info.icon}</span>
                  <h3 className="text-white font-semibold">{info.label}</h3>
                </div>
                {statusBadge(s)}
              </div>

              <p className="text-gray-400 text-sm">
                Mock data: <span className="text-gray-200 font-medium">{info.mockCount}</span> documents
              </p>

              {s.message && (
                <p
                  className={`text-sm ${
                    s.status === 'error' ? 'text-red-400' : s.status === 'success' ? 'text-green-400' : 'text-gray-400'
                  }`}
                >
                  {s.message}
                </p>
              )}

              <button
                onClick={() => seedFns[colName]()}
                disabled={isBusy}
                className="mt-auto px-4 py-2 bg-green-700 hover:bg-green-600 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Seed {info.label}
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <p className="text-gray-500 text-xs text-center pt-4">
        Firestore collection names: products, branches, orders, customers, announcements, accountingEntries, stockAdjustments
      </p>
    </div>
  );
}
