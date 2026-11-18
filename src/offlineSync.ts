export interface QueuedOfflineOp {
  id: string;
  kind: 'rpc' | 'post';
  fn?: string;
  args?: any[];
  url?: string;
  body?: any;
  hasToken?: boolean;
  dedupKey?: string;
  label: string;
  createdAt: number;
}

export interface OfflineStateSnapshot {
  isNetworkOnline: boolean;
  isManualOffline: boolean;
  isEffectiveOffline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncAt: string;
  lastError: string;
}

const MANUAL_OFFLINE_KEY = 'mk_manual_offline_v1';
const OFFLINE_QUEUE_KEY = 'mk_offline_queue_v1';
const LAST_SYNC_KEY = 'mk_offline_last_sync_v1';

const MUTATING_RPCS = new Set([
  'api_saveSheet',
  'api_savePengaturan',
  'api_saveAbsensi',
  'api_setPIN',
  'api_buatPINSemua',
  'api_simpanPengguna',
  'api_hapusPengguna',
  'api_resetSandiPengguna',
  'api_gantiSandiSaya',
  'api_updateProfilSiswa',
  'api_gantiPIN',
  'api_setMapelSaya',
  'api_simpanAbsensiSekretaris',
  'api_resetPartial',
  'api_updateLoginBranding',
  'api_konversiPoinSiswa'
]);

type Listener = () => void;
const listeners = new Set<Listener>();

let syncingNow = false;
let lastSyncError = '';
let cachedSnapshot: OfflineStateSnapshot | null = null;

function notifyListeners() {
  cachedSnapshot = null;
  listeners.forEach(fn => {
    try {
      fn();
    } catch {}
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', notifyListeners);
  window.addEventListener('offline', notifyListeners);
  window.addEventListener('storage', e => {
    if (e.key === MANUAL_OFFLINE_KEY || e.key === OFFLINE_QUEUE_KEY || e.key === LAST_SYNC_KEY) {
      notifyListeners();
    }
  });
}

export function isNetworkOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
}

export function getManualOfflineMode(): boolean {
  try {
    return localStorage.getItem(MANUAL_OFFLINE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setManualOfflineMode(enabled: boolean): void {
  try {
    if (enabled) localStorage.setItem(MANUAL_OFFLINE_KEY, '1');
    else localStorage.removeItem(MANUAL_OFFLINE_KEY);
  } catch {}
  notifyListeners();
}

export function isEffectiveOffline(): boolean {
  return !isNetworkOnline() || getManualOfflineMode();
}

export function readOfflineQueue(): QueuedOfflineOp[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeOfflineQueue(q: QueuedOfflineOp[]): void {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(q));
  } catch {}
  notifyListeners();
}

export function isQueueableMutationRpc(fn: string): boolean {
  return MUTATING_RPCS.has(fn);
}

export function enqueueOfflineRpc(fn: string, args: any[]): void {
  if (!isQueueableMutationRpc(fn)) return;
  let dedupKey: string | undefined;
  let label = fn;
  if (fn === 'api_saveSheet') {
    dedupKey = `sheet:${String(args[1] || '')}`;
    label = `Simpan ${String(args[1] || 'Data')}`;
  } else if (fn === 'api_savePengaturan') {
    dedupKey = 'pengaturan';
    label = 'Simpan Pengaturan';
  } else if (fn === 'api_saveAbsensi') {
    dedupKey = `abs:${String(args[1] || '')}:${String(args[2] || '')}`;
    label = `Simpan Absensi (${String(args[2] || '')})`;
  } else if (fn === 'api_simpanAbsensiSekretaris') {
    dedupKey = `abs_sek:${String(args[1] || '')}`;
    label = 'Simpan Absensi Sekretaris';
  } else if (fn === 'api_updateProfilSiswa') {
    dedupKey = 'profil_siswa';
    label = 'Perbarui Profil Siswa';
  }

  const sanitizedArgs = args.map((a, idx) => (idx === 0 && typeof a === 'string' ? '__TOKEN__' : a));
  const q = readOfflineQueue().filter(item => !dedupKey || item.dedupKey !== dedupKey);
  q.push({
    id: 'q_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    kind: 'rpc',
    fn,
    args: sanitizedArgs,
    hasToken: fn !== 'api_updateLoginBranding',
    dedupKey,
    label,
    createdAt: Date.now()
  });
  writeOfflineQueue(q);
}

export function enqueueOfflinePost(url: string, body: any, label = 'Kirim Data'): void {
  const q = readOfflineQueue();
  const cloned = body && typeof body === 'object' ? { ...body } : {};
  const hasToken = typeof cloned.token === 'string' && cloned.token.length > 0;
  if (hasToken) cloned.token = '__TOKEN__';
  q.push({
    id: 'q_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    kind: 'post',
    url,
    body: cloned,
    hasToken,
    label,
    createdAt: Date.now()
  });
  writeOfflineQueue(q);
}

export function clearOfflineQueue(): void {
  writeOfflineQueue([]);
}

export function subscribeOfflineState(cb: Listener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getOfflineSnapshot(): OfflineStateSnapshot {
  if (cachedSnapshot) return cachedSnapshot;
  let lastSyncAt = '';
  try {
    lastSyncAt = localStorage.getItem(LAST_SYNC_KEY) || '';
  } catch {}
  cachedSnapshot = {
    isNetworkOnline: isNetworkOnline(),
    isManualOffline: getManualOfflineMode(),
    isEffectiveOffline: isEffectiveOffline(),
    pendingCount: readOfflineQueue().length,
    isSyncing: syncingNow,
    lastSyncAt,
    lastError: lastSyncError
  };
  return cachedSnapshot;
}

export async function syncOfflineQueueNow(
  activeToken: string
): Promise<{ syncedCount: number; remainingCount: number; error?: string }> {
  if (syncingNow) {
    return { syncedCount: 0, remainingCount: readOfflineQueue().length };
  }
  if (!isNetworkOnline() || getManualOfflineMode()) {
    return { syncedCount: 0, remainingCount: readOfflineQueue().length };
  }
  const initialQueue = readOfflineQueue();
  if (initialQueue.length === 0) {
    return { syncedCount: 0, remainingCount: 0 };
  }

  syncingNow = true;
  lastSyncError = '';
  notifyListeners();

  let syncedCount = 0;
  const remaining: QueuedOfflineOp[] = [];
  let abortedByNetwork = false;

  for (let i = 0; i < initialQueue.length; i++) {
    const item = initialQueue[i];
    if (abortedByNetwork) {
      remaining.push(item);
      continue;
    }
    try {
      if (item.kind === 'rpc' && item.fn) {
        const args = (item.args || []).map((a, idx) =>
          idx === 0 && item.hasToken && a === '__TOKEN__' ? activeToken : a
        );
        const res = await fetch('/api/rpc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fn: item.fn, args })
        });
        if (!res.ok && (res.status === 502 || res.status === 503 || res.status === 504)) {
          throw new TypeError('Server unavailable');
        }
        const json = await res.json();
        if (json && json.ok) {
          syncedCount++;
        } else if (String(json?.error || '').includes('SESI_HABIS')) {
          abortedByNetwork = true;
          lastSyncError = 'Silakan masuk kembali ke akun Anda untuk menyelesaikan sinkronisasi.';
          remaining.push(item);
        } else {
          // Non-transient validation error -> drop to avoid permanent head-of-line blocking
          lastSyncError = String(json?.error || 'Sebagian perubahan dilewati');
        }
      } else if (item.kind === 'post' && item.url) {
        const body = item.body && typeof item.body === 'object' ? { ...item.body } : {};
        if (item.hasToken && body.token === '__TOKEN__') {
          body.token = activeToken;
        }
        const res = await fetch(item.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        if (!res.ok && (res.status === 502 || res.status === 503 || res.status === 504)) {
          throw new TypeError('Server unavailable');
        }
        const json = await res.json();
        if (json && json.ok) {
          syncedCount++;
        } else {
          lastSyncError = String(json?.error || 'Sebagian kirim tertunda dilewati');
        }
      }
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (err?.name === 'TypeError' || /failed to fetch|network|unavailable/i.test(msg)) {
        abortedByNetwork = true;
        remaining.push(item);
      } else {
        lastSyncError = msg || 'Gagal menyinkronkan perubahan';
      }
    }
  }

  writeOfflineQueue(remaining);
  if (syncedCount > 0) {
    try {
      localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
    } catch {}
  }
  syncingNow = false;
  notifyListeners();

  return {
    syncedCount,
    remainingCount: remaining.length,
    error: lastSyncError || undefined
  };
}
