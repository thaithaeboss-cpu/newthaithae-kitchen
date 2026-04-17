'use client';

import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { isOwnerEmail } from '@/lib/owner';

export default function BranchLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Owner emails belong on the admin side — don't bounce them through
      // the branch layout just to show a "not linked" error.
      if (isOwnerEmail(email)) {
        window.location.href = '/admin/';
        return;
      }
      window.location.href = '/';
      // trailing slash not needed for root
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      } else if (code === 'auth/too-many-requests') {
        setError('ลองเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่');
      } else {
        setError('เข้าสู่ระบบไม่ได้: ' + code);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-on-primary text-[32px]">storefront</span>
          </div>
          <h1 className="text-2xl font-headline font-bold text-on-surface">เข้าสู่ระบบสาขา</h1>
          <p className="text-sm text-on-surface-variant mt-1">Thaithae Central Kitchen</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">อีเมล</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-3 py-2.5 rounded-lg border border-outline-variant/50 bg-surface-container text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="branch@thaithae.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">รหัสผ่าน</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full px-3 py-2.5 rounded-lg border border-outline-variant/50 bg-surface-container text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-primary text-on-primary rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>

          <p className="text-xs text-on-surface-variant text-center mt-4">
            ลืมรหัสผ่าน? ติดต่อผู้ดูแลระบบ
          </p>
        </form>
      </div>
    </div>
  );
}
