// ApiTester.tsx — All issues fixed:
// 1. Cart/Orders/Address/Wishlist: userProfileId (camelCase) + 'eq' operator
// 2. Error field always stringified safely → no blank page crash
// 3. Page.Size: 0 → 500 (backend rejects 0, ge:1)

import { useState } from 'react';
import api from '@/shared/api/axiosInstance';
import { useAuthStore } from '@/features/auth/store/authStore';

function errStr(e: any): string {
  if (!e) return 'Failed';
  const data = e?.response?.data;
  if (data) {
    if (data.detail && typeof data.detail === 'object')
      return data.detail.error_description || data.detail.error || JSON.stringify(data.detail);
    if (typeof data.detail === 'string') return data.detail;
    if (data.message) return data.message;
    return JSON.stringify(data);
  }
  return e?.message || 'Failed';
}

const mk = (f: () => Promise<any>) => f;

const TESTS = [
  { id: 'auth', label: '🔐 Auth — Token valid?',
    fn: mk(() => {
      const base = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api').replace('/api', '');
      return fetch(`${base}/connect/userinfo`, { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } }).then(r => r.json());
    })},
  { id: 'dashboard', label: '🏠 Dashboard',
    fn: mk(() => api.post('/UserDashboard/GetUserDashboard', { userProfileId: useAuthStore.getState().getUserId() }).then(r => r.data))},
  { id: 'categories', label: '📂 Categories',
    fn: mk(() => api.post('/Category/GetCategory', {}).then(r => r.data))},
  { id: 'products', label: '📦 Products (first 5)',
    fn: mk(() => api.get('/ProductVariantDetail/UserProductVariantDetail', { params: { 'page.size': 5, 'filters[0].property': 'State', 'filters[0].comparison': 'in', 'filters[0].value': 'Approved' } }).then(r => r.data))},
  { id: 'cart', label: '🛒 Cart — My items',
    fn: mk(() => { const uid = useAuthStore.getState().getUserId(); return api.get('/Cart', { params: { Filters: JSON.stringify([{ property: 'userProfileId', comparison: 'eq', value: uid }]) } }).then(r => r.data); })},
  { id: 'orders', label: '📋 Orders — My orders',
    fn: mk(() => { const uid = useAuthStore.getState().getUserId(); return api.get('/Orders', { params: { Filters: JSON.stringify([{ property: 'userProfileId', comparison: 'eq', value: uid }]), 'Page.Size': 5 } }).then(r => r.data); })},
  { id: 'address', label: '📍 My addresses',
    fn: mk(() => { const uid = useAuthStore.getState().getUserId(); return api.get('/Address', { params: { Filters: JSON.stringify([{ property: 'userProfileId', comparison: 'eq', value: uid }]) } }).then(r => r.data); })},
  { id: 'wishlist', label: '❤️ My wishlist',
    fn: mk(() => { const uid = useAuthStore.getState().getUserId(); return api.get('/Wishlist', { params: { Filters: JSON.stringify([{ property: 'userProfileId', comparison: 'eq', value: uid }]) } }).then(r => r.data); })},
  { id: 'brands',        label: '🏷️ Brands',         fn: mk(() => api.get('/Brand',        { params: { 'Page.Size': 500 } }).then(r => r.data))},
  { id: 'coupons',       label: '🎟️ Coupons',        fn: mk(() => api.get('/Coupons').then(r => r.data))},
  { id: 'delivery',      label: '🚚 Delivery charges',fn: mk(() => api.get('/DeliveryCharge').then(r => r.data))},
  { id: 'blogs',         label: '📰 Blogs',           fn: mk(() => api.get('/Blog').then(r => r.data))},
  { id: 'reviews',       label: '⭐ Reviews',          fn: mk(() => api.get('/UserReview', { params: { 'Page.Size': 5, 'Order.Property': 'CreatedDate', 'Order.Ascending': false } }).then(r => r.data))},
  { id: 'notifications', label: '🔔 Notifications',   fn: mk(() => api.get('/Notification', { params: { 'Page.Size': 5 } }).then(r => r.data))},
  { id: 'sizes',         label: '📏 Sizes',            fn: mk(() => api.get('/Size',    { params: { 'Page.Size': 500 } }).then(r => r.data))},
  { id: 'cupsizes',      label: '📐 Cup Sizes',        fn: mk(() => api.get('/CupSize', { params: { 'Page.Size': 500 } }).then(r => r.data))},
  { id: 'admin-products',label: '🛍️ Admin Products',  fn: mk(() => api.get('/Products',           { params: { 'Page.Size': 3 } }).then(r => r.data))},
  { id: 'admin-orders',  label: '📋 Admin Orders',     fn: mk(() => api.get('/Orders/AdminList',   { params: { 'Page.Size': 3 } }).then(r => r.data))},
];

type Status = 'idle' | 'loading' | 'ok' | 'error';
type Result = { status: Status; data?: any; error?: string; time?: number };

export default function ApiTester() {
  const [results,    setResults]    = useState<Record<string, Result>>({});
  const [runningAll, setRunningAll] = useState(false);

  const runTest = async (test: typeof TESTS[0]) => {
    setResults(r => ({ ...r, [test.id]: { status: 'loading' } }));
    const start = Date.now();
    try {
      const data = await test.fn();
      setResults(r => ({ ...r, [test.id]: { status: 'ok', data, time: Date.now() - start } }));
    } catch (e: any) {
      setResults(r => ({ ...r, [test.id]: { status: 'error', error: errStr(e), time: Date.now() - start } }));
    }
  };

  const runAll = async () => {
    setRunningAll(true);
    for (const test of TESTS) await runTest(test);
    setRunningAll(false);
  };

  const passed = Object.values(results).filter(r => r.status === 'ok').length;
  const failed = Object.values(results).filter(r => r.status === 'error').length;
  const total  = Object.values(results).filter(r => r.status !== 'idle').length;

  return (
    <div>
      <div className="s-adminblog-19fd7a">
        <h2 className="s-apitester-3b2452">🧪 API Backend Tester</h2>
        <p className="s-admindashboa-f39764">Verify all FastAPI endpoints. Must be logged in for protected routes.</p>
      </div>

      {total > 0 && (
        <div className="s-apitester-7d395e">
          {[
            { label: 'Passed', count: passed, color: 'var(--brand)', bg: 'var(--ivory)' },
            { label: 'Failed', count: failed, color: 'var(--brand)', bg: 'var(--ivory)' },
            { label: 'Total',  count: total,  color: 'var(--brand)', bg: 'var(--ivory)' },
          ].map(s => (
            <div key={s.label} className="s-apitester-f2fa4c s-apitester-95edc4">
              <p className="s-apitester-0bde9c s-apitester-30f689">{s.label}</p>
              <h3 className="s-apitester-c335f9 s-apitester-30f689">{s.count}</h3>
            </div>
          ))}
        </div>
      )}

      <button onClick={runAll} disabled={runningAll}
        className="s-apitester-f9d6f5">
        {runningAll ? <><span className="spinner-border spinner-border-sm me-1" />Running…</> : '▶ Run All Tests'}
      </button>

      <div className="s-adminproduct-6597c4">
        {TESTS.map(test => {
          const r = results[test.id] || { status: 'idle' as Status };
          const colors = { idle: 'var(--heirloom)', loading: 'var(--brand)', ok: 'var(--brand)', error: 'var(--brand)' };
          const icons  = { idle: 'bi-circle', loading: 'bi-arrow-repeat', ok: 'bi-check-circle-fill', error: 'bi-x-circle-fill' };

          return (
            <div key={test.id} className="s-apitester-697ab3">
              <i className={`bi ${icons[r.status]} s-apitester-5feea1`} style={{ color: colors[r.status], animation: r.status === 'loading' ? 'spin 1s linear infinite' : 'none' }} />
              <div className="s-userdashboar-6d7d28">
                <p className="s-apitester-1008d6">{test.label}</p>
                {r.status === 'error' && <p className="s-apitester-bb994e">{r.error}</p>}
                {r.status === 'ok' && (
                  <p className="s-apitester-31aed0">
                    ✓ {r.time}ms
                    {r.data?.count !== undefined && ` · ${r.data.count} records`}
                    {Array.isArray(r.data?.list) && ` · ${r.data.list.length} items`}
                  </p>
                )}
              </div>
              <div className="s-adminbrands-ac734d">
                <button onClick={() => runTest(test)} disabled={r.status === 'loading'}
                  className="s-apitester-158256">
                  {r.status === 'loading' ? 'Running…' : 'Test'}
                </button>
                {r.status === 'ok' && r.data && (
                  <button onClick={() => console.log(test.label, r.data)}
                    className="s-apitester-c67401">
                    Log
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
    </div>
  );
}
