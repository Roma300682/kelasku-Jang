import React, { useEffect, useState, useSyncExternalStore } from 'react';
import {
  Download,
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle2,
  Share,
  PlusSquare,
  X,
  Smartphone,
  CloudOff,
  AlertCircle
} from 'lucide-react';
import {
  subscribeOfflineState,
  getOfflineSnapshot,
  setManualOfflineMode,
  syncOfflineQueueNow,
  OfflineStateSnapshot
} from '../offlineSync';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    );
  });

  const [isIOS] = useState<boolean>(() => {
    if (typeof navigator === 'undefined') return false;
    return /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(display-mode: standalone)');
    const onMqChange = () => {
      if (mq.matches || (window.navigator as any).standalone === true) {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
    };
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    mq.addEventListener?.('change', onMqChange);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
      mq.removeEventListener?.('change', onMqChange);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (outcome === 'accepted') {
      setIsInstalled(true);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt && !isInstalled,
    isInstalled,
    isIOS: isIOS && !isInstalled,
    install
  };
}

export function useOfflineStatus(): OfflineStateSnapshot {
  return useSyncExternalStore(subscribeOfflineState, getOfflineSnapshot);
}

interface PWAInstallButtonProps {
  variant?: 'light' | 'dark' | 'card';
  className?: string;
}

export function PWAInstallButton({ variant = 'light', className = '' }: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [iosModalOpen, setIosModalOpen] = useState(false);

  if (isInstalled || (!isInstallable && !isIOS)) return null;

  const baseCls =
    variant === 'dark'
      ? 'px-3 py-1.5 text-xs font-semibold bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shadow-xs cursor-pointer'
      : variant === 'card'
      ? 'px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shadow-xs cursor-pointer'
      : 'px-3 py-1.5 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer';

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (isInstallable) void install();
          else if (isIOS) setIosModalOpen(true);
        }}
        title={isIOS ? 'Cara pasang aplikasi di iPhone / iPad' : 'Pasang aplikasi agar dapat dibuka offline'}
        className={`${baseCls} ${className}`}
      >
        {isIOS ? <Smartphone className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
        <span className={variant === 'card' ? '' : 'hidden sm:inline'}>
          {isIOS ? 'Pasang (iOS)' : 'Pasang Aplikasi'}
        </span>
      </button>

      {iosModalOpen && (
        <div className="fixed inset-0 z-[70] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 w-full max-w-sm space-y-4 shadow-2xl text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <Smartphone className="w-4 h-4 text-indigo-600" />
                <span>Pasang Aplikasi di iPhone / iPad</span>
              </div>
              <button
                type="button"
                onClick={() => setIosModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <p>
                Agar <strong>KelasKu</strong> dapat dibuka langsung dari layar utama dan tetap aktif saat offline di iOS Safari:
              </p>
              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-100">
                <Share className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <span>
                  1. Ketuk tombol <strong>Share (Bagikan)</strong> di bilah bawah/atas browser Safari.
                </span>
              </div>
              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-100">
                <PlusSquare className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <span>
                  2. Gulir ke bawah lalu pilih <strong>Add to Home Screen / Tambah ke Layar Utama</strong>.
                </span>
              </div>
              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-100">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  3. Ketuk <strong>Add / Tambah</strong>. Ikon aplikasi siap digunakan kapan saja termasuk saat offline.
                </span>
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setIosModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl cursor-pointer"
              >
                Mengerti
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

interface OfflineModeTogglePillProps {
  variant?: 'light' | 'dark' | 'card';
  token?: string;
  onSyncDone?: () => void;
  showToast?: (msg: string, ms?: number) => void;
}

export function OfflineModeTogglePill({
  variant = 'light',
  token = '',
  onSyncDone,
  showToast
}: OfflineModeTogglePillProps) {
  const status = useOfflineStatus();

  const handleToggle = async () => {
    if (!status.isNetworkOnline) {
      if (status.isManualOffline) {
        setManualOfflineMode(false);
        showToast?.('Mode offline manual dimatikan. Menunggu jaringan kembali online.', 3000);
      } else {
        setManualOfflineMode(true);
        showToast?.('Mode Offline aktif. Perubahan tetap disimpan aman di perangkat.', 3000);
      }
      return;
    }

    const nextManual = !status.isManualOffline;
    setManualOfflineMode(nextManual);
    if (nextManual) {
      showToast?.('Mode Offline aktif — aplikasi berjalan menggunakan data lokal perangkat.', 3200);
    } else {
      showToast?.('Mode Online aktif kembali.', 2500);
      if (token && status.pendingCount > 0) {
        const res = await syncOfflineQueueNow(token);
        if (res.syncedCount > 0) {
          showToast?.(`${res.syncedCount} perubahan offline berhasil disinkronkan ke server`, 3500);
          onSyncDone?.();
        }
      }
    }
  };

  const offlineActive = status.isEffectiveOffline;

  const btnCls =
    variant === 'dark'
      ? offlineActive
        ? 'bg-amber-400/20 hover:bg-amber-400/30 border border-amber-300/50 text-amber-100'
        : 'bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-300/40 text-emerald-100'
      : offlineActive
      ? 'bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800'
      : 'bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800';

  return (
    <button
      type="button"
      onClick={handleToggle}
      title={
        !status.isNetworkOnline
          ? 'Koneksi internet terputus — Aplikasi otomatis bekerja di Mode Offline'
          : status.isManualOffline
          ? 'Mode Offline manual sedang aktif (klik untuk beralih ke Mode Online)'
          : 'Sedang Online (klik untuk mengaktifkan Mode Offline manual)'
      }
      className={`px-2.5 py-1.5 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${btnCls}`}
    >
      {offlineActive ? (
        <WifiOff className="w-3.5 h-3.5 shrink-0" />
      ) : (
        <Wifi className="w-3.5 h-3.5 shrink-0" />
      )}
      <span className={variant === 'card' ? '' : 'hidden md:inline'}>
        {!status.isNetworkOnline
          ? 'Offline'
          : status.isManualOffline
          ? 'Mode Offline'
          : 'Online'}
      </span>
      {status.pendingCount > 0 && (
        <span
          className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md tabular-nums ${
            variant === 'dark'
              ? 'bg-amber-400 text-slate-950'
              : 'bg-amber-500 text-white'
          }`}
        >
          {status.pendingCount}
        </span>
      )}
    </button>
  );
}

interface OfflineIndicatorProps {
  token?: string;
  onSyncDone?: () => void;
  showToast?: (msg: string, ms?: number) => void;
}

export function OfflineIndicator({ token = '', onSyncDone, showToast }: OfflineIndicatorProps) {
  const status = useOfflineStatus();
  const [minimized, setMinimized] = useState(false);

  const shouldShow =
    status.isEffectiveOffline || status.pendingCount > 0 || status.isSyncing || !!status.lastError;

  useEffect(() => {
    if (status.isEffectiveOffline || status.pendingCount > 0) {
      setMinimized(false);
    }
  }, [status.isEffectiveOffline, status.pendingCount]);

  if (!shouldShow) return null;

  const handleManualSync = async () => {
    if (!status.isNetworkOnline) {
      showToast?.('Jaringan masih offline. Perubahan aman dan otomatis sinkron saat online.', 3200);
      return;
    }
    if (status.isManualOffline) {
      setManualOfflineMode(false);
    }
    const res = await syncOfflineQueueNow(token);
    if (res.syncedCount > 0) {
      showToast?.(`${res.syncedCount} perubahan offline berhasil disinkronkan`, 3500);
      onSyncDone?.();
    } else if (res.error) {
      showToast?.(res.error, 4000);
    }
  };

  if (minimized) {
    return (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        className="fixed bottom-4 left-4 z-40 noprint px-3 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-900 text-white text-xs font-semibold shadow-lg border border-white/15 flex items-center gap-2 cursor-pointer"
      >
        <CloudOff className="w-3.5 h-3.5 text-amber-300" />
        <span>Mode Offline</span>
        {status.pendingCount > 0 && (
          <span className="px-1.5 py-0.5 rounded-md bg-amber-400 text-slate-950 text-[10px] font-bold">
            {status.pendingCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:right-auto sm:max-w-md z-40 noprint">
      <div
        className={`rounded-2xl border shadow-xl px-4 py-3 flex items-start gap-3 backdrop-blur-md ${
          status.isSyncing
            ? 'bg-indigo-950/95 border-indigo-400/40 text-white'
            : status.isEffectiveOffline
            ? 'bg-slate-900/95 border-amber-400/40 text-white'
            : status.lastError
            ? 'bg-rose-950/95 border-rose-400/40 text-white'
            : 'bg-emerald-950/95 border-emerald-400/40 text-white'
        }`}
      >
        <div className="pt-0.5 shrink-0">
          {status.isSyncing ? (
            <RefreshCw className="w-4 h-4 text-sky-300 animate-spin" />
          ) : status.isEffectiveOffline ? (
            <WifiOff className="w-4 h-4 text-amber-300" />
          ) : status.lastError ? (
            <AlertCircle className="w-4 h-4 text-rose-300" />
          ) : (
            <RefreshCw className="w-4 h-4 text-emerald-300" />
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="text-xs font-bold leading-snug">
            {status.isSyncing
              ? 'Menyinkronkan perubahan offline…'
              : !status.isNetworkOnline
              ? 'Koneksi Terputus · Mode Offline Otomatis'
              : status.isManualOffline
              ? 'Mode Offline Aktif'
              : status.lastError
              ? 'Perhatian Sinkronisasi Offline'
              : `${status.pendingCount} Perubahan Offline Siap Disinkronkan`}
          </div>
          <p className="text-[11px] text-slate-200/90 leading-relaxed">
            {status.isSyncing
              ? 'Mengirim data yang diubah saat offline ke server…'
              : status.lastError
              ? status.lastError
              : status.isEffectiveOffline
              ? status.pendingCount > 0
                ? `${status.pendingCount} perubahan tersimpan di perangkat dan akan tersinkronisasi otomatis saat online kembali.`
                : 'Semua menu & data terakhir tetap dapat diakses dan diedit menggunakan penyimpanan lokal perangkat.'
              : 'Jaringan sudah tersedia. Klik sinkron untuk memperbarui server sekarang.'}
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            {status.isNetworkOnline && status.isManualOffline && (
              <button
                type="button"
                onClick={() => {
                  setManualOfflineMode(false);
                  if (token && status.pendingCount > 0) void handleManualSync();
                }}
                className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-[11px] font-semibold cursor-pointer"
              >
                Aktifkan Mode Online
              </button>
            )}
            {status.isNetworkOnline && status.pendingCount > 0 && !status.isSyncing && (
              <button
                type="button"
                onClick={handleManualSync}
                className="px-2.5 py-1 rounded-lg bg-sky-500 hover:bg-sky-400 text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" /> Sinkronkan ({status.pendingCount})
              </button>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMinimized(true)}
          title="Sembunyikan sementara"
          className="p-1 text-slate-300 hover:text-white rounded-lg shrink-0 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
